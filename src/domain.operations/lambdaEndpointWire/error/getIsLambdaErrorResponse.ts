import type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import { getIsContempErrorTagged } from './getIsContempErrorTagged';

/**
 * contemp error response shape from genLambdaEndpoint
 * .note = an ALIAS of the canonical shape, never a copy — so a field added
 *   there arrives here rather than waits for someone to notice.
 */
export type LambdaErrorResponseContemp = LambdaEndpointErrorResponseBodyContemp;

/**
 * ancient error response shape from AWS Lambda or old genLambdaEndpoint
 * .note = stackTrace can be string[] (aws native) or string (genLambdaEndpoint)
 *
 * 🔴 **DERIVED from the canonical shape rather than hand-declared**, so the two
 *    can diverge only where this file says they may:
 *
 *    | field | why it differs from the canonical |
 *    |---|---|
 *    | `errorType?` | **optional here.** aws emits a duration-exceeded fault with a message and no type — see `getIsAncientErrorResponse` below |
 *    | `stackTrace?` | **added here.** aws sends it on the wire; this package's own emitter does not (`getErrorResponseBodyAncient`) |
 *
 * 🟡 it is WIDER than the canonical, one-directionally and on purpose: it models
 *    what comes OFF a wire (aws, this package, or a legacy handler) where the
 *    canonical models what this package PUTS ON one. the derivation adds and
 *    never removes, and every other field tracks the canonical automatically.
 */
export type LambdaErrorResponseAncient = Omit<
  LambdaEndpointErrorResponseBodyAncient,
  'errorType'
> & {
  errorType?: string;
  /**
   * .note = string[] (aws native) or string (a legacy genLambdaEndpoint handler)
   */
  stackTrace?: string[] | string;
};

/**
 * .what = checks if parsed response is a contemp lambda error response, and narrows it
 * .why = the wire boundary needs the NARROW; the tag read itself is shared
 *
 * .note = the predicate body is `getIsContempErrorTagged`, which the run boundary
 *   calls too. what stays here is only the `parsed is …` narrow, because the two
 *   boundaries narrow to different declared types — see that operation for why
 *   the contemp halves share and the ancient halves do not.
 */
export const getIsContempErrorResponse = (
  parsed: unknown,
): parsed is LambdaErrorResponseContemp => getIsContempErrorTagged(parsed);

/**
 * .what = checks if parsed response is an ancient lambda error response
 * .why = ancient errors have flat errorMessage property
 *
 * 🔴 the single-field check is DELIBERATE — it is not the question
 *    `isLambdaEndpointErrorEnvelope` asks:
 *
 *    | predicate | requires | answers |
 *    |---|---|---|
 *    | this one, on the WIRE | `errorMessage` alone | *"did the UPSTREAM fault, by any route?"* |
 *    | `isLambdaEndpointErrorEnvelope`, on a RUN | both fields, both `string` | *"did MY HANDLER return an envelope?"* |
 *
 * ⚠️ `errorType` is optional because AWS makes it so — a lambda that exceeds its
 *    duration answers with an `errorMessage` and no type. a check that demanded
 *    both would refuse a payload this package's own types declare legal, and the
 *    downgrade is QUIET: the rich message is replaced by the generic
 *    fall-through one on the commonest production failure.
 *
 * .note = so this is intentionally LOOSER than its run-side peer. to "reconcile"
 *   the two is to delete a case, never to remove a drift.
 */
export const getIsAncientErrorResponse = (
  parsed: unknown,
): parsed is LambdaErrorResponseAncient =>
  typeof parsed === 'object' && parsed !== null && 'errorMessage' in parsed;
