# F6 — `x-trail-exid` is appended to an author-set `cors.headers`, not only to the default

## .the fork

the wisher ruled `x-trail-exid` joins the default `Access-Control-Allow-Headers`: *"yes, it should -
since we expect it"*. the default applies only when `cors.headers` is unset
(`forApiGateway.ts:235`: `cors.headers ?? 'content-type,authorization'`).

- A. append `x-trail-exid` always — default or author-set
- B. default only — an author who sets `cors.headers` must list it

## .taken = A, and why at the time

- "since we expect it" reads as an sdk-wide expectation, not a default to be overridden away
- under B an author who sets `cors.headers: 'content-type,x-api-key'` silently loses the header,
  and a browser that opts in fails its preflight with no hint

## .rework = clean

one merge in `corsInputToCorsConfig`; no consumer depends on its absence.

## .confidence = 75%, low because

- the wisher's words name the default; A extends them to the override

## .where

`genLambdaEndpoint.forApiGateway.ts` — `corsInputToCorsConfig`.

## .verdict

**ruled: A** — the wisher, 2026-10-15: *"agreed"*. `x-trail-exid` is appended to an author-set
`cors.headers` as well as the default.
