#!/usr/bin/env bash
######################################################################
# .what = scan every unstaged change (modified + untracked, gitignore
#         honored) with the timestamp hook's own patterns, before a stage
#
# .why  = .husky/check.timestamps.sh reads only the STAGED set, so a
#         clock time in a new file surfaces at commit, late. this runs
#         the same patterns over the whole worktree changeset, early
#
# usage:
#   rhx check.timestamps.sweep
#
# guarantee:
#   - patterns are read from .husky/check.timestamps.sh itself, never
#     copied, so the two cannot drift on what a clock time is
#   - the exempt-path skip (.ts/.sh) and the duration strip are
#     restated here, not read; keep them level with the hook by hand
#     (the hook's own header bars its skip list from a widen)
#   - exit 0 = clean, 2 = a clock time found (each listed), 1 = malfunction
######################################################################
set -euo pipefail

HOOK=".husky/check.timestamps.sh"
if [ ! -f "$HOOK" ]; then
  printf '💥 MalfunctionError: %s not found; run from the repo root\n' "$HOOK" >&2
  exit 1
fi

# load the hook's pattern assignments (and only those)
if ! PATTERNS=$(grep -E '^(CLOCK_COLON|CLOCK_DASH|ZONE|TIMESTAMP_PATTERN|DURATION_PATTERN)=' "$HOOK"); then
  printf '💥 MalfunctionError: could not read the patterns from %s\n' "$HOOK" >&2
  exit 1
fi
eval "$PATTERNS"

# collect changed files: tracked modifications + untracked, gitignore honored
if ! FILES=$(git -c core.quotepath=off ls-files --modified --others --exclude-standard); then
  printf '💥 MalfunctionError: git ls-files failed\n' >&2
  exit 1
fi

FOUND=0
while IFS= read -r file; do
  [ -n "$file" ] || continue
  [ -f "$file" ] || continue
  case "$file" in
    *.ts | *.sh) continue ;;
  esac
  match=$(sed -E "s/$DURATION_PATTERN//g" "$file" | grep -nIE "$TIMESTAMP_PATTERN" || true)
  if [ -n "$match" ]; then
    FOUND=1
    while IFS= read -r line; do
      printf '   ├─ %s:%s\n' "$file" "$line"
    done <<<"$match"
  fi
done <<<"$FILES"

if [ "$FOUND" -eq 1 ]; then
  printf '✋ ConstraintError: clock times found in changed files (listed above); mask each (e.g. 12:3x, [timestamp])\n' >&2
  exit 2
fi
printf '🐢 clean — no clock time in any changed non-.ts/.sh file\n'
