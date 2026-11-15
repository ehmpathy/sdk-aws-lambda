import type middy from '@middy/core';
import type { Context, KinesisStreamEvent } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { DESERIALIZE_DEFAULT } from '../record/asRecordBodyParsed';
import { genRecordEndpointPerRecord } from '../record/genRecordEndpointPerRecord';
import type { TranslateLog } from '../TranslateLog';
import { asKinesisEventRecords } from './asKinesisEventRecords';
import { RECORD_SOURCE_KINESIS } from './genLambdaEndpoint.forKinesis.constants';
import type { KinesisEventRecords } from './KinesisEventRecords';

/**
 * .what = sdk contract type for `genLambdaEndpoint.forKinesis.perRecord`
 * .why = exported for consumer type inference
 */
export type ForKinesisPerRecordInput<TPayload> = {
  schema: {
    /**
     * .what = describes the one slot `invoke` receives for one record — `{ payload }`
     * .why = a record with the wrong shape is refused before the handler runs. the refusal is a
     *        caller fault, so it is logged as `kinesis.record.refused` and the invoke succeeds —
     *        the shard advances past it rather than block behind it
     * .note = no `headers` key: a kinesis record carries no metadata bag. `headers?: never` makes a
     *         schema that declares one fail to compile, since a wider object would otherwise fit
     *         and refuse every record at run time
     */
    input: ZodSchema<{ payload: TPayload; headers?: never }>;
  };

  /**
   * .what = serves one record; a return acknowledges it, a throw retries it
   * .note = the class is the verdict: a `ConstraintError` (or `BadRequestError`) that escapes is a
   *         caller fault, so the record is logged `kinesis.record.refused` and acknowledged. to
   *         retry a transient fault, throw a `MalfunctionError`
   */
  invoke: (
    input: {
      /**
       * .what = the record's data, base64-decoded, parsed, and validated
       * .note = this is `event.records[0].payload` — one object, two access paths. frozen
       */
      payload: FrozenDeep<TPayload>;

      /**
       * .what = the whole object that arrived — the invoke, with its one record decoded
       */
      event: FrozenDeep<KinesisEventRecords<{ payload: TPayload }>>;
    },
    /**
     * .what = the ambient bag; this family mints its own `exid` on each invoke, since a kinesis
     *         record carries no trail (`domain.terms/trail.md`)
     */
    context: ContextLogTrail,
  ) => Promise<void>;

  logTranslate?: TranslateLog;

  deserialize?: {
    /**
     * .what = whether to parse the decoded text as json into `payload`
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
 * .what = generates a kinesis lambda handler that serves one record per invoke
 * .why = the endpoint half of the kinesis source, symmetric with `asLambdaEventSchema.fromKinesis`
 *        and with `forSqs.perRecord` (`rule.require.event-source-symmetry`)
 *
 * .note = deploy precondition: the event source must declare `batchSize: 1`. any other count fails
 *         loud and names the fix, rather than serve one record and let the shard advance past nine
 */
export const perRecord = <TPayload>(
  config: ForKinesisPerRecordInput<TPayload>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<KinesisStreamEvent, void, Error, Context> => {
  // the env context every record-source variant declares, for one call shape; no step here reads it
  void context;

  const deserialize = config.deserialize ?? DESERIALIZE_DEFAULT;

  // the serve is the shared one; this variant supplies kinesis's facts and its own slots
  return genRecordEndpointPerRecord<
    KinesisStreamEvent,
    KinesisEventRecords<{ payload: TPayload }>,
    Parameters<ForKinesisPerRecordInput<TPayload>['invoke']>[0]
  >({
    variant: 'forKinesis.perRecord',
    source: RECORD_SOURCE_KINESIS,
    fixBatchCount:
      'set the event source `batchSize` to 1, or reach for `genLambdaEndpoint.forKinesis.perBatch`',
    decode: ({ wire }) => asKinesisEventRecords({ wire }, { deserialize }),
    deserialize,
    schema: config.schema.input,

    // the payload and the envelope; kinesis carries no header bag, so no `headers` slot is lifted
    asInvokeInput: ({ event }) => ({
      payload: event.records[0]!.payload,
      event,
    }),
    invoke: config.invoke,
    logTranslate: config.logTranslate ?? null,
  });
};
