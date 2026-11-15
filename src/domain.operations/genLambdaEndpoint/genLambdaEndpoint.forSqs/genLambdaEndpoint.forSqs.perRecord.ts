import type middy from '@middy/core';
import type { Context, SQSEvent } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { DESERIALIZE_DEFAULT } from '../record/asRecordBodyParsed';
import { genRecordEndpointPerRecord } from '../record/genRecordEndpointPerRecord';
import type { TranslateLog } from '../TranslateLog';
import { asSqsEventDecoded } from './asSqsEventDecoded';
import { RECORD_SOURCE_SQS } from './genLambdaEndpoint.forSqs.constants';
import type {
  SqsEventDecoded,
  SqsHeadersDeclared,
  SqsHeadersMerged,
} from './SqsEventDecoded';

/**
 * .what = sdk contract type for `genLambdaEndpoint.forSqs.perRecord`
 * .why = exported for consumer type inference
 *
 * .why `THeaders` is bound = the validator spreads the validated headers back over the wire bag,
 *        so a `THeaders` that is not a record spreads as one: `{ ...'abc' }` yields
 *        `{ 0: 'a', 1: 'b', 2: 'c' }`. unbound, that compiles clean and throws naught at run time
 *        (`rule.require.illegal-states-unrepresentable`)
 */
export type ForSqsPerRecordInput<
  THeaders extends SqsHeadersDeclared,
  TPayload,
