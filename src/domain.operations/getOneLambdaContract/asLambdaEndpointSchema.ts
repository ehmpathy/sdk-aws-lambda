import type { LambdaEndpoint } from '../../domain.objects/LambdaEndpoint';
import type { LambdaEndpointSchema } from '../../domain.objects/LambdaEndpointSchema';
import { LambdaIntrospectionNotSupportedError } from '../../domain.objects/LambdaIntrospectionNotSupportedError';

/**
 * .what = cast a lambda response payload into a LambdaEndpointSchema
 * .why = a payload either is a contract or the lambda does not support
 *        introspection; there is no partial state, so this cast throws rather
 *        than yield null
 *
 * .throws LambdaIntrospectionNotSupportedError (reason: non-schema-payload)
 *   - payload is malformed json
 *   - payload is not a json-schema envelope (lacks input/output schema shape)
 */
export const asLambdaEndpointSchema = (input: {
  payload: Uint8Array;
  endpoint: LambdaEndpoint;
}): LambdaEndpointSchema => {
  // decode payload bytes to string
  const payloadStr = Buffer.from(input.payload).toString('utf-8');

  // parse json; malformed json means the lambda is not introspectable
  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadStr);
  } catch (error) {
    // allowlist: only SyntaxError (malformed json) maps to not-supported
    if (!(error instanceof SyntaxError)) throw error;
    throw new LambdaIntrospectionNotSupportedError(
      `lambda does not support introspection (non-schema-payload): ${input.endpoint.slug}`,
      {
        endpoint: input.endpoint,
        reason: 'non-schema-payload',
        cause: error,
        hint: 'ensure handler uses genLambdaEndpoint with zod schemas and env config',
      },
    );
  }

  // require a schema envelope: an object that carries input AND output schemas
  const envelope = parsed as { input?: unknown; output?: unknown } | null;
  const isSchemaEnvelope =
    typeof parsed === 'object' &&
    parsed !== null &&
    getIsJsonSchemaShape(envelope?.input) &&
    getIsJsonSchemaShape(envelope?.output);
  if (!isSchemaEnvelope) {
    throw new LambdaIntrospectionNotSupportedError(
      `lambda does not support introspection (non-schema-payload): ${input.endpoint.slug}`,
      {
        endpoint: input.endpoint,
        reason: 'non-schema-payload',
        hint: 'ensure handler uses genLambdaEndpoint with zod schemas and env config',
      },
    );
  }

  return parsed as LambdaEndpointSchema;
};

/**
 * .what = checks if a value looks like a json-schema object
 * .why = distinguishes a real introspection schema from a business output that
 *        coincidentally has input/output keys
 *
 * note: json schemas are objects that carry at least one structural marker
 *       (type, properties, $ref, enum, anyOf/oneOf/allOf, items, const, $schema)
 */
const getIsJsonSchemaShape = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const markers = [
    'type',
    'properties',
    '$ref',
    '$schema',
    'enum',
    'const',
    'anyOf',
    'oneOf',
    'allOf',
    'items',
  ];
  return markers.some((marker) => marker in value);
};
