import type { Context } from 'aws-lambda';

/**
 * .what = creates mock AWS Lambda context for tests
 * .why = enables handler tests without real AWS context
 */
export const createTestContext = (overrides?: Partial<Context>): Context => ({
  functionName: 'test-function',
  functionVersion: '1',
  invokedFunctionArn: 'arn:aws:lambda:us-east-1:123456789:function:test',
  memoryLimitInMB: '128',
  awsRequestId: 'test-request-id',
  logGroupName: '/aws/lambda/test',
  logStreamName: 'test-stream',
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {},
  callbackWaitsForEmptyEventLoop: true,
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
