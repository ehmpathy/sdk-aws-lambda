# F08 — header keys are **lowercased**, not documented as unmeasured

**rework** clean · **status** 🔴 **RULED** — case-fold, per the wisher (was: A, 82%) · **confidence** settled

```ts
headers: THeaders;   // keys lowercased. rfc 9110 §5.1 — field names are case-insensitive
```

## the fork, stated fairly

`asUnifiedApiGatewayEvent` passes the header bag through **verbatim** — no case transform, either arm
(`asUnifiedApiGatewayEvent.ts:68`).

| option | what it is | |
|---|---|---|
| **A** ⛔ ~~ship it, document the bound~~ | `headers` lands with a `.note` that keys arrive as the wire delivered them | ⛔ **struck** — the `.note` is prose that defends an unrepaired form |
| **B** measure first, then ship | block a 7-line diff on a live deploy behind both api types | ⛔ still expensive, and now unnecessary |
| **C** ⇒ **case-fold to lowercase now**, both arms | one transform, and the caveat deletes | ✅ **RULED** |
| **D** do not lift `headers` at all | falls back to F02's option B | ⛔ over-corrects; it costs the gain and removes no hazard |

## ruled, and why

🔴 **the wisher ruled C on 2026-09-21**: *"why don't we standardize on all lowercase? … seems like a
low lift win."*

## 🔴 the reason A rested on measures FALSE

A's reason 2, verbatim: *"a lowercase[-fold] changes what `headers[k]` returns for **every** extant
consumer… that is a behavior break dressed as a rename."*

measured across `ahbode/*`, `src/**` — every count in the identical form:

| the read | files |
|---|---|
| an **inbound capitalized** header key | 🔴 **0** — the two `Authorization` hits are **outbound**, to yelp |
| `rawEvent.headers[…]` or `rawEvent.headers.…` — any index of the inbound bag at all | 🔴 **0** |
| `headers.authorization` — dot access, org-wide | **4**, all **caller-side outbound** (apollo link tests) |
| ✅ *control* — `{ authorization: … }` constructed, lowercase | 🔴 **68** in `svc-gateway` |

⇒ **"every extant consumer" is zero consumers.** the 65 production sites do not index the bag — they
**forward it whole** (`headers: rawEvent.headers`), which the paved shape already showed and the
reason never re-read (`rule.require.reread-the-subject-a-repeated-find-names`).

## 🔴 the find the measurement turned up — the hazard is LIVE, not hypothetical

A said the vendor claim was unmeasured and *"it may be that the versions agree and there is no hazard
at all."* two observations say otherwise:

| evidence | what it shows |
|---|---|
| the 4 app repos send **`Authorization:`** — capital — on the wire (`fetchAgainstSvcGateway.ts`) | the sender's case is **capitalized** |
| `svc-gateway`'s 68 fixtures construct **`authorization:`** — lowercase | every test asserts the **lowercased** form |

⇒ **the tests pass because they build lowercase; the wire delivers capitalized.** under v2 aws
lowercases and the two agree; under v1 they would not. so the suite is green on a case the deployment
may never produce — which is exactly the vacuous-fixture defect this entry already named
(`asApiGatewayRequestPayload.ts:31,66` hands one header object to both arms).

🔴 **and the vendor confirms the split is real:**

```js
// @middy/http-response-serializer/index.js:25
const acceptHeader = request.event.headers?.Accept ?? request.event.headers?.accept;
//                                          ^^^^^^     ^^^^^^ a vendor that must try BOTH
```

a library that reads `Accept` then falls back to `accept` is a library that has met both cases in
production. ⇒ **the case-fold is not merely safe — it makes that fallback unnecessary**, and the
vendor's `?? accept` arm catches our lowercased keys either way.

## ⚠️ what remains unmeasured, stated narrowly

**the read site is outside my reach.** nobody indexes the bag in any `ahbode/*` `src/**`, so the
`authorization` read happens inside a published package the gateway hands `handle({ headers })` to.
I have not read it.

⇒ so the honest bound of the verdict:

| | |
|---|---|
| ✅ measured | zero inbound index sites across every consumer repo's `src/**`, with a 68-hit control |
| ⚠️ **not measured** | what the downstream auth package indexes with |
| 🔴 the asymmetry that makes C safe anyway | if it reads **lowercase**, the fold fixes v1 and is a no-op on v2. if it reads **capitalized**, it is **already broken on v2 today** — so the fold cannot worsen a deployment that works |

## rework, and why clean

**clean.** one transform in `asUnifiedApiGatewayEvent`, both arms. to reverse is to delete it.

⚠️ it **is** a behavior change, and it owes the clamp `case=6` was written for — a test that goes red
on a capitalized key. ⇒ and `case=6`'s own recorded blocker (*"its `[tn]` cannot run yet: the fixture
hands one header object to both version arms"*) becomes the **first repair** the execution stage must
make, because the clamp cannot bite until the fixture can vary the case.

## what moves

| now | after |
|---|---|
| `asUnifiedApiGatewayEvent.ts:68` — verbatim passthrough | 🔴 lowercase both arms |
| `asApiGatewayRequestPayload.ts:31,66` — one header object to both arms | 🔴 the fixture must vary the case, else the clamp is vacuous |
| the ⚠️ key-case `.note` in the shape | 🔴 **deleted** — the form now carries it |
| `case=1`'s `[t3]`, left open with a named method | 🔴 closes — the method is no longer owed |
| `dreams/…fix.header-key-case-may-differ-between-v1-and-v2.md` | 🔴 **struck** — the deferral it records is now done |

## where

- `asUnifiedApiGatewayEvent.ts:68` — the passthrough this repairs
- `node_modules/@middy/http-response-serializer/index.js:25` — the vendor's own both-cases read
- `ahbode/app-*/src/data/clients/ahbodeGatewayRest/fetchAgainstSvcGateway.ts` — the capitalized senders
  ⚠️ **a FOREIGN path, quoted verbatim.** its `clients/` segment is another repo's directory name,
  not this repo's vocabulary — the same exemption `LambdaClient` holds under
  `rule.forbid.term-client`. ⛔ do not "correct" it: an edited path cites a file that does not exist
- **F04** — its twin: the other ⚠️ caveat struck on the same day, by the same move
- **F02** — the peer-slot fork whose confidence this entry once lowered; the fold removes that drag
- `rule.forbid.defended-exceptions` — the rule that grades the struck `.note` a blocker

## the verdict, once ruled

🔴 **RULED — C.** the wisher, 2026-09-21. lowercased, with A's cost estimate measured to zero and the
downstream read site recorded as the one residual.

⇒ **the entry's own last line predicted this**: *"what would change it: one probe."* it took three
greps rather than a deploy, and the probe that settled it was never the one this entry proposed.
