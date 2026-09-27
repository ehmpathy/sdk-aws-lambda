# F13 — the envelope carries `payload`, and the deletion that defended it is struck

**rework** clean · **status** 🔴 **RULED** — one slot, one word, per the wisher · **confidence** settled

```ts
event.payload    // the body, validated. the SAME value the bag's `payload` holds
event.headers    // the headers. the SAME value the bag's `headers` holds
```

## the fork, stated fairly

| option | | |
|---|---|---|
| **A** the envelope exposes **no** body slot — `rawPayload` (the string) and naught between | avoids a name at two levels | ⛔ it defends a trap the slot itself creates |
| **B** ⇒ the envelope carries **`payload`**, and the bag projects it | one word, one value, two access paths | ✅ **RULED** |

## ruled, and why

🔴 **the wisher ruled B on 2026-09-21**: *"we should do `event.payload`, not `event.rawPayload` …
we should [make] that [consistent]."*

⇒ and B **deletes an `as`-cast the source already predicted would die**:

```ts
// forApiGateway.ts:217-223
// `genZodBodyValidationMiddleware` has already parsed it against `schema.input`
//  and replaced it with the parsed value
const response = await config.invoke({ event: event.body as TInput, rawEvent: event }, { log });
//                                                    ^^^^^^^^^^^
// .removal = drops when the input translate owns this seam
```

**at `logic` time `event.body` already IS the validated value.** the cast exists only because the
*type* says `unknown` while the *runtime* says `TInput`. ⇒ that is `rule.forbid.as-cast` exactly as
that rule states it: *an `as`-cast at a seam is the model's absent edge, asserted by hand.*

## 🔴 what this strikes — a whole section of the yield, and it was a DETAIL fix

⛔ ~~*"there is NO `event.payload`. the envelope carries `event.rawPayload` (the wire string) and
naught between, so the unvalidated value has no public surface to reach for by accident."*~~

that note, and the yield section under it, argued a real hazard:

> `payload` (validated `TInput`) beside `event.payload` (parsed `unknown`) — **one name, two levels,
> two types**. it reads as the `headers` / `event.headers` pattern and is not.

🔴 **the hazard is real and the remedy was wrong.** it is created by an **unvalidated** envelope slot,
never by the slot itself — and the chain already writes the validated value back into the envelope. so
the correct fix is the write-back that exists, not a deletion.

| | `headers` | `payload` — under A | `payload` — under B |
|---|---|---|---|
| bag ↔ envelope | one object | ⛔ no envelope slot at all | one object |
| the rule | projection | **exception** | projection |

⇒ under A the repo has one rule and one exception, and the exception needed a paragraph to defend it.
under B it has **one rule**.

## ⚠️ this is the drive's THIRD detail fix that defended a shape defect

| # | the detail fix | the shape defect under it |
|---|---|---|
| **F03** | manage `request`'s collision with middy's bag | `request` was the wrong word (F01) |
| **§1b** | rename `logic`'s local, which clashed with the field | `event` denoted the body (F01) |
| **F13** | delete the envelope's body slot, to dodge a two-types trap | the slot was named `body`/`rawBody` and never lined up with `payload` |

🔴 **each was argued well and refined across rounds, and each vanished when the shape was corrected.**
that is the signature `rule.require.review-attempts-deletion` names: a defense that improves while the
subject goes unread. ⇒ **the tell, stated for the next drive: a paragraph that exists to explain why
one member of a pair breaks the pair's own rule is a shape defect with good prose on top.**

## what moves

| now | after | why |
|---|---|---|
| envelope's `body: unknown` | 🔴 `payload: TInput['payload']` | it holds the validated body by the time any consumer sees it |
| envelope's `rawBody: string \| null` | 🔴 `rawPayload: string \| null` | it is the body's wire string, and `payload` is the body's word |
| `event.body as TInput` (`:223`) | 🔴 **deleted** | the type now states what the runtime already guarantees |
| `asInputAfter: (request) => request.event?.body` (`:357`) | `request.event` — the pair | moves with F12 |

⚠️ **`rawPayload` is itself open.** it measured **0** consumer reads, and `event._.raw` already carries
the wire union — so it may drop rather than sit beside `payload`. owed: a check of the sdk's **own**
internal reads before the claim is made. ⇒ recorded rather than assumed
(`rule.require.positive-control-before-absence-claims`).

## rework, and why clean

**clean.** it is a field rename plus a type widen on an internal envelope, and it **removes** a cast
rather than the reverse. measured consumer reach: `rawEvent.body` **0**, `rawEvent.rawBody` **0**,
control `rawEvent.headers` **129**. ⇒ no consumer names either slot, so reversal touches sdk-internal
lines only.

## where

- `UnifiedApiGatewayEvent.ts:19` — `body: unknown`, the slot this renames and re-types
- `forApiGateway.ts:215-223` — the cast, and its own `.removal` note
- `asUnifiedApiGatewayEvent.ts` — where the envelope is built
- **F12** — the schema shape that depends on this
- `rule.forbid.as-cast` · `rule.require.retest-the-model-on-every-family`

## the verdict, once ruled

🔴 **RULED — B.** the wisher, 2026-09-21. `rawPayload`'s survival stays open.
