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
 * .what = transforms zod validation error into ConstraintError
 * .why = clients need friendly error messages for invalid input
 */
export const getValidationError = (input: {
  error: ZodError;
}): ConstraintError<ValidationErrorMetadata> => {
  const issues = getZodIssuesSummary({ issues: input.error.issues });

  return new ConstraintError<ValidationErrorMetadata>('validation failed', {
    issues,
  });
};
