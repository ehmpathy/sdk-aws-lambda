import { ConstraintError } from 'helpful-errors';

import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';

/**
 * .what = casts a declared `struct.payload` into a dialect, and refuses any value
 *         that is not one
 * .why = the branch that reads the dialect is `if (dialect === 'contemp') … else
 *   ancient`, so a typo, a stale config value, or an `as any` call site falls
 *   through to ancient — the event goes FLAT, the endpoint answers
 *   `{ errorMessage, errorType }`, and the run SUCCEEDS in the wrong dialect while
 *   the author's contemp assertions fail for a reason that names neither.
 *
 * ⚠️ the type does not cover a js consumer, an `as any` call site, or a
 *    data-driven dialect. a published sdk boundary is validated at runtime or it
 *    is not validated (rule.forbid.unexpected-defaults) — the same argument the
 *    `at` guard makes on its peer field.
 *
 * .note = a THROW here, and a silent fall to ancient on `askLambdaEndpoint` — the
 *   production caller keeps the fall so a live deploy that passes a bad value
 *   today does not break (rule.require.contemp-must-self-identify: an
 *   unrecognized value is ancient, never contemp). tracked at
 *   `.dream/v2026_09_11.repair.one-dialect-two-validation-philosophies.md`.
 *
 * .note = it lives in `dialect/` because BOTH boundaries need it.
 */
export const asLambdaEndpointDialect = (input: {
  declared?: unknown;
}): LambdaEndpointDialect => {
  // absent is legal, and contemp is the default
  // (rule.require.contemp-contracts-default)
  if (input.declared === undefined || input.declared === null) return 'contemp';

  if (input.declared === 'contemp') return 'contemp';
  if (input.declared === 'ancient') return 'ancient';

  return ConstraintError.throw(
    'the payload dialect given is not one this util can send',
    {
      declared: input.declared,
      options: ['contemp', 'ancient'],
      hint: "pass `struct: { payload: 'contemp' }` for the `{ event, trail }` wrapper and a `{ error: { class, message } }` envelope, or `struct: { payload: 'ancient' }` for a flat event and an `{ errorMessage, errorType }` envelope. omit `struct` for the 'contemp' default.",
    },
  );
};
