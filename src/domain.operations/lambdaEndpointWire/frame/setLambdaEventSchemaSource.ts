import type { LambdaEventSchemaSource } from '../../../domain.objects/LambdaEventSchemaSource';

/**
 * .what = the mark an `asLambdaEventSchema.*` builder leaves on the schema it returns
 * .why = the same shape as `HANDLER_TRAIL_CARRIER` (`setHandlerTrailCarrier`): the reader holds
 *        the object, so it reads the fact off the object
 *
 * .note = `Symbol.for`, so two copies of this package in one process still agree on the mark — a
 *         schema built by one copy still warns when another copy's `forAsk` validates it
 * .note = a clone zod makes of the schema (`.refine()`, `.describe()`, `.meta()`) points back at
 *         it via `_zod.parent`, which the reader follows, as zod's own registries do. a schema
 *         that WRAPS it (`.optional()`, a union) is a new schema with no parent, so it carries no
 *         mark; its refusals log as any other `forAsk` caller's do
 */
export const LAMBDA_EVENT_SCHEMA_SOURCE = Symbol.for(
  'sdk-aws-lambda.lambdaEventSchema.source',
);

/**
 * .what = declares the event source a schema validates, and returns the same schema
 * .why = each `asLambdaEventSchema.*` builder stamps its schema here, so `forAsk` can tell an
 *        aws-delivered event's refusal (warn) from a direct caller's (debug)
 *
 * .note = non-enumerable, so it appears in no spread, no snapshot, and no introspection render
 *         (zod `.meta()` would publish it into the json schema)
 * .note = DELIBERATE MUTATION — of the fresh schema the builder just made, never of a caller's
 */
export const setLambdaEventSchemaSource = <TSchema extends object>(input: {
  schema: TSchema;
  source: LambdaEventSchemaSource;
}): TSchema =>
  Object.defineProperty(input.schema, LAMBDA_EVENT_SCHEMA_SOURCE, {
    value: input.source,
    enumerable: false,
  });
