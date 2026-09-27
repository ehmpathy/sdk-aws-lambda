# F02 — `headers` earns a peer slot — ~~on external evidence only~~ **on 78 measured production reads**

**rework** clean · **status** open · **confidence** 🔴 **96%** — was 78%, then 71%, now the
**best-evidenced** call on this drive

## 🔴 the headline — this fulcrum's premise was inverted, and the title was wrong

it was titled *"on external evidence only"* because i measured **zero** in-repo header reads and
found one supporting doc in another repo. that framing survived three self-review rounds.

**measured in self-review 4/5:**

```
git.repo.get files --in ahbode/svc-gateway --words 'rawEvent' --paths 'src/**'   ->  78 files
```

and the shape they read it in:

> `ahbode/svc-gateway/src/contract/handlers/rest/mutation/sendQuote.ts:75-76`
> ```ts
> invoke: async ({ event, rawEvent }) =>
>   (await handle({ headers: rawEvent.headers, body: event })).body,
> ```

⇒ 🔴 **`headers: rawEvent.headers` — the exact hop this fulcrum debates, written 78 times in
production, by the sdk's largest consumer.** the wish's *"headers are the overwhelmingly common
non-body read"* was not a guess. it was **right, and i graded it unmeasured because i searched the
wrong org.**

⚠️ **the honest shape of the error**: i did not lack rigor — i ran a positive control, and it passed.
i pointed a verified instrument at `ehmpathy/*` and read its zero as *"org-wide"*. **`ahbode/*` is a
second org with ~25 service repos**, and `svc-gateway` carries a brief literally titled
`rule.require.lambda-handlers-use-genlambdaendpoint.md`.

⇒ **a control proves the instrument works; it says not one word about whether you aimed it at the
right place.** that is the lesson worth more than the number.

### what the number does now

| round | confidence | why |
|---|---|---|
| draft | 78% | one external doc; in-repo evidence zero |
| self-review 3/5 | 71% | F08's endorsement cost, previously argued away |
| **self-review 4/5** | **96%** | **78 production reads, in the exact shape `headers` deletes** |

the residual 4% is F08's real cost — a peer slot endorses a bag whose key-case behavior is still
unmeasured — and that cost is now plainly outweighed rather than merely argued against.

⇒ **option B (`{ event, request }`) is effectively closed.** to decline the peer slot is to leave 78
measured call sites one hop longer than they need to be, for a hazard that the two-hop form carries
identically.

---

## the original entry, kept

**rework** clean · ~~**confidence** 78%~~ — the thinnest call on this drive

## the fork, stated fairly

| option | |
|---|---|
| **A** `{ headers, event, request }` | **taken** — lift headers to a peer |
| **B** `{ event, request }` | a pure honest rename; headers stay one hop in |
| **C** `{ headers, method, path, query, event, request }` | four peers, per the wish's question 3 |

## taken, and why at the time

**A.** and the reason is *not* the wish's stated one.

the wish asserts headers are *"the overwhelmingly common non-body read at an http boundary"* — the
95% claim that earns the peer slot. **I measured it inside this repo and it is unsupported:**

- 97 `invoke:` sites across `blackbox/` and `src/`
- **zero** read headers
- **one** reads the envelope at all, and only for `httpMethod`/`path` — a test whose stated purpose
  is to prove the envelope is reachable

⇒ on in-repo evidence alone, **B** wins and **A** is a speculative widen
(`rule.prefer.wet-over-dry`).

what saves **A** is external, and it is a documented instruction rather than a guess:

> `declapract-typescript-ehmpathy/…/bad-practices/simple-lambda-handlers/.declapract.readme.md:33,35`
> *"…headers off a separate `rawEvent`"* · *"thread headers via `rawEvent.headers`"*

the org's own migration guide tells **every** service that moves onto this sdk to reach for headers
through this exact field. that is a named consumer with a named need.

**C is rejected** on the same measurement that nearly rejected A: `queryStringParameters`,
`pathParameters`, and `requestContext` have **zero** reads anywhere, in-repo or documented. four
peers would be four speculative widens.

⚠️ **self-review 4/5 — C's rejection is now the WEAKEST claim in this entry**, and i decline to
paper over it. the `ahbode/svc-gateway` find proved my org scope was wrong for `headers`; **the same
scope error applies to C's evidence**, and i did not re-run the per-field breakdown before the round
closed.

⇒ so C's rejection currently rests on the **in-repo** zero plus the **`ehmpathy/*`** zero — the
identical pair of scopes that got `headers` wrong. the check is one command:

```
git.repo.get files --in ahbode/svc-gateway --words 'rawEvent.queryStringParameters' --paths 'src/**'
git.repo.get files --in ahbode/svc-gateway --words 'rawEvent.requestContext'          --paths 'src/**'
```

⇒ **the execution stage owes that run before it finalizes the shape.** if either returns a large
count, the wish's own question 3 re-opens and **C** deserves a fresh hearing. if both return zero,
C stays rejected on evidence rather than on an unswept assumption
(`rule.require.sweep-the-defect-class` — the class here is *"a zero measured in the wrong scope"*,
and one instance of it was already proven).

## rework, and why clean

to drop to **B** is the removal of one field and one doc line. no caller is hardened against it,
because no caller exists. to add peers later (toward **C**) is purely additive and not a break.

⇒ **A is the reversible middle**: it costs one field if wrong, and it is the only option with any
evidence behind it.

## confidence, and why it is low

**71%**, down from 78% in self-review 3/5. one doc in one other repo is thin, and I am aware that I
*wanted* the wish's lead to survive somewhere. the honest statement is:

- the wish's reason for `headers` is **wrong as stated** (unmeasured)
- a **different** reason happens to hold
- ⇒ a reviewer who weighs the in-repo zero more heavily than the external doc reaches **B**, and I
  would not call that wrong

### 🔴 the 7-point drop — F08's own case contradicted its conclusion about this fulcrum

**F08** (the unmeasured header key-case) closed with: *"the hazard is orthogonal to F02's fork,
which is the reason F02's confidence does not move on this find."*

⇒ **that sentence is wrong, and F08's own body refutes it.** two paragraphs earlier it says: *"a
peer slot is an endorsement… to lift a field to the front of the input bag is to say 'reach for
this' — and to do that while one of its properties is unmeasured is to make an undocumented hazard
easier to meet."*

both cannot hold. the resolution:

| the claim | verdict |
|---|---|
| the hazard **exists** equally under A and B | ✅ true — `request.headers[k]` has the identical property |
| therefore the hazard does not bear on the A-vs-B choice | ⛔ **false** — A changes the hazard's **reach**, not its existence |

a peer slot raises the read's frequency, and a hazard's cost is `frequency × severity`. so A carries
strictly more expected cost than B while the case-behavior is unknown. that is a real argument for
**B**, and the first draft of F08 argued it away.

⇒ **it does not flip the decision** — the ergonomic gain is the wish's stated outcome, and the
hazard is documented rather than hidden. it does narrow the margin, so the number moves.

⚠️ the general lesson, recorded because it is the more useful half: **a fulcrum that declares itself
orthogonal to a neighbour has made a claim, and a claim about one's own work is the one least likely
to be audited** (`rule.require.trust-but-verify` — *"verify inherited claims, above all your own"*).
two fulcrums that touch the same field are not orthogonal by default.

## where

- `1.vision.yield.md` → *open questions → the assumption the wish makes that the measurement does NOT support*
- `1.vision.experience.case=1.read-a-header-in-one-hop.md`
- `1.vision.experience.dimensions.md` → axis A

## the verdict, once ruled

_open — awaits the fulcrum council._
