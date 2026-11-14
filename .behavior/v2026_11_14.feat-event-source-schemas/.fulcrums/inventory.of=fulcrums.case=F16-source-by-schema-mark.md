# F16 — the refusal line decides on the schema's source mark, not on the event's shape

## .the fork

- **A** (shipped) `forAsk` warns when the input schema an `asLambdaEventSchema.*` builder made
  (its data-only mark, read through zod's clone chain) meets a caller fault
- **B** (enroll-impl-arch-defects, i005 blocker.1) read the source off the event the step already
  keeps: `Records[0].EventSource === 'aws:sns'` / `.eventSource === 'aws:kinesis'`; delete the
  mark, its setter, its reader, its tests, and the parent walk

## .taken: A, as F9 was ruled

- the director scoped F9's warn to endpoints whose input an event-source schema built. B widens
  it to every `forAsk` endpoint that receives an aws-shaped body, hand-built schemas included.
  that re-rules F9's scope, which is the director's call, not the driver's
- B infers the source from the event's shape. a direct invoke whose body happens to be an aws
  envelope (a replay tool, a test) would warn though its caller reads the response
- A's gap is stated and clamped: `.refine()`, `.describe()`, `.meta()` keep the source; a wrapper
  (`.optional()`, `.nullable()`, `.default()`, `.transform()`, `.pipe()`, a union) loses it, the
  readme lists each, and the unit test pins each

## .for B, fairly

B decides on the fact the line reports (aws delivered this event), so no wrap can lose it, a
consumer with a hand-built `z.custom<SNSEvent>` gets the trace too, and the reader drops its tie
to zod's internal `_zod.parent`.

## .rework: clean — one transformer (`asLambdaEventSource({ event })`) replaces the mark read in
one step; the mark files and their tests delete; the two `forAsk` tables stay. no public contract
moves (the mark is internal)

## .risk: low — no credential, no prod write

## .confidence: 70%, why low

B is simpler and covers more consumers; A holds only because the director scoped F9. a director
who reads "every aws delivery to forAsk" as F9's intent flips this at once.

## .where

- `src/domain.operations/lambdaEndpointWire/frame/getOneLambdaEventSchemaSource.ts`,
  `setLambdaEventSchemaSource.ts`
- `src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/middleware/genLambdaEventRefusedLogMiddleware.ts`

## .verdict

open — best-guessed; the council rules at close.
