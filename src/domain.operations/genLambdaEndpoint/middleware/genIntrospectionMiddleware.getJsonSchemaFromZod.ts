import { z } from 'zod';
import type { JSONSchema } from 'zod/v4/core/json-schema';

/**
 * .what = convert zod schema to JSON schema
 * .why = encapsulates zod api for future error handler if needed
 */
export const getJsonSchemaFromZod = <T extends z.ZodType>(
  schema: T,
): JSONSchema => {
  return z.toJSONSchema(schema) as JSONSchema;
};
