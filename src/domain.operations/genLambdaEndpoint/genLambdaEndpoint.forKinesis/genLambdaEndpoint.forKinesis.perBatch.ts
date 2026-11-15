import type middy from '@middy/core';
import type {
  Context,
  KinesisStreamBatchResponse,
  KinesisStreamEvent,
} from 'aws-lambda';
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
import { asKinesisEventRecords } from './asKinesisEventRecords';
import { RECORD_SOURCE_KINESIS } from './genLambdaEndpoint.forKinesis.constants';
import type { KinesisEventRecords, KinesisRecord } from './KinesisEventRecords';

/**
 * .what = sdk contract type for `genLambdaEndpoint.forKinesis.perBatch`
 * .why = exported for consumer type inference
 */
export type ForKinesisPerBatchInput<TPayload> = {
  schema: {
    /**
     * .what = the slot one record carries — `{ payload }`, applied per record
     * .note = a record this refuses never reaches `invoke`. the refusal is a caller fault, so it
     *         is logged as `kinesis.record.refused` and acknowledged — the shard advances past it
     * .note = `headers?: never`: a kinesis record carries no metadata bag, so a schema that declares
     *         one fails to compile rather than refuse every record at run time
     */
    input: ZodSchema<{ payload: TPayload; headers?: never }>;
  };

  /**
   * .what = serves the batch; the answer names each record served
   * .note = a throw of ANY class retries the whole batch, a `ConstraintError` included. this differs
   *         from `perRecord`, where a `ConstraintError` acknowledges its one record: here no single
   *         record owns the throw. at kinesis a retried batch holds the shard, so to let one bad
   *         record go, log it and list it in `successes`
   */
  invoke: (
    input: {
      /**
       * .what = the records that passed validation — a filter over `event.records`, never a copy
       *         (`domain.terms/records.md`)
       * .note = empty when the schema refuses every record — the handler still runs
       */
      records: FrozenDeep<KinesisRecord<{ payload: TPayload }>[]>;

      /**
       * .what = the whole object that arrived — every record, valid or not
       */
      event: FrozenDeep<KinesisEventRecords<{ payload: TPayload }>>;
    },
    context: ContextLogTrail,
  ) => Promise<{
    /**
     * .what = the records this handler processed
     * .why = fail safe. a record not named here is retried, so a forgotten record redrives rather
     *        than vanishes (`rule.forbid.failhide`)
     * .note = kinesis retries from the lowest sequence number not acknowledged, so a record left
     *         out here retries every record after it in the shard too
     */
    successes: readonly FrozenDeep<RecordSuccessRef>[];
  }>;

  logTranslate?: TranslateLog;

  deserialize?: {
    /**
     * .what = whether to parse each record's decoded text as json into its `payload`
     * .note = `false` hands `payload` to your schema as the utf8 text, so pair it with `z.string()`
     *         (`rule.require.explicit-optout`)
     * .note = a mis-pair spans the handler, never one record: the config is per handler. under a
     *         z.object payload each record is refused and acknowledged, each refusal named with this
     *         fix. under a `z.string()` payload the loss is partial and silent: a line that is not
     *         json passes as text, and one that is also json (`42`, `true`) is refused with no hint
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
 * .what = generates a kinesis lambda handler that serves a whole batch per invoke
 * .why = the endpoint half of the kinesis source, symmetric with `asLambdaEventSchema.fromKinesis`
 *        and with `forSqs.perBatch`: a partial-batch response lets kinesis checkpoint past every
 *        record served, rather than retry the batch whole (`rule.require.event-source-symmetry`)
 *
 * .note = deploy precondition: the event source must declare
 *         `functionResponseTypes: ['ReportBatchItemFailures']`, or kinesis reads no answer and
 *         advances past every record
 */
export const perBatch = <TPayload>(
  config: ForKinesisPerBatchInput<TPayload>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<
  KinesisStreamEvent,
  KinesisStreamBatchResponse,
  Error,
  Context
> => {
  // the env context every record-source variant declares, for one call shape; no step here reads it
  void context;

  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  // the serve is the shared one; this variant supplies kinesis's facts
  return genRecordEndpointPerBatch<
    KinesisStreamEvent,
    KinesisRecord<{ payload: TPayload }>,
    KinesisEventRecords<{ payload: TPayload }>
  >({
    variant: 'forKinesis.perBatch',
    source: RECORD_SOURCE_KINESIS,
    decode: ({ wire }) => asKinesisEventRecords({ wire }, { deserialize }),
    deserialize,
    schema: config.schema.input,
    invoke: config.invoke,
    logTranslate: config.logTranslate ?? null,
  });
};
