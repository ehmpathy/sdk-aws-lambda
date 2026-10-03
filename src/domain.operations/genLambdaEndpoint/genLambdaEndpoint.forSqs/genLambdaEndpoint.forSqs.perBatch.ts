import middy from '@middy/core';
import type { Context, SQSBatchResponse, SQSEvent } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { asContextLogTrail } from '../asContextLogTrail';
import { setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import { asSqsEventDecoded } from './asSqsEventDecoded';
import { DESERIALIZE_DEFAULT } from './asSqsRecordDecoded';
import { genSqsEndpointMiddlewares } from './genSqsEndpointMiddlewares';
import type {
  SqsEventDecoded,
  SqsHeadersDeclared,
  SqsHeadersMerged,
  SqsRecordDecoded,
} from './SqsEventDecoded';
import { setSqsRecordValidated } from './setSqsRecordValidated';

/**
 * .what = the one fact sqs needs to delete a message: its `id`
 * .why = a record carries its `id`, so `return { successes: recordsThatSucceeded }` needs no
 *        re-shape. `id`, never aws's wire name `itemIdentifier` (`domain.terms/.readme.md`)
 */
export interface SqsRecordSuccessRef {
  id: string;
}

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
     * .note = a record this refuses never reaches `invoke`, and is retried
     */
    input: ZodSchema<{ headers?: THeaders; payload: TPayload }>;
  };

  invoke: (
    input: {
      /**
       * .what = the messages that passed validation — a filter over `event.records`, never a
       *         copy (`domain.terms/records.md`)
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
 * .note = fail safe by construction: every record not reported as a success is retried, and an
 *         answer the sdk cannot read throws, which retries the whole batch
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

  /**
   * .what = decode, validate each, invoke, report every record not claimed as a success
   * .why = the chain has produced the trail log by here, so this reads as narrative
   */
  const logic = async (
    event: SQSEvent,
    lambdaContext: Context,
  ): Promise<SQSBatchResponse> => {
    // read the trail log `genTrailMiddleware` wrote
    const { log } = asContextLogTrail({ context: lambdaContext });

    const decoded = asSqsEventDecoded({ wire: event }, { deserialize });

    // validate each record; a refusal is logged and left out, so it is retried alone
    const recordsValidated: SqsRecordDecoded<{
      headers: SqsHeadersMerged<THeaders>;
      payload: TPayload;
    }>[] = [];
    for (const record of decoded.records) {
      try {
        recordsValidated.push(
          setSqsRecordValidated({ record, schema: config.schema.input }),
        );
      } catch (error) {
        if (!(error instanceof Error)) throw error;
        log.warn('sqs.record.invalid', {
          id: record.id,
          errorMessage: error.message,
        });
      }
    }

    // the only ids a handler may claim; read before its turn, so no write it makes can widen them
    const idsClaimable = new Set(recordsValidated.map((record) => record.id));

    /**
     * .what = seals the envelope before the handler's turn (`rule.require.frozen-invoke-inputs`)
     * .where = after validation, since the validator writes parsed values back into each record
     * .as = the envelope now carries the validated values, a fact typescript cannot track from a
     *       mutation. drops when the decode is parameterized on the schema's output types
     */
    const frozen = setEventFrozen({
      event: {
        records: recordsValidated,
        event: decoded as SqsEventDecoded<{
          headers: SqsHeadersMerged<THeaders>;
          payload: TPayload;
        }>,
      },
    });

    const answer = await config.invoke(
      { records: frozen.records, event: frozen.event },
      { log },
    );

    // refuse an answer with no `successes` array; the throw retries the whole batch
    if (!Array.isArray(answer?.successes))
      MalfunctionError.throw(
        'forSqs.perBatch handler answered without a `successes` array',
        {
          got: answer === undefined ? 'undefined' : typeof answer,
          keys: answer ? Object.keys(answer) : [],
          fix: 'return `{ successes: recordsThatSucceeded }` — the records themselves. none succeeded? `{ successes: [] }`',
        },
      );

    // refuse an entry with no string `id`; the throw retries the whole batch
    const refsMalformed = answer.successes
      .map((success, index) => ({ index, success }))
      .filter(({ success }) => typeof success?.id !== 'string');
    if (refsMalformed.length)
      MalfunctionError.throw(
        'forSqs.perBatch handler answered with a success that carries no `id`',
        {
          indexes: refsMalformed.map(({ index }) => index),
          got: refsMalformed.map(({ success }) =>
            success === null ? 'null' : typeof success,
          ),
          fix: 'return the records themselves — `return { successes: recordsThatSucceeded }` — rather than bare id strings',
        },
      );

    // refuse a claim on a record the handler was not handed; the throw retries the whole batch
    const idsUnclaimable = answer.successes
      .map((success) => success.id)
      .filter((id) => !idsClaimable.has(id));
    if (idsUnclaimable.length)
      MalfunctionError.throw(
        'forSqs.perBatch handler claimed a success for a record it was not handed',
        {
          idsUnclaimable,
          idsClaimable: [...idsClaimable],
          fix: 'return the records themselves — `return { successes: recordsThatSucceeded }` — drawn from `records`, never from `event.records` or a hand-written id',
        },
      );

    // every record not claimed as a success is retried; deduped, since sqs reads each id once
    const idsSucceeded = new Set(answer.successes.map((success) => success.id));
    const idsFailed = [
      ...new Set(
        decoded.records
          .map((record) => record.id)
          .filter((id) => !idsSucceeded.has(id)),
      ),
    ];

    return {
      batchItemFailures: idsFailed.map((id) => ({ itemIdentifier: id })),
    };
  };

  return middy(logic).use(
    genSqsEndpointMiddlewares({ logTranslate: config.logTranslate }),
  );
};
