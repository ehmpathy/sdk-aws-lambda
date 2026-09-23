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

  /**
   * .what = a root-level fault names the root, rather than filling the slot with `''`
   * .why = this clamp asserted `path: ''` until a peer review measured what that renders as.
   *        the one site that prints a path beside a message emits `${path}: ${message}`, so an
   *        empty path produced `validation failed: : Invalid input: expected object, received
   *        string` — a bare double colon — and the metadata beside it read `"path": ""`. both
   *        say ABSENT where the truth is ROOT, and `helpful-errors` serializes the metadata
   *        into the message, so a caller met the ambiguity twice in one string
   *
   * .note = the two shapes a caller most often hits at the body border are BOTH root-level: a
   *         raw string (`deserialize: { body: false }`) and a null (any request with no body,
   *         on the DEFAULT path too). so this is the common surface, not an edge of it —
   *         `genZodBodyValidationMiddleware.test.ts` `[case5]` + `[case6]` snap both
   */
  it('should name the root when the path is root-level', () => {
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
        path: '(root)',
        message: 'Expected object, received string',
        code: 'invalid_type',
      },
    ]);
  });

  /**
   * .why = the repair must not reach a path that HAS segments. a `|| PATH_ROOT` guard over the
   *        joined string would misread this row as root-level, since its join is also `''` —
   *        so this is the row that proves the guard tests the ARRAY rather than the join
   */
  it('should leave a path that HAS segments alone', () => {
    const issues = [
      {
        code: 'invalid_type',
        path: [''],
        message: 'Expected string, received number',
      },
    ] as unknown as ZodIssue[];

    const result = getZodIssuesSummary({ issues });

    expect(result[0]!.path).toEqual('');
  });
});
