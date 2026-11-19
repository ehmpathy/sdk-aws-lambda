import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import { MalfunctionError } from 'helpful-errors';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import { setHandlerTrailCarrier } from '../../lambdaEndpointWire/frame/setHandlerTrailCarrier';
import { asContextLogTrail } from '../asContextLogTrail';
import { asCallerFault } from '../middleware/asCallerFault';
import { setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import { genRecordEndpointMiddlewares } from './genRecordEndpointMiddlewares';
import { logRecordRefused } from './logRecordRefused';
import type {
  EventDecodedOfSource,
  RecordHeadersDeclared,
} from './RecordDecoded';
import type { RecordSource } from './RecordSource';
import { setRecordValidated } from './setRecordValidated';

/**
 * .what = builds the handler of any record-source variant that serves one record per invoke —
 *         `forSqs.perRecord`, `forSns`, `forKinesis.perRecord`
 * .why = the three differ in how a record decodes and in the slots their `invoke` takes, never in
 *        how a record is served: decode, refuse a batch of other than one, validate, freeze,
 *        invoke, acknowledge a caller fault. so the serve is one path, and each variant supplies
 *        its source's facts as data (`rule.forbid.parallel-codepaths`)
 *
 * .why it refuses a batch of other than one = `batchSize` is trigger config, set on the event
 *        source and invisible at gen time. under `batchSize: 10` a silent `records[0]` would serve
 *        one record and drop nine — and the source, on a successful invoke, acknowledges all ten.
 *        so the mismatch fails loud instead, with the fix named
 *        (`rule.forbid.failhide`, `rule.require.errors-name-the-fix`)
 * .why a MalfunctionError and not a ConstraintError = the deployer misconfigured the trigger, never
 *        the producer who sent the record
 *
 * .why a caller fault is acknowledged = the same bytes fail the same way on every delivery, so a
 *        redrive could only page someone for the producer's fault, and at kinesis would hold the
 *        shard behind one bad record (`invariant.constraint-errors-never-redrive-sqs`). any other
 *        fault escapes, so the source redelivers it (`rule.forbid.failhide`)
 */
export const genRecordEndpointPerRecord = <
  TWire,
  TEventValidated extends EventDecodedOfSource,
  TInvokeInput,
>(input: {
  /** the variant's own name, which leads its refusal: `forSqs.perRecord` */
  variant: string;

  /** the facts the source supplies: its name, its noun, its consequence, its carrier */
  source: RecordSource;

  /** the fix a batch of other than one names, which differs per source */
  fixBatchCount: string;

  /** decodes the wire event the source delivers into its records, before validation */
  decode: (input: { wire: TWire }) => EventDecodedOfSource;

  /** the author's schema of one record's `{ headers?, payload }` */
  schema: ZodSchema<{ headers?: RecordHeadersDeclared; payload: unknown }>;

  /** the variant's `deserialize`, already defaulted; the refusal of a text body names its fix by it */
  deserialize: { payload: boolean };

  /**
   * .what = projects the frozen, validated envelope onto the slots this variant's `invoke` takes
   * .why = the projection is the one place the variants differ at the hand-off: a source with a
   *        metadata bag lifts `headers`; kinesis has none, so it lifts no such slot
   * .note = `event.records` holds exactly one record here; the batch-count refusal makes it so
   */
  asInvokeInput: (input: {
    event: FrozenDeep<TEventValidated>;
  }) => TInvokeInput;

  invoke: (input: TInvokeInput, context: ContextLogTrail) => Promise<void>;

  logTranslate: TranslateLog | null;
}): middy.MiddyfiedHandler<TWire, void, Error, Context> => {
  /**
   * .what = the handler's own step: decode, refuse a batch, validate, invoke
   * .why = by here the chain has produced the trail log, so this reads as narrative
   */
  const logic = async (wire: TWire, lambdaContext: Context): Promise<void> => {
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

    const decoded = input.decode({ wire });

    // the cardinality refusal; the message names the fix, since the trigger config is not in view
    if (decoded.records.length !== 1)
      MalfunctionError.throw(
        `${input.variant} received a batch of other than one ${input.source.noun}`,
        {
          count: decoded.records.length,
          fix: input.fixBatchCount,
          ids: decoded.records.map((record) => record.id),
        },
      );

    const record = decoded.records[0]!;

    /**
     * .what = serves the one record: validate, freeze, invoke
     * .note = the batch-count refusal above stays outside this catch: it is the deployer's fault,
     *         and a `MalfunctionError` besides
     */
    try {
      // validates the one record, and writes the parsed values back into it
      setRecordValidated({
        record,
        schema: input.schema,
        deserialize: input.deserialize,
      });

      /**
       * .what = seals the envelope before the handler's turn
       * .why = the envelope it hands over is the same shape a per-batch peer hands over, and a
       *        guarantee that holds on one variant and not its peer is a trap for an author who
       *        moves between them (`rule.require.frozen-invoke-inputs`)
       * .where = after the validator, which writes the parsed values back into the record
       *
       * .as = the validator wrote the validated values into the record, so the envelope now
       *       carries them — a fact typescript cannot track from a mutation. the variant names the
       *       validated type; this is the one place it is asserted
       * .removal = drops when the decode is parameterized on the schema's own output types
       */
      const eventFrozen = setEventFrozen({ event: decoded as TEventValidated });

      // hands over the variant's slots and the lineage
      await input.invoke(input.asInvokeInput({ event: eventFrozen }), { log });
    } catch (error) {
      // rethrow every fault that is not the caller's, so the source redelivers; the escaped throw is its trace
      const callerFault = asCallerFault({ error });
      if (!callerFault) throw error;

      // acknowledge the caller fault, by the same leaf `setRecordsValidated` uses; the return lets it go
      logRecordRefused(
        {
          source: input.source,
          id: record.id,
          raw: record._.raw,
          error: callerFault,
          logTranslate: input.logTranslate,
        },
        { log },
      );
    }
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
