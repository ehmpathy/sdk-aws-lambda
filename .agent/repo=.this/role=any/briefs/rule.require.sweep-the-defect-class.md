# rule.require.sweep-the-defect-class

## .what

when you fix a defect, **grep for every peer that shares its shape** and check each one. a defect is
an instance of a class, and the fix is complete only when the class is swept — not when the instance
is repaired.

```ts
// the defect, found and fixed: this middleware's `onError` never ran, because the
// chain array registered it AFTER the error builders and middy reverses that order
genContentTypeCoherenceMiddleware(),   // moved to array index 0 ✅

// the SWEEP nobody ran: which OTHER middlewares in this same array declare an `onError`
// that opens with `if (request.response === undefined) return;`?
//   -> @middy/http-cors             (index.js:54-57)    ⛔ still dead
//   -> @middy/http-security-headers (index.js:250-253)  ⛔ still dead
// so every 400/500 shipped with no cors and no owasp headers, for the same reason,
// in the same file, in the same array.
```

## .why

a defect that reaches review has already proven two things: that the shape is **reachable**, and that
it is **invisible to the extant tests**. both properties belong to the class, never to the instance —
so every peer that shares the shape is presumed defective until checked.

- **the fix's own rationale is the grep.** once you can state *why* the defect happened ("hooks run in
  reverse of registration, so a step registered after the one it corrects never sees its output"), that
  sentence **is** a search: find each other place the sentence is true of. the expensive part — the
  diagnosis — is already paid for.
- **peers hide behind the fix.** a reviewer who reads the repaired line sees a correct line. the
  unswept peer three lines below looks unrelated, because its *symptom* differs (an absent header
  rather than a false one) even though its *cause* is identical.
- **convergent review does not sweep.** measured on the case that produced this rule: **five**
  independent reviewers found the hook-order defect on one middleware. not one of them asked which
  other middlewares in the same array shared the shape — because each was pointed at the diff, and the
  peers were unchanged context. a sixth reviewer, two iterations later, found them.
- **the sweep finds worse defects than the original.** on the same case, the sweep for "who else does
  this chain misconfigure" surfaced a **second, unrelated defect of far greater severity**: the sdk's
  own cors mapper emitted `origins: undefined`, which clobbered the vendor's `[]` default and threw a
  `TypeError` from the `after` hook — so **every success response of every handler configured with the
  documented `origins: '*'` wildcard was a 500.** the array form happened to survive, and the single
  extant cors test happened to use the array form. total outage of the common config, green suite,
  shipped.

## .the test — for the proposer

when you fix a defect, before you call it done, write the cause as one sentence and then answer:
**"what else is that sentence true of?"**

| the cause names | so grep for |
|---|---|
| a framework hook-order rule | every registration in that same array that declares that hook |
| a vendor's merge semantics (`{ ...defaults, ...opts }`) | every key you hand that vendor as an explicit `undefined` |
| a shape a guard misses (`if (!x) return`) | every guard in the family with the same predicate |
| a value at a boundary (a cast, a parse, an encode) | every other site that crosses the same boundary |
| a config field with two states | every consumer that branches on that field |

then check the **coverage** of each peer you find, not only its code. a peer that is correct today
with no test is the next instance.

and one shortcut tell: **the fix's comment cites a dependency's source line.** if you had to read a
vendor's dist to understand the defect, you hold a fact about that vendor that applies to every one of
its peers you use.

## ⚠️ .the pattern trap — a sweep that follows a SYNTAX is no sweep

this is the way a sweep most often fails, and it fails **silently**: the grep returns hits, you fix
them, and the class stays open — because the pattern you searched was narrower than the cause you
wrote down.

the trap has one shape: you read the defect's code, lift its **literal form** into a regex, and let
the regex define the family. but a cause is a **sentence about behavior**, and one behavior can be
written many ways.

measured on the stone that produced this rule, **twice, on the same branch**:

| the stated cause | the pattern grepped | what it could not see |
|---|---|---|
| *a hook that reads `request.response` above the error builders* | `if (request.response === undefined) return` — the two **vendor** middlewares' form | the sdk's OWN middleware, guarded `if (request.response)`. survived the sweep, a second sweep, and 11 reviewers |
| *a deliberate mutation of the middy request* | `request\.(response\|event)(\.\w+)*\s*=` — anchored on the **receiver** | `const { event } = request` then `event.body = …`. an alias hides the receiver, so a real hit read as a clean zero |

both times the pattern, never the codebase, set the answer. and both times the zero was
indistinguishable from an absence — which is why this trap and
`rule.require.positive-control-before-absence-claims` are the same defect at two grains.

**the move:** grep for the **subject** of the cause, then read each hit. never for the syntax of the
one instance you already fixed.

| the cause is about | grep the subject | never the form |
|---|---|---|
| who reads a slot | the slot name (`request.response`) | one guard's predicate |
| who mutates a value | the value, **and every alias of it** | one receiver expression |
| who calls a vendor helper | the helper name | one call's argument shape |
| who branches on a field | the field name | one branch's operator |

