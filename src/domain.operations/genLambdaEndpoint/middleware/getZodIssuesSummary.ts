import type { ZodIssue } from 'zod';

export interface ZodIssueSummary {
  path: string;
  message: string;
  code: string;
}

/**
 * .what = the token a ROOT-level issue occupies the `path` slot with
 * .why = zod reports a root-level fault as an EMPTY path array, and the plain join of one is
 *        `''` — which renders as a bare `: ` at the one site that prints a path beside a
 *        message, and as `"path": ""` in the metadata `helpful-errors` serializes into that
 *        same string. both read as an ABSENT location rather than as the root, and the two
 *        shapes a caller most often hits at the body border — a raw string and a null — are
 *        BOTH root-level, so this is the common surface rather than an edge of it
 */
const PATH_ROOT = '(root)';

/**
 * .what = transforms zod issues array into friendly summary format
 * .why = standard zod error format across validation boundaries
 *
 * .note = this is the ONE place a zod path becomes a string, so the root token lands once and
 *         reaches every surface: the input border's message (`getValidationError`), and the
 *         metadata of BOTH borders (`getValidatedInput` + `getValidatedOutput`). a repair at
 *         the render site instead would have left the output border and the metadata unfixed
 */
export const getZodIssuesSummary = (input: {
  issues: ZodIssue[];
}): ZodIssueSummary[] => {
  return input.issues.map((issue) => ({
    path: issue.path.length ? issue.path.join('.') : PATH_ROOT,
    message: issue.message,
    code: issue.code,
  }));
};

/**
 * .what = renders a summary as the one-line `path: message` list an error carries in its title
 * .why = an error's `.message` is the only part a log line, a stack trace, or a caller's
 *        `console.error` shows without a decode of the metadata — so the PATHS have to be in it
 *        (rule.require.errors-name-the-fix: what went wrong, and where)
 *
 * .note = it lives HERE, beside `getZodIssuesSummary`, rather than at either border. the two
 *         borders throw different classes (`ConstraintError` in, `MalfunctionError` out) and
 *         name different fixes — but the RENDER of a path list is one guarantee, so it has one
 *         home (rule.forbid.parallel-codepaths). a copy at the second border is the copy that
 *         would rot, and the root-token note above already names every surface this must reach
 */
export const asZodIssuesMessage = (input: {
  issues: ZodIssueSummary[];
}): string =>
  input.issues.map((issue) => `${issue.path}: ${issue.message}`).join('; ');
