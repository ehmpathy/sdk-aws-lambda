# F21 — the envelope freeze reaches three variants, and NOT the fourth

| | |
|---|---|
| **rework** | clean |
| **status** | 🌙 **DISSOLVED** — the wisher ruled option **B**, 2026-09-25 |
| **confidence** | n/a — the fork is closed |
| **where** | `setEventFrozen.ts` · `genLambdaEndpoint.forAskEndpoint.ts` |
| **caught** | 2026-09-25, at the moment the two-axis sweep was walked past its third family |

## 🔴 the verdict, and why the fork was never a fork

> *"enrule that all the inputs must always be frozen"*
> *"silent mutables are the worst kind of landmine"*
> — the wisher, 2026-09-25

**B was taken: all four freeze.** the entry below stands as the record of what was argued and why
it was wrong; ⛔ a later reader must not mine it for a precedent.

🔴 **the axis this entry named — *what each variant has already shipped* — is a MIGRATION
SCHEDULE, never a property of the code.** the entry's own confidence section flagged that
("a reviewer may fairly hold that a safety guarantee should not bend to a migration schedule"),
listed it as one of the 20 doubt-points, and took A regardless. that instinct was the correct one.

⇒ the rule that replaced it keys membership to **the hand-off** rather than to any reader set or
consumer bill: `rule.require.frozen-invoke-inputs`. the freeze lands in
`genLambdaEndpoint.forAskEndpoint.ts`, clamped on three arms by `[case11]`.

---

_what follows is the record as it stood before the verdict._

## the fork, stated fairly

the freeze exists because *somebody reads the envelope after `invoke` returns*. the sweep that
found the sqs gap walked that cause on two axes, and the table it produced has **four** rows:

| family | a VENDOR reads it after | the SDK ITSELF reads it after | frozen |
|---|---|---|---|
| `forApiGateway` | 🔴 `@middy/http-cors` + `…response-serializer` | ⛔ | ✅ |
| `forSqs.perBatch` | ⛔ | 🔴 `idsInBatch`, built AFTER `invoke` | ✅ |
| `forSqs.perRecord` | ⛔ | ⛔ returns `void` straight after | ✅ |
| `forAskEndpoint` | ⛔ | ⛔ reads the RESPONSE only | ⛔ |

🔴 **rows 3 and 4 are identical on both axes, and differ in the outcome.** that is the shape
`rule.forbid.defended-exceptions` names: N members, one exception, and prose on top.

| | |
|---|---|
| **A — freeze three, not the fourth** | `forAskEndpoint` keeps a mutable `TInput`, and the difference is traced to an axis |
| **B — freeze all four** | one rule, no exception. `FrozenDeep<TInput>` on the ask variant's `invoke` bag |
| **C — freeze only where a reader exists** | drop the freeze from `perRecord` too, so the ⛔⛔ rows agree |

## taken, and why at the time

🔴 **A** — and the axis is **NEITHER column of the table above**.

⛔ *"it has no post-invoke reader"* is the answer that suggests itself, and it is **refuted by my
own `perRecord` decision**: that variant has none either, and freezes. to reach for it here would
be to apply one rule to row 3 and its inverse to row 4.

✅ the axis that does hold is **what each variant has already shipped**:

| variant | its callers today | what a freeze costs them |
|---|---|---|
| `forSqs.*` | ⛔ none — unreleased | zero |
| `forApiGateway` | `ahbode/svc-gateway`, 78 files | zero *extra* — this wish already migrates them |
| `forAskEndpoint` | 🔴 `ahbode/svc-home-services` ×4 | 🔴 **a SECOND migration** |

🔴 **and the wisher already ruled on exactly that repo.** the callable default
(`genLambdaEndpoint = Object.assign(forAskEndpoint, { … })`) exists for one reason, recorded in
`domain.terms/genLambdaEndpoint.md`: those four call sites pay **zero** for this wish —
*"a second migration, for a rename it gains naught from"*.

⇒ a freeze here reopens the bill the callable default was chosen to avoid. **that is a property
of the family's history that no edit to the code removes**, which is what makes it a second case
rather than an exception with a paragraph on it.

## ⚠️ why the cost is larger than it reads

`FrozenDeep<TInput>` is not merely a refusal to write. it makes `event` **unassignable to every
mutable parameter a handler forwards it to**:

```ts
invoke: async ({ event }) => await fulfilOrder(event)   // ⛔ FrozenDeep<Order> is not an Order
```

⇒ so the ripple reaches those handler **bodies**, rather than one line each. a rename is
mechanical; this is not.

⚠️ and that cost is **real for the api-gateway family too** — `payload: FrozenDeep<TPayload>`
already ships there. the difference is that `svc-gateway` is migrating in this release anyway,
so the friction rides a bill already sent.

## ⛔ why C is refused

C would drop the freeze from `perRecord` to make the ⛔⛔ rows agree. it trades a real guarantee
for a symmetry:

- `perRecord` hands the **same envelope shape** its twin hands. a guarantee that holds on one
  variant and not its peer teaches an author a habit that breaks the day they switch
  (`rule.forbid.parallel-codepaths`)
- `perRecord` is unreleased, so the freeze costs **zero** there. C pays a guarantee and buys
  naught
- and its column is empty **today**, never by construction. the moment it grows a post-invoke
  read, the twin's exploit is live there too

## why the rework is clean

B is one call and one type parameter, at one site. no snapshot asserts the ask variant's
mutability, and the repo's own suite would go green or red in one run.

⚠️ what is **not** clean is the consumer's half — and that half is outside this repo, so it is a
cost this record names rather than a rework this repo performs.

## the confidence, and why it is not higher

**80%.** the 20 points:

- ⚠️ **the axis is about a CONSUMER's bill, never about the code** — and a reviewer may fairly
  hold that a safety guarantee should not bend to a migration schedule. that read is sound
- ⚠️ **the pin cuts both ways.** `svc-home-services` sits at `0.3.0`, exact, so no release reaches
  it automatically. ⇒ *"it absorbs every break between its pin and its next upgrade anyway"* is a
  real counter-argument, and the same one `genLambdaEndpoint.md` records against itself
- ⚠️ a handler that mutates its own input event has **no legitimate reason to**, so the four call
  sites may well be untouched by B. 🔴 **unmeasured** — I did not read their bodies
  (`rule.require.positive-control-before-absence-claims`)
- ✅ what raises it above a coin flip: the wisher ruled on this exact repo, in this exact wish, and
  the ruling's whole subject was *keep this consumer's cost at zero*

## the sweep the cause implies

> **the cause**: *a guarantee applied to the families under the pen, and not to their peer.*

that sentence's subject is **every variant's `invoke` bag**, so the sweep is the four-row table at
the head of this entry — and it is walked, which is how row 4 was found at all. ⇒ the family is
**4**, three closed and one open by decision.

⚠️ **the membership rule for a future variant**: a new `for*` family inherits the freeze unless it
has shipped to a consumer whose bill is ruled. ⛔ never *"unless it has a post-invoke reader"*.

## the verdict, once ruled

🔴 **B — freeze all four.** recorded at the head of this entry.

## see also

- `setEventFrozen.ts` — the table, and this axis, at the declaration
- `domain.terms/event.md` — the family-wide invariant and its two-axis section
- `domain.terms/genLambdaEndpoint.md` — the callable-default ruling this entry rests on
- `rule.forbid.defended-exceptions` — the rule that demands this entry name an axis
- `rule.require.sweep-the-defect-class` — the axis trap that produced the four-row table
- F06 — the twin does not follow; the earlier instance of this same family bound
