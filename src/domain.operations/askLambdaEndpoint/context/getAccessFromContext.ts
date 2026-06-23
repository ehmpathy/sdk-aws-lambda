import { MalfunctionError } from 'helpful-errors';

/**
 * .what = extracts access level from context
 * .why = named transformer for clear narrative in orchestrator
 *
 * .note = throws if access is not provided — no fallbacks
 */
export const getAccessFromContext = (input: {
  env: { access: string | null } | null;
}): string => {
  // require explicit access from context
  if (input.env?.access) return input.env.access;

  // fail loud: no fallbacks
  throw new MalfunctionError(
    'access not provided: context.env.access is required',
    {
      hint: 'pass env.access in context (test | prep | prod)',
    },
  );
};
