import { ConstraintError } from 'helpful-errors';

import type { LambdaEndpoint } from '../../domain.objects/LambdaEndpoint';
import { LambdaEndpointError } from '../../domain.objects/LambdaEndpointError';
import {
  getIsAncientErrorResponse,
  getIsContempErrorResponse,
} from './error/getIsLambdaErrorResponse';
import { getLambdaErrorMetadata } from './error/getLambdaErrorMetadata';
import { getStackTraceString } from './error/getStackTraceString';
import { asUnprefixedErrorMessage } from './serde/asUnprefixedErrorMessage';
import { getDecodedPayload } from './serde/getDecodedPayload';
import { getParsedJson } from './serde/getParsedJson';

/**
 * .what = reads a lambda's raw wire response, and throws whatever fault it carries
 * .why = this is the SERIALIZED boundary's hydration step — the one place a
 *        returned error envelope becomes a thrown error, which is what makes a
 *        caller's experience differ from the host's
 *        (`define.lambda-endpoint-run-boundary`)
 *
 * 🔴 **the branch order IS the contract, and it is precedence rather than a
 *    sequence of independent checks.** each branch wins over the ones below it:
 *
 * | # | when | it throws |
 * |---|---|---|
 * | 1 | the payload is absent or is not json | `LambdaEndpointError` |
 * | 2 | a CONTEMP envelope — `{ error: { _serde, class, … } }` | `ConstraintError` when `class` is one; else `LambdaEndpointError` |
 * | 3 | an ANCIENT envelope — `{ errorMessage, … }` | `ConstraintError` when `errorType` is `ConstraintError` **or** `BadRequestError`; else `LambdaEndpointError` |
 * | 4 | aws reported a `functionError` and no shape above matched | `LambdaEndpointError`, with the payload in `details` |
 * | 5 | none of the above | returns the payload as `TResponse` |
 *
 * ⚠️ **rows 2 and 3 split on the same question and answer it differently**, which
 *    is deliberate: a caller's bad request is not a lambda failure, so it
 *    hydrates to `ConstraintError` rather than to an invocation error
 *    (`invariant.badrequesterror-not-lambda-error`). the ancient arm accepts
 *    `BadRequestError` too, because that is the name the legacy family emits for
 *    the same fact (`invariant.ancient-vs-contemp-callers`).
 *
 * ⚠️ **row 4 reads aws's own verdict, and it only ever NARROWS** — the block at
 *    its site carries the argument.
 *
 * 🟡 **row 3 is LOOSER than its run-side peer by design** — it admits an envelope
 *    with no `errorType`, because a lambda that exceeds its duration answers
 *    exactly that shape. `getIsLambdaErrorResponse.ts` carries the argument.
 *
 * .note = three fulcrums cite this operation — **F16** (it was lifted here, so
 *   both callers share one serde), **F19/F20** (whether its two detectors should
 *   share one implementation with the run-side third), and **F17** (why the
 *   raw-wire test fixture must NOT route through it: this hydration is precisely
 *   what that instrument exists to observe from the outside).
 */
