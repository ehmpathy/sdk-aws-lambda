import type { ZodSchema } from 'zod';

import { getValidationError } from './getValidationError';

/**
 * .what = validate a caller's value against an endpoint's input schema, and hand back the
 *         parsed result
 * .why = this is the ONE root primitive for the input border. every family reaches it, so a
 *        guarantee added here — a coerce, a redaction, an error shape — lands once
 *
 * .note = the families differ only in WHICH VALUE they hand in, never in what validation means:
 *         `forAsk` hands the unwrapped body; `forApiGateway` and `forSqs` hand the
 *         `{ headers, payload }` pair. each family writes the result back into its own slots
 *
 * .note = the result is the POST-parse shape, so a schema that coerces (any `X.contract()`
 *         position) yields live domain instances rather than the plain objects that crossed the
 *         wire. the caller assigns it into its own slot
 */
export const getValidatedInput = <TInput>(input: {
  schema: ZodSchema<TInput>;
  value: unknown;
}): TInput => {
  const result = input.schema.safeParse(input.value);
  if (!result.success) throw getValidationError({ error: result.error });
  return result.data;
};
