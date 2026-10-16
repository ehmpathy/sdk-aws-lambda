# F1 — api-gateway 400 body stays ancient on a contemp frame

## .the fork

once trail unwraps before normalization, a contemp caller sets `isContempCaller = true` on the
api-gateway family. `genConstraintErrorMiddleware` then picks the body:

- A. honor it — the 400 http body becomes `{ error: { _serde, class, message } }`
- B. the family declares it always answers ancient — the 400 http body stays
  `{ errorMessage, errorType: 'BadRequestError' }`, identical to prod

## .taken = B, and why at the time

- the http body is the http contract; real api gateway clients only ever receive B's shape
- declapract#650 drops the ancient workaround; with A, every extant 400 assertion breaks on drop
- the family's own header note already claims "always-ancient by construction" — B makes that true
  by declaration instead of by accident
- the exid still travels on a contemp frame, so the frame's real purpose (trace) is kept

## .rework = clean

one option value on `genTrailMiddleware` (or its removal) and the 400 snapshot of the clamp test.
no caller hardens against it: contemp api-gateway calls 500 today.

## .confidence = 60%, low because

- the `onReferenced` doc table says contemp "must ANSWER the nested envelope". B reads that table
  as lambda-level (the api-gateway answer is always `{ statusCode }`, never an envelope), which is a
  judgment, not a fetched fact.
- 🔴 counter-evidence, found in review: `genConstraintErrorMiddleware.test.ts:421-436`
  (`[case11][t2] apiGateway mode`) asserts *"http response with contemp format for contemp
  callers"*. a prior author intended A at the middleware grain. it was never reachable through
  `forApiGateway` (entry 7 threw first), so it is intent, not a shipped contract.
- why B still: an acceptance test that asserts a 400 body prod never sends is a test whose green
  proves a shape no browser receives (`rule.forbid.acceptance.mocks` — acceptance must reflect
  reality). A is simpler (no option) and matches that unit case; B is truer to the wire.
- under B the unit case stays valid as written: it tests the shared middleware, which stays
  dialect-aware; only the api-gateway family declines to feed it a contemp flag.

## .where

`genLambdaEndpoint.forApiGateway.ts` middleware chain; `genTrailMiddleware.ts`.

## .verdict

**final verdict: A** — the commander, 2026-10-15, verbatim:

> contemp gets nested. no backcompat. if someone calls with dialect contemp, return dialect contemp.

this overrules the foreman's B (below, kept for the record).

the fork above was framed on the swap design, which is superseded by
`refs/foreman.design.trail-via-headers.md`: the opt-in is the `x-trail-exid` header, not a frame.
the verdict carries unchanged — an opted-in caller gets the nested body. consequences:
- no answer-dialect option; the shared constraint middleware already answers by `isContempCaller`
- `genConstraintErrorMiddleware.test.ts` `[case11][t2]` stays as is — it now describes reachable
  behavior; a family-grain test proves `forApiGateway` answers nested on a contemp frame
- the `forApiGateway` entry-1 note ("always-ancient by construction") is false after the swap and
  must be rewritten to state the dialect follows the caller
- foreman conditions 3 (clamp first, revert-to-red) and 4 (zero ancient-path snapshot diffs) still
  bind; conditions 1 and 2 are moot under A

superseded — foreman verdict, relayed 2026-10-15: keep B. record: `refs/foreman.verdict.F1.md`.

conditions carried into execution:
1. the family declares the ANSWER dialect once, at `forApiGateway`, via an option named for the
   answer — never by an overload of `isContempCaller`, which keeps its sense "the caller sent a frame"
2. `genConstraintErrorMiddleware.test.ts` `[case11][t2]` is not deleted blindly: still reachable at
   the middleware grain → keep it, and add a family-grain test that `forApiGateway` answers flat on
   a contemp frame
3. clamp first: case 1 red on 0.7.1, green after; revert only the swap, see red, restore
4. zero snapshot diffs on the ancient path; any diff there is a stop, raised to the foreman
