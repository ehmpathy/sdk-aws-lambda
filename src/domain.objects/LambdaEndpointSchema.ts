import type { JSONSchema } from 'zod/v4/core/json-schema';

/**
 * .what = the schema of a lambda endpoint's input and output
 * .why = enables runtime introspection of endpoint contracts for sdk generation
 */
export interface LambdaEndpointSchema {
  input: JSONSchema;
  output: JSONSchema;
}
