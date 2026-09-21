import { genLambdaSdk } from '../access/sdks/lambda/genLambdaSdk';
import { sdkLambdaInvoke } from '../access/sdks/lambda/sdkLambdaInvoke';
import { LambdaEndpointError } from '../domain.objects/LambdaEndpointError';
import { asLambdaEndpoint } from '../domain.operations/asLambdaEndpoint/asLambdaEndpoint';
import { getIsAncientErrorResponse } from '../domain.operations/lambdaEndpointWire/error/getIsLambdaErrorResponse';
import { getDecodedPayload } from '../domain.operations/lambdaEndpointWire/serde/getDecodedPayload';
import { getParsedJson } from '../domain.operations/lambdaEndpointWire/serde/getParsedJson';

/**
 * .what = simulates an ancient CALLER — one that predates this sdk — on the wire
 * .why = tests backwards compat with ancient callers: raw event, no trail wrapper,
 *   and the flat `errorMessage` response surfaced VERBATIM.
 *
 * 🔴 .why not `runLambdaEndpoint.onSerialized` — the verbatim part. `getParsedResponse`
 *    hydrates an ancient `BadRequestError` envelope into a `ConstraintError` and
 *    drops `errorType`, and after that hydration an ancient and a contemp constraint
 *    error are BOTH `ConstraintError`. so the one fact `[case2]` proves — *the
 *    handler chose the ancient dialect because the payload arrived unwrapped* — is
 *    no longer observable through the sdk's own caller.
 *
 * ⚠️ the sdk builder must stay `genLambdaSdk`. `[case9] [t3]` asserts one credential
 *    chain by a walk of `runLambdaEndpoint.ts`'s import graph; this file is a peer
 *    that graph never reaches, so a `new LambdaClient(…)` here sits outside it.
 *    ⇒ fork the RESPONSE path only; any other fork is a second credential chain.
 */
export const askLambdaEndpointAncient = async <TRequest, TResponse>(
  input: {
    which: { service: string; function: string };
    event: TRequest;
  },
  context: {
    env: { access: string; region: string };
  },
): Promise<TResponse> => {
  // build the endpoint from the selector + ambient access (computes slug = aws function name)
  const endpoint = asLambdaEndpoint({
    service: input.which.service,
    access: context.env.access,
    function: input.which.function,
  });

  // the sdk's OWN builder + invoker, so this fixture and the runtime path
  // authenticate identically and address the identical slug
  const response = await sdkLambdaInvoke(
    { slug: endpoint.slug, payload: input.event },
    { sdkLambda: genLambdaSdk({ env: { region: context.env.region } }) },
  );

  // check for invocation error
  if (response.statusCode !== 200) {
    throw new LambdaEndpointError('lambda invocation failed', {
      endpoint,
      exid: null,
      statusCode: response.statusCode,
    });
  }

  // check for absent payload
  if (!response.payload) {
    throw new LambdaEndpointError('lambda returned no payload', {
      endpoint,
      exid: null,
    });
  }

  // decode payload
  const payloadString = getDecodedPayload({ payload: response.payload });
  const parseResult = getParsedJson({ json: payloadString });
  if (!parseResult.success) {
    throw new LambdaEndpointError('lambda returned invalid json', {
      endpoint,
      exid: null,
      cause: parseResult.error,
    });
  }
  const parsed = parseResult.data;

  // 🔴 the DETECTION is shared; only the REACTION is forked. an instrument that
  //    disagrees with the sdk about what an ancient envelope IS reports on a wire
  //    nobody speaks.
  if (getIsAncientErrorResponse(parsed)) {
    throw new LambdaEndpointError(parsed.errorMessage, {
      endpoint,
      exid: null,
      errorType: parsed.errorType,
      causeMessage: parsed.causeMessage,
      details: parsed.details,
    });
  }

  return parsed as TResponse;
};