> = {
  schema: {
    /**
     * .what = describes the pair `invoke` receives for one message — `{ headers?, payload }`
     * .why = a message with the wrong shape is refused before the handler runs. the refusal is
     *        a caller fault, so it is logged as `sqs.record.refused` and the invoke succeeds —
     *        sqs deletes the message once, with no retry and no dead-letter entry
     *
     * .note = `payload` is required and `headers` is optional. an absent `headers` key constrains
     *         naught, so header enforcement is opt-in (`rule.require.explicit-optout`)
     * .note = there is no `schema.output`. an sqs handler answers no one — `perRecord` returns no
     *         value, and sqs reads the invocation's success or failure and naught else
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  };

  /**
   * .what = serves one message; a return acknowledges it, a throw redrives it
   * .note = the class is the verdict: a `ConstraintError` (or `BadRequestError`) that escapes is a
   *         caller fault, so the message is logged `sqs.record.refused` and deleted — a downstream
   *         one too, such as a 429. to retry a transient fault, throw a `MalfunctionError`
   */
  invoke: (
    input: {
      /**
       * .what = the message body, parsed and validated against `schema.input.payload`
       * .note = this is `event.records[0].payload` — one object, two access paths
       * .note = frozen, because it is a slot of the envelope rather than a value beside it
       */
      payload: FrozenDeep<TPayload>;

      /**
       * .what = the sender's message attributes, one name per value, keys verbatim
       * .note = sqs attribute names are case-sensitive, so the api-gateway lowercase fold does
       *         not travel here — see `asSqsHeadersOnwire`
       * .note = this is `event.records[0].headers` — one object, two access paths
       * .note = frozen, for the same reason its peer is
       */
      headers: FrozenDeep<SqsHeadersMerged<THeaders>>;

      /**
       * .what = the whole object that arrived — the batch, with every record decoded
       * .why = `event` names what arrived, in every family. an sqs invoke arrives as a batch even
       *        where this variant serves exactly one message of it (`domain.terms/event.md`)
       *
       * .note = `event.records` has exactly one element here, and the batch-size refusal below is
       *         what makes that true
       * .note = frozen, though this variant reads no value after `invoke`. its twin does, and the
       *         envelope both hand over is one shape — a guarantee that holds on one variant and
       *         not its peer is a trap for an author who moves between them
       *         (`rule.forbid.parallel-codepaths`)
       */
      event: FrozenDeep<
        SqsEventDecoded<{
          headers: SqsHeadersMerged<THeaders>;
          payload: TPayload;
        }>
      >;
    },
    /**
     * .what = the ambient bag, which carries the observability lineage
     * .why `trail` rides here and never in `input` = it is ambient runtime rather than part of
     *        the request, so an `input.trail` slot is forbidden in every family
     *        (`rule.require.env-access-in-context`, `domain.terms/trail.md`). read it at
     *        `context.log.trail`:
     *
     *          invoke: async ({ payload, headers, event }, { log }) => log.trail.exid
     *
     * .note = this family mints its own `exid`. no producer propagates a correlation id into a
     *         queue, so `trail.exid` is a fresh uuid rather than the caller's; a
     *         `messageAttribute`-sourced trail is unbuilt work
     */
    context: ContextLogTrail,
  ) => Promise<void>;

  logTranslate?: TranslateLog;

  deserialize?: {
    /**
     * .what = whether to parse the json body into `payload`
     * .note = set `false` for a raw string body — a caller who must verify a signature over the
     *         exact bytes reads the string (`rule.require.explicit-optout`)
     * .note = `false` hands `payload` to your schema as a string, so it must be set with the
     *         schema's payload half. a mis-pair is a total outage rather than one bad message:
     *         the config is per handler, so every message meets the same mismatch and each is
     *         refused and deleted, while the sender's `SendMessage` reports success. the
     *         `sqs.record.refused` warn on every message is the one sign. clamped by `[case15]`
     *
     *          deserialize.payload | the schema's payload half
     *          --------------------|--------------------------
     *          absent / true       | z.object({ … })
     *          false               | z.string()
     */
    payload: boolean;
  };
};

/**
 * .what = generates an sqs lambda handler that serves one message per invoke
 * .why = a handler written against one message is the common case, and it is the shape every
 *        other family already hands over. this variant restores cardinality 1 so `payload` and
 *        `headers` mean what they mean everywhere else (`domain.terms/event.md`)
 *
 * .why it refuses a batch of more than one = `batchSize` is trigger config, set on the event
 *        source and invisible at gen time. under `batchSize: 10` a silent `records[0]` would
 *        process one message and drop nine — and sqs, on a successful invoke, deletes all ten.
 *        so the mismatch fails loud instead, with the fix named
 *        (`rule.forbid.failhide`, `rule.require.errors-name-the-fix`)
 *
 * .why a MalfunctionError and not a ConstraintError = the deployer misconfigured the trigger,
 *        never the producer who sent the message
 *
 * .note = a leaf of the `genLambdaEndpoint` family, never exported bare from `src/index.ts` — a
 *         consumer reaches it as `genLambdaEndpoint.forSqs.perRecord`
 *         (`rule.forbid.unqualified-variant-exports`)
 */
export const perRecord = <THeaders extends SqsHeadersDeclared, TPayload>(
  config: ForSqsPerRecordInput<THeaders, TPayload>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<SQSEvent, void, Error, Context> => {
  // the env context this family declares for symmetry; no step of its chain reads one yet
  void context;

  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  // the serve is the shared one; this variant supplies sqs's facts and its own slots
  return genRecordEndpointPerRecord<
    SQSEvent,
    SqsEventDecoded<{ headers: SqsHeadersMerged<THeaders>; payload: TPayload }>,
    Parameters<ForSqsPerRecordInput<THeaders, TPayload>['invoke']>[0]
  >({
    variant: 'forSqs.perRecord',
    source: RECORD_SOURCE_SQS,
    fixBatchCount:
      'set the event source `batchSize` to 1, or reach for `genLambdaEndpoint.forSqs.perBatch`',
    decode: ({ wire }) => asSqsEventDecoded({ wire }, { deserialize }),
    deserialize,
    schema: config.schema.input,

    // the pair and the envelope; the two lifted fields are projections of the one record's slots
    asInvokeInput: ({ event }) => ({
      payload: event.records[0]!.payload,
      headers: event.records[0]!.headers,
      event,
    }),
    invoke: config.invoke,
    logTranslate: config.logTranslate ?? null,
  });
};
