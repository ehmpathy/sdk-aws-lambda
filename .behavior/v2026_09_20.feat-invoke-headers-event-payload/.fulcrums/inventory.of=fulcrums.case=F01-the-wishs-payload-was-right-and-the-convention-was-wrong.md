# F01 — the wish's `payload` was RIGHT; the repo's convention was wrong

**rework** clean · **status** 🔴 **RULED**, per the wisher · **confidence** settled
(**was: `request` at 90%** — struck, after two reversals)

⚠️ this file was `…case=F01-the-envelope-field-is-named-request-not-payload.md`. the slug asserted
the verdict that was struck, so it was renamed rather than left to mislead.

## the ruling

```ts
invoke: ({ headers, payload, event }) => …
```

| term | sense |
|---|---|
| `event` | **the whole object that arrived** — aws's word, every trigger |
| `payload` | **the body**, parsed and validated — http's word (rfc 9110, *"payload body"*) |
| `request` | ⛔ does not exist |

> *"http = api gateway, we treat the body as the payload, event is the whole object"*
> *"if it's better, i dont care if it breaks extant consumers"*
> — the wisher, 2026-09-20

## 🔴 the flaw that produced two wrong answers in a row

this entry originally argued the wish's `payload` was a defect, because `Payload` marks the
**wire form** in this repo (`ApiGatewayRequestPayload.ts:10-11`, ~250 lines). that argument was
internally sound and rested on a premise nobody examined:

> **aws and http disagree about "payload", and this family is http.**

| | "payload" means |
|---|---|
| **http** — rfc 9110, *"payload body"* | ✅ the **body**. the wish's sense |
| **aws** — `InvokeCommand.Payload` | the whole message. the convention's sense |

the repo had adopted **aws's** sense inside an **http** family. that forced `event` to narrow to
mean *the body*, which left the envelope with no word at all.

⇒ 🔴 **`rawEvent` is the scar of that inversion.** and `request` — the invented term this drive
proposed next — was reachable **only while the narrowing held**. once the body takes its correct
name, `event` is free and the invention is unnecessary.

## the four options, as they finally stood

| option | | |
|---|---|---|
| **A** `payload` = the whole envelope | the wish's literal words | ⛔ still an overload — `payload` is the body |
| **B** `request` = the envelope, `event` = the body | this drive's proposal | ⛔ **struck** — see the cracks |
| **C** `rawEvent` kept | — | ⛔ the defect under repair |
| **D** `event` = the envelope, `payload` = the body | the wisher's | ✅ **RULED** |

⇒ A and D differ by one level: the wish named the right *word* and attached it one level too high.
this drive read that mismatch as *"the word is wrong"* when it was *"the level is wrong."*

## why B was struck — four cracks

| crack | |
|---|---|
| **over-promises** | the value has no `cookies` (v2), no `multiValueHeaders` (v1) — a caller falls back to `_.raw` |
| **stutters** | `request.requestContext.requestId` |
| **invented** | the residue after four eliminations, not a word the domain handed over |
| 🔴 **rejects the vendor's word** | aws calls this value `event`, while the repo's case for `payload` was that vendor-adoption is a virtue. both could not hold |

⚠️ and B needed an **invariant fencing `request` inside one directory**, because an sqs payload is
`{ Records: [ … ] }` and no request exists there. **D needs no fence** — aws calls every trigger's
object an `event`, and every one has a body. D extends to `forSqs` for free.

## 🔴 the migration is loud — verified, not assumed

`event` keeps its spelling and changes its type, so the obvious worry is a silent meaning change.
measured against the real consumer:

| check | result |
|---|---|
| `handle`'s body param typed? | ✅ **yes** — `body: { jobUuid: string; providerUuid: string; … }` (`sendQuote.ts:34-39`). a stale `body: event` is a compile error |
| a stale `event.<field>` where the field is absent from the envelope | ✅ compile error — `UnifiedApiGatewayEvent` has no `.to`, `.jobUuid`, … |
| a stale `event.<field>` where body and envelope **collide** | ⚠️ would be silent. measured: `event.path` **0**, `event.httpMethod` **0**, `event.queryStringParameters` **0**, `event.pathParameters` **0**, `event.isBase64Encoded` **0** |
| the 6 non-zero hits (`event.headers` ×5, `event.requestContext` ×1) | ✅ **false positives** — raw-signature handlers that never call `invoke` |

⇒ **0 real collisions.** every stale site fails to compile. all counts carry the positive control
`rawEvent.headers` → **129**.

## ⛔ the narrow shape D permitted — **STRUCK by F13, 2026-09-21**

⛔ ~~the envelope exposes **no `event.payload`**. it carries `event.rawPayload` (the wire string)
and naught between, so the parsed-but-unvalidated body has no public surface.~~

⛔ ~~⚠️ without that, `payload` (validated `TInput`) would sit beside `event.payload` (parsed
`unknown`) — **one name, two levels, two types**. it would read as the `headers` / `event.headers`
pattern and is not: `headers` is a projection, that would be a transform.~~

🔴 **the paragraph was correct and the shape was wrong.** the hazard it named comes from the word
`unknown`, never from the slot — and `genZodBodyValidationMiddleware` **already writes the
validated value back** into `event.body`, which is why `event.body as TInput` is true at `logic`
time rather than merely hoped for.

⇒ so the wisher ruled the slot **in**, under the rename `body` → `payload` (**F13**). one word
removed the exception, the paragraph, **and** the `as`-cast at `forApiGateway.ts:223`.

| | |
|---|---|
| the ruled shape | `payload === event.payload`, one object — exactly as `headers === event.headers` |
| what it costs | `UnifiedApiGatewayEvent` gains a type parameter, so the write-back types |
| what it owes | the validator must **write back**, never parse into a side bag |

⚠️ the measurement in the struck paragraph still holds, and it is now an argument for the rename
rather than for the deletion: `rawEvent.body` → **0** consumer reads · `rawEvent.rawBody` → **0** ·
control **129**. **no consumer names either field**, so the rename is free in both directions.

🔴 and this entry is the record of a defect class: a **defended exception** — one peer that breaks
the set's own rule, kept in place by good prose. it survived three drafts and fell to a wisher's
one-line question (`rule.forbid.defended-exceptions`).

## rework, and why clean

**clean.** field names and type names; no behavior. and breakage was **ruled not a cost**, so the
usual counterweight does not apply.

## what it costs elsewhere

| | |
|---|---|
| `ApiGatewayRequestPayload` → `ApiGatewayEventWire` | `Payload` can no longer mark the wire form |
| `ApiGatewayResponsePayload` → `ApiGatewayResponseWire` | same |
| `forAskEndpoint`'s `WrappedPayload<TInput>` 🔴 **and `FlatPayload<TInput>`** | ⚠️ **two survivors** of the struck convention — each aws's whole-message sense, the two arms of `LambdaHandlerInput`. out of scope (F06); flagged, not fixed. ⚠️ this row named one until execution; the undercount left `payload.md`'s `.enforcement` exemption a peer short |

## where

- `1.vision.yield.md` → *the headline*, *the shape*
- `.agent/repo=.this/role=any/briefs/domain.terms/` → `event.md`, `payload.md`, `headers.md`
- **F05** reverts to A: `UnifiedApiGatewayEvent` keeps its name, and was right all along

## the verdict, once ruled

🔴 **RULED — D.** and the lesson outlives the entry: **a convention can be internally consistent
and still be wrong about the domain it sits in.** this drive checked that `Payload` was used
consistently and never asked whether the word meant, in http, what the repo had decided it meant.
