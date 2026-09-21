/**
 * @rule-exception rule.forbid.failhide
 *   - location: invokeHandlerLikeAwsLambdaRuntime catch block
 *   - why: test harness simulates aws lambda runtime error surface behavior
 *   - errors-surfaced: yes — preserved in FunctionError response payload
 *   - scope: test asset only (__test_assets__), not production code
 */
import type { Context } from 'aws-lambda';
import { UnexpectedCodePathError } from 'helpful-errors';

import type { LambdaEndpoint } from '../domain.objects/LambdaEndpoint';
import { asLambdaEndpoint } from '../domain.operations/asLambdaEndpoint/asLambdaEndpoint';
import { createTestContext } from './createTestContext';

/**
 * .what = handler type compatible with genLambdaEndpoint output
 * .why = harness passes events with unknown shape, handler narrows
 *
 * note: eslint-disable for any is required because middy handlers
 *       have specific input types that we can't know at compile time
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (event: any, context: Context) => Promise<unknown>;

interface HarnessHandlers {
  [service: string]: {
    [fn: string]: Handler;
  };
}

interface LambdaInvokeResponse {
  StatusCode: number;
  FunctionError?: string;
  Payload: Buffer;
}

/**
 * .what = builds an error that mirrors the aws sdk ResourceNotFoundException
 * .why = real LambdaClient.send rejects (does not return a body) when a
 *        function is absent; the harness must surface the same shape so
 *        callers exercise their not-found error path faithfully
 */
const genResourceNotFoundError = (input: { functionName: string }): Error => {
  const error = new Error(`Function not found: ${input.functionName}`);
  error.name = 'ResourceNotFoundException';
  return error;
};

/**
 * .what = simulates aws lambda runtime's handler invocation with error surface
 * .why = aws lambda catches handler errors and surfaces them via FunctionError response
 *
 * .failhide-exception = aws-lambda-runtime-contract
 *   .rule = rule.forbid.failhide
 *   .why-not-hidden:
 *     1. errors ARE surfaced — preserved in FunctionError response payload
 *     2. askLambdaEndpoint detects FunctionError and throws LambdaEndpointError
 *     3. full error chain: handler throws → harness surfaces → caller throws
 *     4. error info preserved: errorMessage, errorType, stackTrace all passed through
 *   .why-no-rethrow:
 *     - aws lambda catches all handler errors and returns structured response
 *     - rethrow would diverge from aws lambda contract
 *     - tests must simulate real aws behavior to be valid
 *   .allowlist:
 *     - Error instances: transformed to aws lambda response (NOT hidden)
 *     - non-Error: rethrown (unexpected)
 * .scope = test asset only, not production code
 */
const invokeHandlerLikeAwsLambdaRuntime = async (input: {
  handler: Handler;
  event: unknown;
  functionName: string;
}): Promise<LambdaInvokeResponse> => {
  const context = createTestContext({ functionName: input.functionName });

  // use promise.then/.catch to match aws lambda's async error handler
  return input
    .handler(input.event, context)
    .then((result) => ({
      StatusCode: 200,
      Payload: Buffer.from(JSON.stringify(result)),
    }))
    .catch((error: unknown) => {
      // @failhide-exception: aws-lambda-runtime-contract (see function JSDoc)
      // allowlist enforcement: rethrow non-Error values (unexpected)
      if (!(error instanceof Error)) throw error;

      // allowlist: Error instances → transform to aws lambda response
      // error is SURFACED (not hidden): message, type, stack preserved in payload
      // askLambdaEndpoint detects FunctionError and throws LambdaEndpointError
      return {
        StatusCode: 200,
        FunctionError: 'Unhandled',
        Payload: Buffer.from(
          JSON.stringify({
            errorMessage: error.message,
            errorType: error.name,
            stackTrace: error.stack,
          }),
        ),
      };
    });
};

/**
 * .what = creates mock LambdaClient that routes to in-process handlers
 * .why = enables e2e tests without AWS credentials or network
 *
 * .usage
 *   const harness = createInProcessLambdaHarness({
 *     'svc-user': { getUser: myHandler },
 *   });
 *   // askLambdaEndpoint will invoke myHandler directly
 */
export const createInProcessLambdaHarness = (
  handlers: HarnessHandlers,
): {
  mockSdkLambda: jest.Mock;
  mockSend: jest.Mock;
} => {
  const mockSend = jest
    .fn()
    .mockImplementation(
      async (command: {
        input: { FunctionName: string; Payload: Buffer | Uint8Array };
      }) => {
        const fnName = command.input.FunctionName;

        // 🔴 the slug is parsed by the CANONICAL transformer, never re-derived
        //    here. a hand-rolled copy of `{service}-{access}-{function}` is a
        //    second speaker of one convention, and the two drift the moment the
        //    shape changes — this harness's own copy had already drifted, in the
        //    direction that matters: it omitted the `svc-` prefix check, so it
        //    admitted a slug `asLambdaEndpoint` refuses.
        //
        //    ⇒ a simulator that accepts a name the real address space rejects
        //      lets a test pass on an endpoint aws could never route to.
        //
        // .note = the catch is NARROW and converts rather than swallows. an
        //   unparseable name is exactly what aws answers with
        //   `ResourceNotFoundException`, so the conversion is what makes this
        //   simulator faithful. every other error class propagates untouched
        //   (`rule.forbid.failhide`).
        const endpoint = ((): LambdaEndpoint => {
          try {
            return asLambdaEndpoint({ slug: fnName });
          } catch (error) {
            if (!(error instanceof UnexpectedCodePathError)) throw error;
            throw genResourceNotFoundError({ functionName: fnName });
          }
        })();

        const handler = handlers[endpoint.service]?.[endpoint.function];
        if (!handler) {
          // aws sdk throws ResourceNotFoundException for absent functions
          throw genResourceNotFoundError({ functionName: fnName });
        }

        // parse input payload
        const payloadStr = Buffer.from(command.input.Payload).toString();
        const event = JSON.parse(payloadStr);

        // invoke via aws lambda runtime simulator (see function docs for failhide exception)
        return invokeHandlerLikeAwsLambdaRuntime({
          handler,
          event,
          functionName: fnName,
        });
      },
    );

  const mockSdkLambda = jest.fn().mockImplementation(() => ({
    send: mockSend,
  }));

  return { mockSdkLambda, mockSend };
};
