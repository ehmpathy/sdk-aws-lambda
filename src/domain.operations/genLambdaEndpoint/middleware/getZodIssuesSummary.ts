import type { ZodIssue } from 'zod';

export interface ZodIssueSummary {
  path: string;
  message: string;
  code: string;
}

/**
 * .what = transforms zod issues array into friendly summary format
 * .why = standard zod error format across validation boundaries
 */
export const getZodIssuesSummary = (input: {
  issues: ZodIssue[];
}): ZodIssueSummary[] => {
  return input.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
    code: issue.code,
  }));
};
