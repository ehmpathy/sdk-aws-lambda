# F9 — `genTrailMiddleware` now requires `{ carrier }`: a break to a public export

## .the fork

`genTrailMiddleware` is exported "for advanced use" — a consumer who builds their own middleware chain
calls it. execution gave it one required input, `{ carrier: 'wrapper' | 'headers' }`, because the
sdk's own two families read the caller's trail from two different places.

- A. required input — a bare `genTrailMiddleware()` fails to compile
- B. optional input, `'wrapper'` by default — a bare call keeps its behavior

## .taken = A, and why at the time

- B is a quiet failure. a consumer who builds an api gateway chain with a bare call would get the
  wrapper reader at a headers family: every caller reads ancient, no throw, no log, no type error
- A fails at compile, at the line that needs the choice
- `rule.forbid.undefined-inputs` points the same way

## .what it costs

a consumer who calls `genTrailMiddleware()` directly must add `{ carrier: 'wrapper' }` to keep the
behavior they have. that is a break to a public export, inside a release that is otherwise a fix. the
release type is the wisher's call (a `fix` commit would hide a break).

## .rework = clean

B is a one-line default.

## .confidence = 60%, low because

- the reach is measured only across ehmpathy: `git.repo.get lines --repos 'ehmpathy/*' --words
  'genTrailMiddleware'` returns 92 matches, all in this repo and none in any other (the positive
  control is the same form returning hits). a consumer outside the org is unmeasured
- the wisher said "no backcompat" about the 400 body, not about this signature

## .verdict

open — for the wisher. keep A (and mark the commit as a break), or take B.
