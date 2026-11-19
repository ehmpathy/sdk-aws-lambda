import type middy from '@middy/core';
import type { Context, SNSEvent } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { DESERIALIZE_DEFAULT } from '../record/asRecordBodyParsed';
import { genRecordEndpointPerRecord } from '../record/genRecordEndpointPerRecord';
import type { TranslateLog } from '../TranslateLog';
import { asSnsEventRecords } from './asSnsEventRecords';
import { RECORD_SOURCE_SNS } from './genLambdaEndpoint.forSns.constants';
import type {
  SnsEventRecords,
  SnsHeadersDeclared,
  SnsHeadersMerged,
} from './SnsEventRecords';

/**
 * .what = sdk contract type for `genLambdaEndpoint.forSns`
 * .why = exported for consumer type inference
 *
 * .why `THeaders` is bound = the validator spreads the validated headers back over the wire bag,
 *        so a `THeaders` that is not a record spreads as a char map
 *        (`rule.require.illegal-states-unrepresentable`)
 */
export type ForSnsInput<THeaders extends SnsHeadersDeclared, TPayload> = {
  schema: {
    /**
     * .what = describes the pair `invoke` receives for one message — `{ headers?, payload }`
     * .why = a message with the wrong shape is refused before the handler runs. the refusal is a
     *        caller fault, so it is logged as `sns.record.refused` and the invoke succeeds —
     *        lambda does not retry it
     *
     * .note = `payload` is required and `headers` is optional; an absent `headers` key constrains
     *         naught, so header enforcement is opt-in (`rule.require.explicit-optout`)
     * .note = there is no `schema.output`. sns invokes a lambda asynchronously, so no caller reads
     *         a return value
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  };

  /**
   * .what = serves one message; a return acknowledges it, a throw retries it
   * .note = the class is the verdict: a `ConstraintError` (or `BadRequestError`) that escapes is a
   *         caller fault, so the message is logged `sns.record.refused` and acknowledged. to retry
   *         a transient fault, throw a `MalfunctionError`
   */
  invoke: (
    input: {
      /**
       * .what = the message, parsed and validated against `schema.input.payload`
       * .note = this is `event.records[0].payload` — one object, two access paths. frozen
       */
      payload: FrozenDeep<TPayload>;

      /**
       * .what = the publisher's message attributes, one name per value, keys verbatim
       * .note = this is `event.records[0].headers` — one object, two access paths. frozen
       */
      headers: FrozenDeep<SnsHeadersMerged<THeaders>>;

      /**
       * .what = the whole object that arrived — the invoke, with its one record decoded
       * .why = `event` names what arrived, in every family (`domain.terms/event.md`)
       */
      event: FrozenDeep<
        SnsEventRecords<{
          headers: SnsHeadersMerged<THeaders>;
          payload: TPayload;
        }>
      >;
    },
    /**
     * .what = the ambient bag, which carries the observability lineage at `context.log.trail`
     * .note = this family mints its own `exid` on each invoke: the `MessageAttributes` lift is unbuilt
     *         (`domain.terms/trail.md`)
     */
    context: ContextLogTrail,
  ) => Promise<void>;

  logTranslate?: TranslateLog;

  deserialize?: {
    /**
     * .what = whether to parse the json message into `payload`
     * .note = `false` hands `payload` to your schema as a string, so pair it with `z.string()`
     *         (`rule.require.explicit-optout`)
     * .note = a mis-pair spans the handler, never one message: the config is per handler. a text
     *         topic left on the json default under a `z.object` payload has each message refused
     *         and acknowledged, each refusal named with this fix. under a `z.string()` payload the
     *         loss is partial and silent: a message that is not json passes as text, and one that
     *         is also json (`42`, `true`) parses as json and is refused with no hint
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
 * .what = generates an sns lambda handler that serves one message per invoke
 * .why = the endpoint half of the sns source, symmetric with `asLambdaEventSchema.fromSns`: a
 *        handler written against one message, with the same contract `forSqs.perRecord` hands
 *        over (`rule.require.event-source-symmetry`)
 *
 * .why a variant and not a `{ perRecord, perBatch }` sub-family = sns delivers one message per
 *        invoke, so the trigger forces no cardinality choice. a sub-family with one leaf is a
 *        variant with an extra hop (`domain.terms/genLambdaEndpoint.md`, F01)
 * .why it still refuses a count other than one = an invoke sns did not build (a misroute, a hand
 *        replay) must fail loud rather than serve `records[0]` and acknowledge the rest
 *
 * .note = a leaf of the `genLambdaEndpoint` family, never exported bare from `src/index.ts`
 *         (`rule.forbid.unqualified-variant-exports`)
 */
export const forSns = <THeaders extends SnsHeadersDeclared, TPayload>(
  config: ForSnsInput<THeaders, TPayload>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<SNSEvent, void, Error, Context> => {
  // the env context every record-source variant declares, for one call shape; no step here reads it
  void context;

  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  // the serve is the shared one; this variant supplies sns's facts and its own slots
  return genRecordEndpointPerRecord<
    SNSEvent,
    SnsEventRecords<{ headers: SnsHeadersMerged<THeaders>; payload: TPayload }>,
    Parameters<ForSnsInput<THeaders, TPayload>['invoke']>[0]
  >({
    variant: 'forSns',
    source: RECORD_SOURCE_SNS,
    fixBatchCount:
      'sns delivers one message per invoke; check that this lambda is subscribed to an sns topic, and not invoked by another source',
    decode: ({ wire }) => asSnsEventRecords({ wire }, { deserialize }),
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
