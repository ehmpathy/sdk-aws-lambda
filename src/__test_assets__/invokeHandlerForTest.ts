import type { Context } from 'aws-lambda';

import { createTestContext } from './createTestContext';

/**
 * .what = invokes a lambda handler with test context
 * .why = simplifies test setup with default context injection
 */
export const invokeHandlerForTest = async <TInput, TOutput>(
  handler: (event: TInput, context: Context) => Promise<TOutput>,
  input: {
    event: TInput;
    context?: Partial<Context>;
  },
): Promise<TOutput> => {
  const context = createTestContext(input.context);
  return handler(input.event, context);
};
