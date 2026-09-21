import type { Context } from 'aws-lambda';

import { asLambdaContext } from '../domain.operations/runLambdaEndpoint/context/asLambdaContext';

/**
 * .what = creates mock AWS Lambda context for tests
 * .why = enables handler tests without real AWS context
 *
 * .note = the defaults live in `asLambdaContext`, which ships. this supplies
 *   only the five labels this repo's own suite uses.
 *
 * ⚠️ so it INHERITS every change to `asLambdaContext` and announces none. among
 *    them: `done`/`fail`/`succeed` are a loud refusal rather than no-op stubs,
 *    because a no-op `fail(error)` swallows a callback handler's fault
 *    (`rule.forbid.failhide`).
 */
export const createTestContext = (overrides?: Partial<Context>): Context =>
  asLambdaContext({
    functionName: 'test-function',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
    awsRequestId: 'test-request-id',
    logGroupName: '/aws/lambda/test',
    logStreamName: 'test-stream',
    ...overrides,
  });

/**
 * .what = creates mock log methods for tests
 * .why = enables capture and verification of log output
 */
export const createMockLog = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});
