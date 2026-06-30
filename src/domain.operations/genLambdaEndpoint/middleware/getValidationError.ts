import { ConstraintError } from 'helpful-errors';
import type { ZodError } from 'zod';

import {
  getZodIssuesSummary,
  type ZodIssueSummary,
} from './getZodIssuesSummary';

export interface ValidationErrorMetadata {
  issues: ZodIssueSummary[];
}

/**
 * .what = format issues summary for error message
 * .why = extract message format from orchestrator
 */
const getIssuesMessage = (input: { issues: ZodIssueSummary[] }): string => {
  return input.issues
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join('; ');
};

/**
 * .what = transforms zod validation error into ConstraintError
 * .why = callers need friendly error messages for invalid input
 */
export const getValidationError = (input: {
  error: ZodError;
}): ConstraintError<ValidationErrorMetadata> => {
  const issues = getZodIssuesSummary({ issues: input.error.issues });
  const issuesMessage = getIssuesMessage({ issues });

  return new ConstraintError<ValidationErrorMetadata>(
    `validation failed: ${issuesMessage}`,
    { issues },
  );
};
