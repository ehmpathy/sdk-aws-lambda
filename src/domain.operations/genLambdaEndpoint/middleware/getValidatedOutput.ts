import { MalfunctionError } from 'helpful-errors';
import type { ZodType } from 'zod';

import { getZodIssuesSummary } from './getZodIssuesSummary';

/**
 * .what = validates output against schema and returns typed result
 * .why = named transformer for decode-friction-free validation in orchestrators
 */
export const getValidatedOutput = <TOutput>(input: {
  response: unknown;
  schema: ZodType<TOutput>;
}): TOutput => {
  const result = input.schema.safeParse(input.response);
  if (!result.success) {
    const issues = getZodIssuesSummary({ issues: result.error.issues });
    throw new MalfunctionError('output validation failed', { issues });
  }
  return result.data;
};
