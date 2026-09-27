# trail

## .the term

`trail` — the observability lineage of **one invocation**, `{ exid, stack }`: the correlation id that
ties this invoke's logs to its producer's, plus the call stack the sdk has accrued.

```ts
invoke: ({ payload, headers, event }, { log }) => log.trail.exid
```

it rides `context.log.trail` in every family. ⛔ never a field on `invoke`'s input.

## .the placement — ambient, so context only

`rule.require.env-access-in-context` splits the two args by one question: is this what the caller
asks about, or the runtime it asks from? the lineage is runtime.

> *"ok then why would trail ever be on input if it should always be on context?"* ·
> *"forbid that crap"* — the wisher

both sqs variants' `[case1]` read the input key set at run time and assert no `trail` key, since a
slot re-declared on the type alone would type-check and still be wrong.

## .the etymology

adopted whole from `ehmpathy/sdk-logs`, which declares it:

```ts
// sdk-logs — src/domain.objects/LogTrail.ts
export interface LogTrail {
  exid: string | null;   // external id for request correlation
  stack: string[];       // the procedure call stack
}
```

this repo consumes the term; a rename here would fork a word it does not own.

| rejected | why |
|---|---|
| `headers` | a different concept — see below |
| `context` | the `(input, context)` contract owns it |
| `traceId` / `correlationId` | names one field, and asserts a w3c-trace shape this is not |
| `meta` | vague |
| `lineage` | the right sense with no source; `sdk-logs` already chose `trail` |

## .`trail` is not `headers` — raw versus reconciled

| slot | holds | form |
|---|---|---|
| `headers` | the metadata bag as the transport carries it | raw |
| `trail` | one lineage value, lifted out of whatever bag held it | reconciled |

a family may carry one and not the other: `forAsk` has a `trail` on the wire and no metadata
bag. the test for a collapse is *"is it the same concept?"* — one read of `LogTrail` settles it.

## .what the code does today — only the wrapper is read

```ts
// genTrailMiddleware.ts — a `before` hook on every family
const { exidFromPayload } = getUnwrappedEventWithExid({ payload: request.event });
const exid = exidFromPayload ?? `exid:${randomUUID()}`;
```

`getUnwrappedEventWithExid` matches one shape, the `{ event, trail }` wrapper `askLambdaEndpoint`
sends:

| family | inbound `exid` read? |
|---|---|
| `forAsk` | ✅ from `WrappedPayload.trail.exid` |
| `forApiGateway` | ⛔ generated — the envelope cannot match the wrapper |
| `forSqs.*` | ⛔ generated — `asSqsRecordDecoded.ts` reads no `exid` or `trail` |

so a producer that sets an `exid` on an http header or an sqs `messageAttribute` is ignored, and a
trace breaks at that boundary. that is unbuilt work. ⛔ never cite the per-transport lift as built.

## .the grain — one invoke, one lineage

a batch of ten messages is one invocation with one `trail`. `context` is handed once per invoke, so
a per-record trail has no slot to live in.

## .invariants

- `trail` is one invocation's lineage, `{ exid, stack }` — never a transport bag
- `trail` rides `context.log.trail` only; ⛔ an `input.trail` slot in any family
- `trail` sits at the invoke grain — never per record
- the type is `LogTrail` from `sdk-logs`, never re-declared here

## .enforcement

- a `trail` slot on any variant's `invoke` input = **blocker**
- a proposal to rename `trail` to `headers`, or merge them = **blocker**
- a `trail` re-declared locally = **blocker**
- a `trail` placed inside a record = **blocker**
- a doc that cites the http or sqs lift as built = **blocker**

## .see also

- `headers.md` — the bag `trail` is lifted out of
- `ehmpathy/sdk-logs` — `src/domain.objects/LogTrail.ts`
- `rule.require.env-access-in-context` — the test that places this value
