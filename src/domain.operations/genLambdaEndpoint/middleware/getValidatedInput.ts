import type { ZodSchema } from 'zod';

import { getValidationError } from './getValidationError';

/**
 * .what = validate a caller's value against an endpoint's input schema, and hand back the
 *         parsed result
 * .why = this is the ONE root primitive for the input border. both endpoint families reach it,
 *        so a guarantee added here — a coerce, a redaction, an error shape — lands once rather
 *        than in each family's own validator
 *
 * .note = the two families differ only in WHICH SLOT carries the caller's value, never in what
 *         validation means. `forAskEndpoint` hands the whole `request.event`; `forApiGateway`
 *         hands `event.body`, because its `request.event` must stay http-shaped for
 *         `@middy/http-cors`. that slot choice stays with each family; the validation itself
 *         lives here
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
