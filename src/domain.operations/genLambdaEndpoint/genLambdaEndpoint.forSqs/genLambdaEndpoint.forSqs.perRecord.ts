import middy from '@middy/core';
import type { Context, SQSEvent } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { asContextLogTrail } from '../asContextLogTrail';
import { type FrozenDeep, setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import { asSqsEventDecoded } from './asSqsEventDecoded';
import { DESERIALIZE_DEFAULT } from './asSqsRecordDecoded';
import { genSqsEndpointMiddlewares } from './genSqsEndpointMiddlewares';
import type {
  SqsEventDecoded,
  SqsHeadersDeclared,
  SqsHeadersMerged,
} from './SqsEventDecoded';
import { setSqsRecordValidated } from './setSqsRecordValidated';

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
     * .why = a message with the wrong shape is refused before the handler runs, and the refusal
     *        fails the invoke, so sqs redrives it and eventually dead-letters it rather than
     *        delete it
     *
     * .note = `payload` is required and `headers` is optional. an absent `headers` key constrains
     *         naught, so header enforcement is opt-in (`rule.require.explicit-optout`)
     * .note = there is no `schema.output`. an sqs handler answers no one — `perRecord` returns no
     *         value, and sqs reads the invocation's success or failure and naught else
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  };

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
     *         the config is per handler, so every message meets the same mismatch and the queue
     *         drains to its dead-letter, while the sender's `SendMessage` reports success.
     *         clamped by `[case15]`
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

  /**
   * .what = the handler's own step: decode, refuse a batch, validate, invoke
   * .why = by here the chain has produced the trail log, so this reads as narrative
   */
  const logic = async (
    event: SQSEvent,
    lambdaContext: Context,
  ): Promise<void> => {
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

    const decoded = asSqsEventDecoded({ wire: event }, { deserialize });

    /**
     * .what = the cardinality refusal this variant exists for
     * .why = see the batch-size note above. the message names the fix because the author who
     *        meets it cannot see the trigger config from the code they read
     */
    if (decoded.records.length !== 1)
      MalfunctionError.throw(
        'forSqs.perRecord received a batch of other than one message',
        {
          count: decoded.records.length,
          fix: 'set the event source `batchSize` to 1, or reach for `genLambdaEndpoint.forSqs.perBatch`',
          ids: decoded.records.map((record) => record.id),
        },
      );

    /**
     * .what = validates the one record, and writes the parsed values back into it
     * .note = its return is that same object, narrowed. the read happens off `eventFrozen` below
     *         instead, which narrows the whole envelope and the record with it
     */
    setSqsRecordValidated({
      record: decoded.records[0]!,
      schema: config.schema.input,
    });

    /**
     * .what = seals the envelope before the handler's turn
     * .why = the envelope it hands over is the same shape `perBatch` hands over, and a guarantee
     *        that holds on one variant and not its peer is a trap for an author who moves between
     *        them (`rule.forbid.parallel-codepaths`)
     * .where = after the validator, which writes the parsed values back into the record
     *
     * .as = the validated values were written into the record, so the envelope now carries them
     *       too — a fact typescript cannot track from a mutation
     * .removal = drops when the decode is parameterized on the schema's own output types
     */
    const eventFrozen = setEventFrozen({
      event: decoded as SqsEventDecoded<{
        headers: SqsHeadersMerged<THeaders>;
        payload: TPayload;
      }>,
    });
    const recordFrozen = eventFrozen.records[0]!;

    /**
     * .what = hands over the pair, the envelope, and the lineage. the two lifted fields are
     *         projections of the record's slots
     * .note = read off `eventFrozen` rather than `decoded` — the same reference, since the freeze
     *         is in place, and the narrowed type is what carries the readonly guarantee to the
     *         handler. a read off `decoded` hands over the pre-freeze type and drops it
     */
    await config.invoke(
      {
        payload: recordFrozen.payload,
        headers: recordFrozen.headers,
        event: eventFrozen,
      },
      { log },
    );
  };

  return middy(logic).use(
    genSqsEndpointMiddlewares({ logTranslate: config.logTranslate }),
  );
};
