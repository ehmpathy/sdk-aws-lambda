import type { ContextLogTrail } from 'sdk-logs';

import type {
  LambdaEventSchemaSource,
  LambdaEventSchemaSourceName,
} from '../../../../domain.objects/LambdaEventSchemaSource';
import { getAllLambdaEventIds } from './getAllLambdaEventIds';

/**
 * .what = what became of a refused event, per source, in operator words
 * .why = `forAsk` answers a caller fault as a success, so the fate is `forAsk`'s fact and lives
 *        here, beside the line that states it, never in the schema layer. a `Record` keyed by
 *        the source name list, so a new source that lacks its fate fails to compile
 */
const CONSEQUENCE_BY_SOURCE: Record<LambdaEventSchemaSourceName, string> = {
  sqs: 'the whole batch is answered as a success, so sqs deletes every message in it, good ones included; this line is the only trace. serve sqs with genLambdaEndpoint.forSqs to acknowledge a refused message alone',
  sns: 'acknowledged; lambda does not retry a success, so this line is the only trace',
  kinesis:
    'the whole batch is answered as a success, so lambda does not retry it; this line is the only trace',
};

/**
 * .what = the most of each list one line carries
 * .why = a kinesis batch holds up to 10,000 records, and one bad record can raise an issue per
 *        record. uncapped, that line reaches megabytes, past cloudwatch's 256 KB event limit, so
 *        it would land split and unparseable, on the very refusal it exists to trace. capped, the
 *        line stays a few KB: the counts say how many, and the first and last id bound the range
 *        to replay from the stream
 */
const LINE_LIMIT = { ids: 100, issues: 20, errorMessageChars: 500 } as const;

/**
 * .what = the first `limit` items of a list, the full count, and the last item when it was cut
 * .note = `cutLast` is null when every item is shown, since the last is then in `shown`
 */
const asListCapped = <T>(input: {
  items: T[];
  limit: number;
}): { shown: T[]; count: number; cutLast: T | null } => ({
  shown: input.items.slice(0, input.limit),
  count: input.items.length,
  cutLast:
    input.items.length > input.limit ? (input.items.at(-1) ?? null) : null,
});

/**
 * .what = the error message's first line, cut to a bound
 * .why = a validation error's message restates its issues as pretty json below its first line,
 *        which the line's own `issues` already carries
 */
const asErrorMessageHeadline = (input: { message: string }): string => {
  const [headline = ''] = input.message.split('\n');
  return headline.length > LINE_LIMIT.errorMessageChars
    ? `${headline.slice(0, LINE_LIMIT.errorMessageChars)}…`
    : headline;
};

/**
 * .what = the issue summaries a refusal carries, or none
 * .why = a schema refusal arrives via `getValidationError`, whose metadata holds `issues`. but a
 *        caller fault a consumer's own code throws (a `.refine`, an `X.contract()` constructor,
 *        the handler itself) carries metadata of its own shape, or none. so `issues` is read,
 *        never assumed
 * .note = typed `unknown[]`, not this copy's `ZodIssueSummary[]`: the elements pass to the log
 *         as-is, so a foreign copy's issues reach the operator whole rather than filtered out
 */
const getIssuesOfRefusal = (input: { error: Error }): unknown[] => {
  const metadata: unknown = Reflect.get(input.error, 'metadata');
  if (typeof metadata !== 'object' || metadata === null) return [];
  const issues: unknown = Reflect.get(metadata, 'issues');
  return Array.isArray(issues) ? issues : [];
};

/**
 * .what = records that an aws-delivered event was refused, by its `asLambdaEventSchema.*` schema
 *         or by the handler as a caller fault
 * .why = `forAsk` answers the refusal as a caller fault, so the invoke succeeds and aws drops the
 *        event (sqs deletes the batch; sns does not retry a success; kinesis advances the shard,
 *        outside a tumble window). this line is its one durable trace: the source, the cause, the
 *        issue paths, and the ids to find or replay it
 *
 * .note = warn, not error: the lambda ran as intended and the producer is at fault, as for
 *         `sqs.record.refused`
 * .note = scoped to event-source endpoints only. every other `forAsk` caller keeps its debug-only
 *         log, since a direct caller reads the refusal in its own response
 * .note = `error` is any throw `asCallerFault` accepts, so it is typed `Error`: a
 *         `BadRequestError`, or another copy's `ConstraintError`, is not this copy's class
 * .note = `class` reads `constructor.name`, as `logRecordRefused` does: an operator searches
 *         for the class the author threw, which the wire's `errorType` (`.name`) may not carry
 * .note = each list is capped (`LINE_LIMIT`), with its full count beside it, so the line fits
 *         one cloudwatch event at any batch size
 */
export const logLambdaEventRefused = (
  input: {
    event: unknown;
    error: Error;
    source: LambdaEventSchemaSource;
  },
  context: { log: Pick<ContextLogTrail['log'], 'warn'> },
): void => {
  const ids = asListCapped({
    items: getAllLambdaEventIds({
      event: input.event,
      name: input.source.name,
    }),
    limit: LINE_LIMIT.ids,
  });
  const issues = asListCapped({
    items: getIssuesOfRefusal({ error: input.error }),
    limit: LINE_LIMIT.issues,
  });
  context.log.warn('lambda.event.refused', {
    source: input.source.name,
    ids: ids.shown,
    idsCount: ids.count,
    idLast: ids.cutLast,
    class: input.error.constructor.name,
    errorMessage: asErrorMessageHeadline({ message: input.error.message }),
    issues: issues.shown,
    issuesCount: issues.count,
    consequence: CONSEQUENCE_BY_SOURCE[input.source.name],
  });
};
