import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import { setHandlerTrailCarrier } from '../../lambdaEndpointWire/frame/setHandlerTrailCarrier';
import { asContextLogTrail } from '../asContextLogTrail';
import { setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import {
  asRecordBatchResponse,
  type RecordBatchResponse,
} from './asRecordBatchResponse';
import { asRecordIds } from './asRecordIds';
import { genRecordEndpointMiddlewares } from './genRecordEndpointMiddlewares';
import { getAllRecordIdsRetried } from './getAllRecordIdsRetried';
import { getAllRecordIdsUnclaimable } from './getAllRecordIdsUnclaimable';
import { getAllRecordSuccessRefsMalformed } from './getAllRecordSuccessRefsMalformed';
import type {
  EventDecodedOfSource,
  RecordDecodedOfSource,
  RecordHeadersDeclared,
} from './RecordDecoded';
import type { RecordSourceBatched } from './RecordSource';
import { setRecordsValidated } from './setRecordsValidated';

/**
 * .what = the one fact a batched source needs to acknowledge a record: its `id`
 * .why = a record carries its `id`, so `return { successes: recordsThatSucceeded }` needs no
 *        re-shape. `id`, never aws's wire name `itemIdentifier` (`domain.terms/.readme.md`)
 */
export interface RecordSuccessRef {
  id: string;
}

/**
 * .what = builds the handler of any record-source variant that serves a whole batch per invoke —
 *         `forSqs.perBatch`, `forKinesis.perBatch`
 * .why = the two differ in how a record decodes, never in how a batch is served: validate each,
 *        invoke, read the answer, report every record not claimed as a success. so the serve is
 *        one path, and each variant supplies its source's facts as data
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .note = fail safe by construction: every record neither reported as a success nor refused by the
 *         schema is retried, and an answer the sdk cannot read throws, which retries the whole batch
 * .note = a handler throw escapes unchanged, whatever its class: a throw names no record, so it
 *         carries no verdict on any one of them — the handler may have served some before it
 *         threw. to acknowledge the batch would let go of records of unknown outcome, so the throw
 *         is forwarded and the whole batch redrives. a handler that refuses one record acknowledges
 *         it by name, in `successes`
 */
export const genRecordEndpointPerBatch = <
  TWire,
  TRecordValidated extends RecordDecodedOfSource,
  TEventValidated extends EventDecodedOfSource<TRecordValidated>,
>(input: {
  /** the variant's own name, which leads each refusal of its handler's answer: `forSqs.perBatch` */
  variant: string;

  /** the facts the source supplies: its name, its noun, its consequences, its carrier */
  source: RecordSourceBatched;

  /** decodes the wire event the source delivers into its records, before validation */
  decode: (input: { wire: TWire }) => EventDecodedOfSource;

  /** the author's schema of one record's `{ headers?, payload }`, applied per record */
  schema: ZodSchema<{ headers?: RecordHeadersDeclared; payload: unknown }>;

  /** the variant's `deserialize`, already defaulted; the refusal of a text body names its fix by it */
  deserialize: { payload: boolean };

  invoke: (
    input: {
      records: FrozenDeep<TRecordValidated[]>;
      event: FrozenDeep<TEventValidated>;
    },
    context: ContextLogTrail,
  ) => Promise<{ successes: readonly FrozenDeep<RecordSuccessRef>[] }>;

  logTranslate: TranslateLog | null;
}): middy.MiddyfiedHandler<TWire, RecordBatchResponse, Error, Context> => {
  /**
   * .what = decode, validate each, invoke, report every record not claimed as a success
   * .why = the chain has produced the trail log by here, so this reads as narrative
   */
  const logic = async (
    wire: TWire,
    lambdaContext: Context,
  ): Promise<RecordBatchResponse> => {
    // read the trail log `genTrailMiddleware` wrote
    const { log } = asContextLogTrail({ context: lambdaContext });

    const decoded = input.decode({ wire });

    // validate each record; a caller fault is acknowledged, a server fault retried
    const { recordsValidated, idsRefused } = setRecordsValidated(
      {
        source: input.source,
        records: decoded.records,
        schema: input.schema,
        deserialize: input.deserialize,
        logTranslate: input.logTranslate,
      },
      { log },
    );

    // the only ids a handler may claim; read before its turn, so no write it makes can widen them
    const idsClaimable = asRecordIds({ records: recordsValidated });

    /**
     * .what = seals the envelope before the handler's turn (`rule.require.frozen-invoke-inputs`)
     * .where = after validation, since the validator writes parsed values back into each record
     *
     * .as = the validator wrote the validated values into each record, so the records and the
     *       envelope now carry them — a fact typescript cannot track from a mutation. the variant
     *       names the validated types; this is the one place they are asserted
     * .removal = drops when the decode is parameterized on the schema's own output types
     */
    const envelope = {
      records: recordsValidated as TRecordValidated[],
      event: decoded as TEventValidated,
    };
    const envelopeFrozen = setEventFrozen({ event: envelope });

    // hands the batch to the handler; a throw escapes unchanged, and the whole batch redrives
    const answer = await input.invoke(
      { records: envelopeFrozen.records, event: envelopeFrozen.event },
      { log },
    );

    // refuse an answer with no `successes` array; the throw retries the whole batch
    if (!Array.isArray(answer?.successes))
      MalfunctionError.throw(
        `${input.variant} handler answered without a \`successes\` array`,
        {
          got: answer === undefined ? 'undefined' : typeof answer,
          keys: answer ? Object.keys(answer) : [],
          fix: 'return `{ successes: recordsThatSucceeded }` — the records themselves. none succeeded? `{ successes: [] }`',
        },
      );

    // refuse an entry with no string `id`; the throw retries the whole batch
    const refsMalformed = getAllRecordSuccessRefsMalformed({
      successes: answer.successes,
    });
    if (refsMalformed.length)
      MalfunctionError.throw(
        `${input.variant} handler answered with a success that carries no \`id\``,
        {
          indexes: refsMalformed.map((ref) => ref.index),
          got: refsMalformed.map((ref) => ref.got),
          fix: 'return the records themselves — `return { successes: recordsThatSucceeded }` — rather than bare id strings',
        },
      );

    // refuse a claim on a record the handler was not handed; the throw retries the whole batch
    const idsUnclaimable = getAllRecordIdsUnclaimable({
      successes: answer.successes,
      idsClaimable,
    });
    if (idsUnclaimable.length)
      MalfunctionError.throw(
        `${input.variant} handler claimed a success for a record it was not handed`,
        {
          idsUnclaimable,
          idsClaimable: [...idsClaimable],
          fix: 'return the records themselves — `return { successes: recordsThatSucceeded }` — drawn from `records`, never from `event.records` or a hand-written id',
        },
      );

    // answer the source: a record neither claimed nor refused is retried
    const idsRetried = getAllRecordIdsRetried({
      records: decoded.records,
      successes: answer.successes,
      idsRefused,
    });
    return asRecordBatchResponse({ idsRetried });
  };

  return setHandlerTrailCarrier({
    handler: middy(logic).use(
      genRecordEndpointMiddlewares({
        logTranslate: input.logTranslate,
        carrier: input.source.carrier,
      }),
    ),
    carrier: input.source.carrier,
  });
};
