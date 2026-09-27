# F04 — the envelope is **deep-frozen**, not merely documented

**rework** clean · **status** 🔴 **RULED** — freeze it, per the wisher · **confidence** settled

```ts
event: Readonly<UnifiedApiGatewayEvent<{ headers: THeaders; payload: TPayload }>>
```

## the fork, stated fairly

`forApiGateway.ts:223` hands `invoke` the **same object** that lives at middy's `request.event`, by
reference. so a handler can write through it:

```ts
invoke: async ({ event }) => {
  event.headers['x-mine'] = 'oops';   // ⚠️ mutates what @middy/http-cors reads in `after`
  return { status: 204 };
}
```

| option | | |
|---|---|---|
| **A** ⛔ ~~document it read-only, clamp the consequence~~ | zero runtime cost; the hazard is named on the page | ⛔ **struck** — a `.note` that warns of a mutation is prose that defends an unfrozen object |
| **B** ⇒ **deep-freeze** what `invoke` receives | the hazard becomes unrepresentable; the projection survives | ✅ **RULED** |
| **C** hand `invoke` a defensive **copy** | also removes the hazard | ⛔ it destroys the projection — see below |

## ruled, and why

🔴 **the wisher ruled B on 2026-09-21**: *"it should be immutable, too"* … *"what we pass in."*

⚠️ **the prior entry closed with** *"this is the item I would most want the wisher to overrule me
on."* ⇒ it named its own weakness correctly, and the weakness was not the judgment but the **absent
measurement**: A rested on *"a freeze changes runtime behavior… neither cost has been measured"*, and
nobody ran it. see below — it measures to zero.

### 🔴 why C is the option that looks equivalent and is strictly worse

| | freeze | copy |
|---|---|---|
| the mutation hazard | ✅ removed | ✅ removed |
| `headers === event.headers` | ✅ **still one object** | ⛔ **two objects** |
| drift between the bag and the envelope | ✅ impossible | ⛔ re-opened |

**a copy trades one hazard for a worse one.** the whole argument for `headers` as a *projection*
rather than a second field is one-source-of-truth (`rule.forbid.parallel-codepaths` at the contract
grain); a defensive copy is that rule broken to satisfy this one. **freeze keeps both.**

## 🔴 the measurement A declined — zero writes, sdk-side AND vendor-side

### the sdk's own writes are all `before` hooks

| site | phase |
|---|---|
| `genApiGatewayEventNormalizationMiddleware.ts:31` — `request.event = …` | before (7) |
| `genTrailMiddleware.ts:46` — `request.event = unwrappedEvent` | before (8) |
| `genZodBodyValidationMiddleware.ts:55` — `event.body = result.data` | before (10) |

⇒ by the time `invoke` runs at `:223`, every sdk write is done. a freeze at that line breaks no sdk
code, because there is no sdk write left to break.

### the vendors read the slot and never write it

`rule.require.read-the-slot-a-dependency-reads` demands the **dist**, not the inference. all five
installed packages:

| package | reads `request.event` | writes it |
|---|---|---|
| `@middy/http-cors` | 3 — `index.js:38, 83, 106` | 🔴 **0** |
| `@middy/http-response-serializer` | 4 — `index.js:20, 22, 25, 28` | 🔴 **0** |
| `@middy/core` | 1 — `index.js:121`, hands it to the handler | 🔴 **0** |
| `@middy/http-security-headers` | **0** — it touches `request.response` only | 🔴 **0** |
| `@middy/http-json-body-parser` | 3, and it **does** write `request.event.body` (`index.js:25`) | ⚠️ **not in the chain** |

⚠️ **the last row is the one that needed the check.** the json body parser writes the event slot and
would break under a freeze — and it is **not imported anywhere in `src/`**. positive control: 16 files
import `@middy/`, and none import this one; the sdk parses the body itself in
`asUnifiedApiGatewayEvent`. ⇒ the incompatibility is real for a chain that adds it later, which is a
note the shape owes, never a reason to skip the freeze.

### ⚠️ the zero that was nearly a tool artifact

```sh
rhx grepsafe --pattern 'request\.event' --path node_modules/@middy   ->  0     ⛔ FALSE
```

`grepsafe` excludes gitignored files, so it cannot read `node_modules` at all — and the **control
returned the identical zero**, which is the only reason the artifact was caught. the real reads were
found with a tool that does read that scope.

⇒ **the sixth instance of this drive's defect class, and the second caught before it reached a
record** (`rule.require.positive-control-before-absence-claims`).

## rework, and why clean

**clean.** `Object.freeze` at one call site, plus a `Readonly<…>` on one type parameter. to reverse is
to delete both.

⚠️ it **is** a behavior change — a handler that mutates today throws tomorrow. but it throws
**loudly**, at the mutation, in strict mode, which is the opposite of the silent corruption A
tolerated. and the installed base for the mutation is zero: no consumer writes to `rawEvent`, because
the 78 sites read it and forward it.

## what moves

| now | after |
|---|---|
| `{ event: event.body as TInput, rawEvent: event }` (`:223`) | 🔴 the envelope is deep-frozen before it is handed over |
| `invoke`'s `event` type | 🔴 `Readonly<UnifiedApiGatewayEvent<…>>` |
| the ⚠️ mutation `.note` in the shape | 🔴 **deleted** — the form now carries it |
| `case=4`'s `[t2]`, which records the hazard | 🔴 re-aimed: it now clamps that the write **throws** |

## where

- `genLambdaEndpoint.forApiGateway.ts:223` — the hand-off, and the freeze's home
- `node_modules/@middy/http-cors/index.js:38,83,106` — the reads the freeze must not starve
- `node_modules/@middy/http-json-body-parser/index.js:25` — the one writer, and it is out of the chain
- **F08** — its twin: the other ⚠️ caveat struck on the same day, by the same move
- `rule.forbid.defended-exceptions` — the rule that grades the struck `.note` a blocker
- `rule.require.read-the-slot-a-dependency-reads` — the dist grep this entry owes and now holds

## the verdict, once ruled

🔴 **RULED — B.** the wisher, 2026-09-21. deep-frozen, measured safe across five vendor packages, with
the json-body-parser incompatibility recorded for whoever extends the chain.