**the confirmation:** after the sweep, state the family **as a count** and say what defines
membership. *"3 middlewares declare `onError` and read `request.response`; 2 are correctly ordered,
1 is not"* is auditable. *"I grepped X and fixed the hits"* is not, because it records the pattern
rather than the class.

and when the subject grep returns more hits than you want to read, that is the signal that the class
is real — never a licence to narrow the pattern until the list is comfortable.

### ⚠️ and the subject may travel under TWO NAMES

*grep the subject* has one more level under it, and it is where the pattern trap survives its own
fix: **a subject that arrives under a different name in a different position is invisible to a grep
of the first name.**

measured on the same stone, one round after the subject-grep move was enbriefed:

> **the cause:** *a cast to reach a field this sdk itself wrote onto a lambda context.*
>
> that context arrives as **`request.context`** inside a middleware and as **`lambdaContext`** in a
> handler. I grepped `request.context` — a **receiver** of the cause rather than the cause — swept 8
> sites, and stated *"the family is 8"* in the record. a reviewer found the 2 `lambdaContext` sites
> the next round. the family was **10**.

the tell that separates a receiver from a subject: **read your own cause sentence and find its
noun.** if the noun is a *variable name* (`request.context`, `res`, `ctx`, `input.payload`), it is a
receiver, and the same value almost certainly has another name somewhere. if the noun is a *concept*
("a lambda context", "the response envelope", "the trail fields"), grep every name that concept goes
by.

**and one tell the code hands you for free: a doc comment that names its own duplicate.** on that
stone, one of the two missed sites said *"the twin of the cast in `forApiGateway`'s `logic`"* — in a
comment I had written myself one round earlier. **when a doc block points at a peer, the peer is in
the family; the code has already told you the count.** grep your own comments for `twin`, `same as`,
`mirrors`, `like the one in`, `see also` before you declare a family closed.

## ⚠️ .the second trap — a sweep bounded to ONE AXIS of the cause

the trap above narrows the **pattern**. this one narrows the **dimension**, and it is harder to see
because the sweep looks complete: you grep the right subject, you read every hit, you state the family
as a count — and the class is still open, because the cause has an axis you never asked about.

measured on the same stone, one round after the pattern trap was enbriefed:

> **the cause:** *a middleware whose hook reads a value another entry produces, placed on the wrong
> side of its producer, silently no-ops.*

that sentence names no hook phase. but the defect was **found** on `onError`, so every sweep — five
independent reviewers, then two of my own — swept `onError`. the framework runs `before` hooks in
**forward** array order and `after`/`onError` in **reverse**, so the identical cause has **two axes**,
and the `before` axis had never been swept at all. a sixteenth review round found it there.

⚠️ **and the documentation was the camouflage.** the file carried an *exhaustive* invariant block for
the `onError` axis — producers named, membership counted, severity stated. that thoroughness is
exactly what suppressed the question: **an invariant stated well on one axis reads as THE invariant.**
a reader checks their new entry against the axis on the page and never asks whether a second exists.

### .the test

after you state a cause, ask: **"what dimensions does this sentence leave unstated?"** then sweep each.

| if the cause names | ask also |
|---|---|
| a hook, a phase, a lifecycle step | **which other phases exist?** (`before` vs `after` vs `onError`; mount vs unmount; open vs close) |
| a direction | **and the other direction?** (inbound/outbound, read/write, encode/decode, up/down migration) |
| one end of a pair | **and the other end?** (client/server, producer/consumer, parent/child) |
| a success path | **and the error path?** — and the reverse |
| one environment or tier | **and the others?** (test/prep/prod, v1/v2, local/deployed) |

the tell that you have swept one axis only: **your family count is complete and your cause is silent
about the axis.** *"3 middlewares declare `onError` and read `request.response`"* is an auditable
count — of `onError`. the cause said "a hook", not "an `onError` hook", and that gap is the class.

### .the fix — document every axis, or the good axis hides the bad one

when you write the invariant down, enumerate the axes explicitly, even where one is currently
unviolated. a block headed *"THE INVARIANT"* that covers one axis is a **false completeness signal**,
and it costs more than no block at all: it tells the next reader their check is done.

```
⚠️ THE INVARIANT — it has TWO axes, because the framework holds the phases in opposite orders.
   state your entry's needs against BOTH before you place it.
   ── axis 1: `after` / `onError` — REVERSE array order ──   [rule + producers]
   ── axis 2: `before`            — FORWARD array order ──   [rule + producers]
```

## .the test — for the reviewer

for each fix in the diff, read its `.why` and ask: **"is this cause specific to this line, or general
to a family?"**

if general, grep the family yourself. the tells:

- a fix whose comment states a **rule of a framework** (order, merge, lifecycle) rather than a fact
  about this code. a rule has many subjects
- a fix in a **list, array, or registry**, where the peer entries were not touched. the list is the
  family, and it is right there