export const getParsedResponse = <TResponse>(input: {
  payload: Uint8Array | undefined;
  functionError: string | undefined;
  endpoint: LambdaEndpoint;
  exid: string | null;
}): TResponse => {
  // validate payload exists
  if (!input.payload) {
    throw new LambdaEndpointError('lambda returned empty payload', {
      endpoint: input.endpoint,
      exid: input.exid,
    });
  }

  // decode payload to string
  const payloadString = getDecodedPayload({ payload: input.payload });

  // parse json
  const parseResult = getParsedJson({ json: payloadString });
  if (!parseResult.success) {
    throw new LambdaEndpointError('lambda returned invalid json', {
      endpoint: input.endpoint,
      exid: input.exid,
      cause: parseResult.error,
    });
  }
  const parsed = parseResult.data;

  // detect contemp error response (preferred, check first)
  if (getIsContempErrorResponse(parsed)) {
    const err = parsed.error;

    // ConstraintError = caller's fault, not lambda error (lambda succeeded)
    if (err.class === 'ConstraintError') {
      // strip prefix to avoid double prefix (handler already prefixed the message)
      const message = asUnprefixedErrorMessage({ message: err.message });
      throw new ConstraintError(message, {
        endpoint: input.endpoint,
        exid: input.exid,
        causeMessage: err.cause,
        details: err.details,
      });
    }

    // all other error classes = lambda invocation error
    throw new LambdaEndpointError(err.message, {
      endpoint: input.endpoint,
      exid: input.exid,
      errorType: err.class,
      causeMessage: err.cause,
      details: err.details,
    });
  }

  // detect ancient error response (backwards compat)
  if (getIsAncientErrorResponse(parsed)) {
    const stackTrace = getStackTraceString({ stackTrace: parsed.stackTrace });
    const errorMeta = getLambdaErrorMetadata({ errorResponse: parsed });

    // ConstraintError/BadRequestError = caller's fault, not lambda error (lambda succeeded)
    // .note = check both for backwards compat with handlers that use old error types
    if (
      parsed.errorType === 'ConstraintError' ||
      parsed.errorType === 'BadRequestError'
    ) {
      // strip prefix to avoid double prefix (handler already prefixed the message)
      const message = asUnprefixedErrorMessage({
        message: parsed.errorMessage,
      });
      throw new ConstraintError(message, {
        endpoint: input.endpoint,
        exid: input.exid,
        stackTrace,
        ...errorMeta,
      });
    }

    // all other error types = lambda invocation error
    throw new LambdaEndpointError(parsed.errorMessage, {
      endpoint: input.endpoint,
      exid: input.exid,
      errorType: parsed.errorType,
      stackTrace,
      ...errorMeta,
    });
  }

  /**
   * 🔴 the LAST WORD goes to aws, because every branch above only GUESSES.
   *
   * `functionError` is aws's own verdict — `'Unhandled'` or `'Handled'` — and it
   * arrives from `sdkLambdaInvoke.ts:38` via `executeLambdaInvocation.ts:86`.
   * every branch above re-derives *"is this an error"* from the payload's SHAPE,
   * which is an inference; this one reads the ground truth.
   *
   * ⚠️ **without it, a fault aws reported whose payload matched neither envelope
   *    shape reaches the caller as a SUCCESS** — `rule.forbid.failhide` on a wire
   *    boundary, with the answer left unread in the input.
   *
   * ⇒ it only ever NARROWS, which is what makes it safe beside the shape branches:
   *
   *   | aws said | shape matched | absent this check | with it |
   *   |---|---|---|---|
   *   | fault | yes | throws, richly classified | **the same** — the branches above win |
   *   | fault | no | 🔴 returned as success | throws |
   *   | no fault | — | returns | **returns** |
   *
   *   it converts no throw into a return, so it cannot commit the inverse
   *   failhide that F20's branch A risks.
   *
   * 🟡 **and it does NOT fail open on the local locus.** `onSerialized.ts` passes
   *    `functionError: undefined` because there is no aws to ask, and `undefined`
   *    reads here as *"no verdict — trust the shapes"*. ⇒ aws is consulted where
   *    it spoke, never assumed silent where it could not.
   *
   * .note = `functionError` is a declared parameter, so it must be READ. a
   *   signature that accepts a verdict and never consults it advertises a check
   *   it does not perform, which is the shape a reader trusts and should not.
   */
  if (input.functionError)
    throw new LambdaEndpointError(
      // rule.require.errors-name-the-fix — the metadata shape carries no `hint`
      // field, so the fix rides in the message, which is what a human reads off
      // a stack trace first. `details.payload` carries the shape itself.
      'aws reported a function error, and the payload matched neither error envelope — read details.payload for what the handler actually emitted',
      {
        endpoint: input.endpoint,
        exid: input.exid,
        errorType: input.functionError,
        details: { payload: parsed },
      },
    );

  /**
   * .cast = TResponse
   * .why = caller specifies expected response type via generic; runtime validation
   *        occurs at endpoint via zod schema, not here
   * .removal = add runtime schema validation to askLambdaEndpoint when needed
   */
  return parsed as TResponse;
};
