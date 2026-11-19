import type { LambdaEventSchemaSourceName } from '../../../domain.objects/LambdaEventSchemaSource';
import type { TrailCarrier } from '../../../domain.objects/TrailCarrier';

/**
 * .what = the facts a record-source family supplies to the shared leaves — the words its logs and
 *         errors say, and the carrier it reads
 * .why = the leaves are one path for every record source; what differs per source is only what to
 *        call a record and what its source does with one. so those facts are data, declared once
 *        per source, never a branch in a leaf (`rule.forbid.parallel-codepaths`)
 */
export interface RecordSource {
  /**
   * .what = the source's name, which leads each log line: `sqs.record.refused`
   * .why the schema-source name list = the record sources and the schema sources are one set, by
   *        `rule.require.event-source-symmetry`; one list holds both, so a source cannot gain one
   *        half under a name the other half lacks
   */
  name: LambdaEventSchemaSourceName;

  /**
   * .what = what the source calls one record — in an error message, and as the log key that carries
   *         the raw record
   * .why = an operator searches for the word the source uses: sqs and sns deliver messages, kinesis
   *        delivers records
   */
  noun: 'message' | 'record';

  /** what the source does with a record refused as a caller fault */
  consequenceRefused: string;

  /** where the family reads its caller's trail (`domain.objects/TrailCarrier`) */
  carrier: TrailCarrier;
}

/**
 * .what = the facts a source that batches supplies beside them
 * .why = only a per-batch variant meets a server fault on one record and lets that record alone
 *        redrive, so only a source that batches owes the words for it. sns delivers one message per
 *        invoke, so it owes none, and the type holds that (`rule.require.illegal-states-unrepresentable`)
 */
export interface RecordSourceBatched extends RecordSource {
  /** what the source does with a record met by a fault of ours at validation */
  consequenceInvalid: string;
}
