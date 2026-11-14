# F12 — `forAsk` carries aws-delivered sns and kinesis events

## .the fork

- **A** ship the schemas for use with `forAsk`, the path both evidenced handlers already run on
- **B** build `genLambdaEndpoint.forSns` / `forKinesis` in this wish, and ship the schemas as their
  record-level decode
- **C** ship the schemas, but document them as standalone validators only, not as a `forAsk` input

## .the tension

`invariant.ancient-vs-contemp-callers` grades "a `{ event, trail }` wrapper honored at an
aws-delivered family" a blocker. `forAsk` reads that wrapper (`CARRIER_ASK = 'wrapper'`,
`genLambdaEndpoint.forAsk.ts:29`). sns and kinesis are aws-delivered.

## .taken: A

- no new wrapper read: both evidenced handlers already call `forAsk`
  (`ahbode/svc-notifications`, `consumeSESEmailEventFromSNS.ts:68`,
  `consumeShortUrlCloudfrontLogFromKinesis.ts:74`)
- inert in practice: `getIsWrappedPayload` demands exactly the keys `event` and `trail`, and an sns
  or kinesis event has only `Records`
- B is a new contract (two families, per-record verdicts, a header carrier) the wish did not ask for
  (`rule.require.widen-before-parallel` counsels against an unasked peer). it is dreamt
- C hides the one place the schemas are useful

## .rework: clean — B is additive, and could reuse these schemas

## .confidence: 70%, why low

the invariant's enforcement list is written to catch exactly a new path for aws-delivered events.
the wisher may rule the paved path a blocker, and want B first.

## .verdict

**ruled A** — director, 2026-11-14 12:5xZ. `forAsk` carries aws-delivered sns and kinesis events
for this wish; the `forSns` / `forKinesis` families stay dreamt (yield q12).
