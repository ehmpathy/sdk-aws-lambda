import type middy from '@middy/core';
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { DESERIALIZE_DEFAULT } from '../record/asRecordBodyParsed';
import {
  genRecordEndpointPerBatch,
  type RecordSuccessRef,
} from '../record/genRecordEndpointPerBatch';
import type { TranslateLog } from '../TranslateLog';
import { asSqsEventDecoded } from './asSqsEventDecoded';
import { RECORD_SOURCE_SQS } from './genLambdaEndpoint.forSqs.constants';
import type {
  SqsEventDecoded,
  SqsHeadersDeclared,
  SqsHeadersMerged,
  SqsRecordDecoded,
} from './SqsEventDecoded';

/**
 * .what = the one fact sqs needs to delete a message: its `id`
 * .why = a record carries its `id`, so `return { successes: recordsThatSucceeded }` needs no
 *        re-shape. `id`, never aws's wire name `itemIdentifier` (`domain.terms/.readme.md`)
 * .note = the shared `RecordSuccessRef`, under the name this family shipped
 */
export type SqsRecordSuccessRef = RecordSuccessRef;

/**
 * .what = sdk contract type for `genLambdaEndpoint.forSqs.perBatch`
 * .why = exported for consumer type inference
 */
export type ForSqsPerBatchInput<
  THeaders extends SqsHeadersDeclared,
  TPayload,
> = {
  schema: {
    /**
     * .what = the pair one message carries — `{ headers?, payload }`, applied per record
     * .note = a record this refuses never reaches `invoke`. the refusal is a caller fault, so it
     *         is logged as `sqs.record.refused` and acknowledged — sqs deletes it, with no retry
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  };

  invoke: (
    input: {
      /**
       * .what = the messages that passed validation — a filter over `event.records`, never a
       *         copy (`domain.terms/records.md`)
       * .note = empty when the schema refuses every message — the handler still runs. a throw
       *         here redrives the refused records with the batch, so do not throw on `[]`
       */
      records: FrozenDeep<
        SqsRecordDecoded<{
          headers: SqsHeadersMerged<THeaders>;
          payload: TPayload;
        }>[]
      >;

      /**
       * .what = the whole object that arrived — every record, valid or not
       *         (`domain.terms/event.md`)
       */
      event: FrozenDeep<
        SqsEventDecoded<{
          headers: SqsHeadersMerged<THeaders>;
          payload: TPayload;
        }>
      >;
    },
    /**
     * .what = the ambient bag; the lineage rides `context.log.trail`, one per invoke
     *         (`domain.terms/trail.md`)
     */
    context: ContextLogTrail,
  ) => Promise<{
    /**
     * .what = the records this handler processed, so sqs may delete them
     * .why = fail safe. a record not named here is retried, so a forgotten record redrives rather
     *        than vanishes (`rule.forbid.failhide`)
     * .note = a record named here that the handler chose to drop leaves no sdk log line; log it
     *         yourself where an operator needs the trace
     */
    successes: readonly FrozenDeep<SqsRecordSuccessRef>[];
  }>;

  logTranslate?: TranslateLog;

  deserialize?: {
    /**
     * .what = whether to parse each json body into its `payload`
     * .note = `false` hands `payload` to your schema as a string, so pair it with `z.string()`
     *         (`rule.require.explicit-optout`)
     */
    payload: boolean;
  };
};

/**
 * .what = generates an sqs lambda handler that serves a whole batch per invoke
 * .why = a handler that acts on many messages at once cannot be expressed one record at a time,
 *        and a partial-batch response lets one poison message fail alone
 *
 * .note = fail safe by construction: every record neither reported as a success nor refused by
 *         the schema is retried, and an answer the sdk cannot read throws, which retries the
 *         whole batch
 * .note = deploy precondition: the event source must declare
 *         `functionResponseTypes: ['ReportBatchItemFailures']`, or sqs deletes every message
 */
export const perBatch = <THeaders extends SqsHeadersDeclared, TPayload>(
  config: ForSqsPerBatchInput<THeaders, TPayload>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<SQSEvent, SQSBatchResponse, Error, Context> => {
  // the env context this family declares for symmetry; no step of its chain reads one yet
  void context;

  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  // the serve is the shared one; this variant supplies sqs's facts
  return genRecordEndpointPerBatch<
    SQSEvent,
    SqsRecordDecoded<{
      headers: SqsHeadersMerged<THeaders>;
      payload: TPayload;
    }>,
    SqsEventDecoded<{ headers: SqsHeadersMerged<THeaders>; payload: TPayload }>
  >({
    variant: 'forSqs.perBatch',
    source: RECORD_SOURCE_SQS,
    decode: ({ wire }) => asSqsEventDecoded({ wire }, { deserialize }),
    deserialize,
    schema: config.schema.input,
    invoke: config.invoke,
    logTranslate: config.logTranslate ?? null,
  });
};
