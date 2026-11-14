import {
  LAMBDA_EVENT_SCHEMA_SOURCE_NAMES,
  type LambdaEventSchemaSource,
  type LambdaEventSchemaSourceName,
} from '../../../domain.objects/LambdaEventSchemaSource';
import { LAMBDA_EVENT_SCHEMA_SOURCE } from './setLambdaEventSchemaSource';

/**
 * .what = the event source a schema declares, or null for a schema that declares none
 * .why = every schema not built by `asLambdaEventSchema.*` declares none, and its refusals keep
 *        `forAsk`'s debug-only log
 *
 * .note = a zod clone (`.refine()`, `.describe()`, `.meta()`) carries no own mark, but points at
 *         the schema it was cloned from via `_zod.parent`; the read follows that chain, as zod's
 *         own registries do for metadata
 * .note = the mark may come from another copy of this package (`Symbol.for`), so it is read,
 *         never assumed: only a known source name is accepted, and the record is rebuilt from it
 */
export const getOneLambdaEventSchemaSource = (input: {
  schema: unknown;
}): LambdaEventSchemaSource | null => {
  // a value that is no object declares no source
  if (!isObjectNonNull(input.schema)) return null;

  // a schema that holds its own mark declares the source the mark names, if known
  const mark: unknown = Reflect.get(input.schema, LAMBDA_EVENT_SCHEMA_SOURCE);
  if (isObjectNonNull(mark)) {
    const name: unknown = Reflect.get(mark, 'name');
    return isLambdaEventSchemaSourceName(name) ? { name } : null;
  }

  // else read the schema it was cloned from, if any
  return getOneLambdaEventSchemaSource({
    schema: getParentOfZodClone({ schema: input.schema }),
  });
};

/**
 * .what = the schema a zod clone was made from, or null for a schema that is no clone
 */
const getParentOfZodClone = (input: { schema: object }): unknown => {
  const internals: unknown = Reflect.get(input.schema, '_zod');
  if (!isObjectNonNull(internals)) return null;
  return Reflect.get(internals, 'parent') ?? null;
};

/**
 * .what = whether a value is an object one can read a key off
 */
const isObjectNonNull = (value: unknown): value is object =>
  typeof value === 'object' && value !== null;

/**
 * .what = whether a value names a source this sdk builds a schema for
 */
const isLambdaEventSchemaSourceName = (
  name: unknown,
): name is LambdaEventSchemaSourceName =>
  LAMBDA_EVENT_SCHEMA_SOURCE_NAMES.some((known) => known === name);
