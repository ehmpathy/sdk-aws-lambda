import type middy from '@middy/core';
import { MalfunctionError } from 'helpful-errors';
import type { ZodSchema } from 'zod';

import { getZodIssuesSummary } from './getZodIssuesSummary';

/**
 * .what = middleware that validates handler output against zod schema
 * .why = ensures type-safe output before response is returned
 */
export const genZodOutputValidationMiddleware = <TOutput>(input: {
  schema: ZodSchema<TOutput>;
}): middy.MiddlewareObj<unknown, unknown> => {
  return {
    after: async (request) => {
      const result = input.schema.safeParse(request.response);

      if (!result.success) {
        const issues = getZodIssuesSummary({ issues: result.error.issues });

        throw new MalfunctionError('output validation failed', {
          issues,
        });
      }

      // replace response with validated data (includes defaults, transforms)
      request.response = result.data;
    },
  };
};
