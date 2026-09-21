import { ConstraintError } from 'helpful-errors';

import type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import { getIsContempErrorTagged } from '../../lambdaEndpointWire/error/getIsContempErrorTagged';
import type { LambdaEndpointErrorEnvelope } from './LambdaEndpointRunOutput';

/**
 * .what = narrows a run output to the CONTEMP constraint envelope it may carry
 * .why = the contemp envelope stamps its own codec tag (`…::contemp@$v`) and we
 *   author every one, so this narrow is EXACT: carries the tag ⇒ is one; lacks it
 *   ⇒ is not. no shape heuristic, no fallback.
 *
 * .note = dialect-fixed on purpose. the caller names the dialect by WHICH function
 *   they call, so the tag check and the shape check never run on one value —
 *   which is what stops a contemp caller from reading `.error.message` as
 *   `undefined` off an ancient value.
 *
 * @example
 * ```ts
 * const res = await runLambdaEndpoint.onReferenced({ event, handler });
 * if (isLambdaEndpointErrorEnvelopeContemp(res)) res.error.class;   // ✅ exact, by the tag
 * ```
 */
export const isLambdaEndpointErrorEnvelopeContemp = (
  output: unknown,
): output is LambdaEndpointErrorResponseBodyContemp =>
  getIsContempErrorTagged(output);

/**
 * .what = narrows a run output to the ANCIENT constraint envelope it may carry
 * .why = the ancient wire carries no tag, so this reads the flat
 *   `{ errorMessage: string, errorType: string }` pair.
 *
 * ⚠️ a HEURISTIC, inherently — a success output that happens to carry those two
 *    string keys is indistinguishable from a rejection, and the ancient dialect
 *    has no discriminator to stamp.
 *
 * .note = demands BOTH fields, stricter than the wire's `getIsAncientErrorResponse`
 *   (`'errorMessage' in parsed`). this asks *"did MY handler reject?"*; the wire
 *   asks *"did the upstream fault, by any route?"* — and aws sends a bare
 *   `errorMessage` with no type on a duration-exceeded fault.
 *
 * @example
 * ```ts
 * const old = await runLambdaEndpoint.onReferenced({ event, handler, struct: { payload: 'ancient' } });
 * if (isLambdaEndpointErrorEnvelopeAncient(old)) old.errorType;   // ⚠️ by shape, ambiguous
 * ```
 */
export const isLambdaEndpointErrorEnvelopeAncient = (
  output: unknown,
): output is LambdaEndpointErrorResponseBodyAncient => {
  if (typeof output !== 'object' || output === null) return false;

  /**
   * .as = the inspection cast every type guard is made of. fields are optional +
   *   `unknown`, so it asserts no shape — the check below decides.
   * .removal = never; a `x is T` predicate is rule.forbid.as-cast's own carve-out.
   */
  const ancient = output as { errorMessage?: unknown; errorType?: unknown };
  return (
    typeof ancient.errorMessage === 'string' &&
    typeof ancient.errorType === 'string'
  );
};

/**
 * .what = is this run output EITHER dialect's constraint envelope?
 * .why = `asLambdaEndpointOutput` subtracts the whole envelope union to leave the
 *   handler's output, so it needs both dialects at once. private — a consumer
 *   picks a dialect-fixed peer above.
 */
export const isLambdaEndpointErrorEnvelopeAnyDialect = (
  output: unknown,
): output is LambdaEndpointErrorEnvelope<'ancient' | 'contemp'> =>
  isLambdaEndpointErrorEnvelopeContemp(output) ||
  isLambdaEndpointErrorEnvelopeAncient(output);

/**
 * .what = asserts a run output IS the CONTEMP constraint envelope, and narrows it
 * .why = a test that reads `.error.message` must fail LOUD when the endpoint
 *   answered with a success payload — a silent `undefined` teaches naught
 *   (rule.require.failfast). `ConstraintError`, because the fault is the caller's.
 *
 * @example
 * ```ts
 * const envelope = asLambdaEndpointErrorEnvelopeContemp(res);
 * expect(envelope.error.message).toContain('the uuid names no known surfer');
 * ```
 */
export const asLambdaEndpointErrorEnvelopeContemp = (
  output: unknown,
): LambdaEndpointErrorResponseBodyContemp => {
  if (isLambdaEndpointErrorEnvelopeContemp(output)) return output;

  throw new ConstraintError(
    'the endpoint answered with an output, never a contemp constraint envelope',
    {
      output,
      hint: 'the handler did not reject this event with a contemp envelope. assert on the output shape, send an event the schema refuses, or — if you declared the ancient dialect — use asLambdaEndpointErrorEnvelopeAncient.',
    },
  );
};

/**
 * .what = asserts a run output IS the ANCIENT constraint envelope, and narrows it
 * .why = for a caller that declared `struct.payload: 'ancient'`. reads the flat
 *   shape, so its confidence is the wire's — see the guard above.
 *
 * @example
 * ```ts
 * const envelope = asLambdaEndpointErrorEnvelopeAncient(old);
 * expect(envelope.errorType).toEqual('BadRequestError');
 * ```
 */
export const asLambdaEndpointErrorEnvelopeAncient = (
  output: unknown,
): LambdaEndpointErrorResponseBodyAncient => {
  if (isLambdaEndpointErrorEnvelopeAncient(output)) return output;

  throw new ConstraintError(
    'the endpoint answered with an output, never an ancient constraint envelope',
    {
      output,
      hint: 'the handler did not return a flat { errorMessage, errorType } envelope. assert on the output shape, or — if you expected the contemp dialect — use asLambdaEndpointErrorEnvelopeContemp.',
    },
  );
};
