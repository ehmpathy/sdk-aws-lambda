import type { ZodIssue } from 'zod';

import { getZodIssuesSummary } from './getZodIssuesSummary';

describe('getZodIssuesSummary', () => {
  it('should transform zod issues to summary format', () => {
    // note: zod runtime issues include extra properties not in type definitions
    // use type assertion to match runtime behavior
    const issues = [
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['user', 'email'],
        message: 'Expected string, received number',
      },
      {
        code: 'too_small',
        minimum: 1,
        type: 'string',
        inclusive: true,
        exact: false,
        path: ['name'],
        message: 'String must contain at least 1 character(s)',
      },
    ] as unknown as ZodIssue[];

    const result = getZodIssuesSummary({ issues });

    expect(result).toEqual([
      {
        path: 'user.email',
        message: 'Expected string, received number',
        code: 'invalid_type',
      },
      {
        path: 'name',
        message: 'String must contain at least 1 character(s)',
        code: 'too_small',
      },
    ]);
  });

  it('should handle empty issues array', () => {
    const result = getZodIssuesSummary({ issues: [] });
    expect(result).toEqual([]);
  });

  it('should handle root-level path', () => {
    const issues = [
      {
        code: 'invalid_type',
        expected: 'object',
        received: 'string',
        path: [],
        message: 'Expected object, received string',
      },
    ] as unknown as ZodIssue[];

    const result = getZodIssuesSummary({ issues });

    expect(result).toEqual([
      {
        path: '',
        message: 'Expected object, received string',
        code: 'invalid_type',
      },
    ]);
  });
});