- a fix to **one** call of a vendor helper the repo calls in several places
- a **convergent** find — many reviewers, one line. convergence proves the defect was visible; it says
  not one word about whether it was singular. treat a 5-reviewer find as a prompt to sweep, never as
  reassurance that the sweep is unnecessary
- a fix whose test covers only the repaired instance, where a table-driven case could cover the family

## .the caveat

- **this is not a demand to refactor every peer.** the sweep is a **check**, and its output may
  legitimately be "the other three are fine, here is why". record that; an unrecorded sweep is
  indistinguishable from no sweep.
- **a peer outside the bound is still worth the check.** if the sweep finds a defect the wish does not
  cover, the correct move is to measure it, record it, and flag it — never to leave it unlooked-at
  because it would be out of scope to fix. an unmeasured out-of-scope defect is a guess; a measured one
  is a find the next traveler can act on.
- **the class may be narrower than it looks.** two lines that share a syntax do not share a cause. the
  sweep follows the **stated cause**, not the shape of the code.
- **one instance with no plausible peer needs no sweep.** a typo in a single string literal is not a
  class.

## .examples

### 👎 bad — the instance repaired, the class left open

```ts
const middlewares = [
  genContentTypeCoherenceMiddleware(),         // ✅ moved to index 0, onError now runs
  genConstraintErrorMiddleware(...),           // sets request.response
  genInternalServiceErrorMiddleware(...),      // sets request.response
  httpResponseSerializer(...),
  httpCors(...),            // ⛔ declares onError, guards on request.response, still dead
  httpSecurityHeaders(...), // ⛔ same
];
// the fix's own comment states the cause: "`after` and `onError` run in REVERSE of this
// array". that sentence is true of the two vendor entries too, and nobody checked.
```

### 👍 good — the cause written down, then swept

```
cause: a hook registered after the step it must follow runs BEFORE it, since middy `unshift`es
       `after` and `onError` and then runs the array in order.

sweep: every entry in this array that declares `onError`
  - genConstraintErrorMiddleware      -> sets the response; must run FIRST. ✅ correct
  - genInternalServiceErrorMiddleware -> same. ✅ correct
  - httpCors                          -> guards `if (request.response === undefined) return`
                                         and runs before the builders. ⛔ DEFECT
  - httpSecurityHeaders               -> identical guard, identical position. ⛔ DEFECT
  - genContentTypeCoherenceMiddleware -> ✅ fixed by this change

measured: one wire test with a cors-configured handler on BOTH paths. the success path is the
          positive control (both header sets present); the error path shows both absent.
```

## .enforcement

- a defect fix with no recorded sweep of the family its stated cause implies = **blocker**
- a sweep whose grep matched the **form** of the one fixed instance rather than the **subject** of
  its stated cause = **blocker** (the class is still open, and its zero reads as an absence)
- a sweep whose grepped subject is a **variable name** where the cause names a **concept**, with no
  check for the other names that concept travels under = **blocker** (measured: a family stated as 8
  was 10)
- a family declared closed while a doc comment in it points at a peer (`twin`, `same as`, `mirrors`)
  = **blocker** (the code named the family and the sweep did not read it)
- a sweep bounded to **one axis** of a cause that names no axis = **blocker** (the family count is
  auditable and the class is still open — measured 4 times on one branch)
- an invariant block that documents **one axis** of a multi-axis rule = **blocker** (a false
  completeness signal costs more than no block at all: it tells the next reader their check is done)
- a sweep recorded as *"I grepped X and fixed the hits"* rather than as a family count with a stated
  membership rule = **nitpick** (it records the pattern, so no reviewer can audit the class)
- a fix in a list/array/registry where the peer entries were not checked = **blocker**
- a sweep that finds a peer defect and leaves it **unmeasured** because it is out of bound = **blocker**
  (measure it and flag it; the fix may wait)
- a recorded sweep that concludes the peers are sound = false positive (that is this rule satisfied)
- a sweep that enumerates every axis of its stated cause, even where one is currently unviolated =
  false positive (that is the axis trap closed)
- a defect with no plausible peer = false positive

## .see also

- `rule.require.read-the-slot-a-dependency-reads` — the sweep's most productive target is a fact you
  learned from a vendor's dist, since it holds for every peer of that vendor you use
- `rule.require.positive-control-before-absence-claims` — a sweep that finds "this header is absent"
  owes a control that proves the middleware is wired at all; without it, a misconfiguration and a
  defect look identical
- `rule.require.clamp-edge-cases` — clamp the class, not the instance; and prove the clamp bites
- `rule.require.retest-the-model-on-every-family` — the same discipline at model grain: a model derived
  from one consumer must be re-tested against every consumer
- `rule.require.review-attempts-deletion` — "what else is my own stated cause true of?" is a deletion
  question
- `rule.require.snapshots-deny-volatile-not-allow-expected` — an allowlist snapshot cannot show a peer
  defect, because the peer's symptom is a field nobody named
