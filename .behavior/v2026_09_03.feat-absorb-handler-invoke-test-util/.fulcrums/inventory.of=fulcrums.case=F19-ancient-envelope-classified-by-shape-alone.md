# F19 — the ancient envelope is classified by SHAPE alone, and the narrow trusts it

| field | value |
|---|---|
| **rework** | **dirty** on A/B · clean on C · clean on **D (F22)** |
| **status** | ✅ **CONTEMP half CLOSED by F22** 2026-09-13 (branch D — the dialect-fixed narrow pair); ancient half stays as the wire's own ambiguity |
| **confidence** | 76% → 84% → 88% → **91%** ⬆️ — three lanes converged, **and the settler ran**; see below |
| **raised** | i024, by **two lanes independently** — `ergo-friction-hazards` (scoped rerun, nitpick.2) and `enroll-impl-arch-defects` (r011) |
| **where** | `runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts` |

## ✅ resolved by F22 — the contemp half, WITHOUT branch A

the wisher ruled F22 (2026-09-13): the contemp envelope stamps its codec version, and the narrow
splits into a dialect-fixed pair. that is a **fourth** branch this row never priced:

| branch | what it does | verdict |
|---|---|---|
| A — runtime `dialect` arg | closes the erasure, but reverses F9 | 🔴 dirty — not taken |
| B — refuse ancient branch under `<'contemp'>` | impossible; `TDialect` erased | — |
| C — state the ambiguity in the hint | ✅ shipped earlier |
| **D — split into `…Contemp` / `…Ancient` peers** | the caller names the dialect by WHICH function they call, so the contemp narrow reads the tag ALONE and never runs the ancient shape check | ✅ **SHIPPED — F22** |

⇒ branch D shuts both quiet directions this row feared, and does it WITHOUT the runtime argument that
graded A dirty — a function choice is available at runtime where a type parameter is not, so **F9
stays intact**:

- `<'contemp'>` on an ancient value → the contemp narrow's tag check says no → `asLambdaEndpointErrorEnvelopeContemp` THROWS a ConstraintError. no silent `undefined`.
- the `+ plain error field` hybrid → the tag check is not fooled by a bare `error` field → same loud throw.

**the contemp half retains no open question.** the ANCIENT half is unchanged — the ancient wire has
no tag to stamp, so its shape heuristic is the wire's own ambiguity, not this code's. the `[case13]`
acceptance clamp was flipped from *"asserts the known limit"* to *"proves the closure"*, and both new
clamps are bite-proven (see F22).

## the fork, stated fairly

`isLambdaEndpointErrorEnvelope<TDialect>` decides whether a run output is an error envelope.

| dialect | what it reads | sound? |
|---|---|---|
| **contemp** | the `_serde: 'LambdaEndpointError::contemp'` **tag** | ✅ exact |
| **ancient** | the flat pair `{ errorMessage: string, errorType: string }` | 🔴 a **heuristic** |

⇒ a handler whose legitimate SUCCESS output happens to carry those two string keys is read as a
rejection. `asLambdaEndpointOutput` then throws on a run that succeeded.

## 🔴 and the unsoundness is sharper than the reviewer stated

the reviewer named the misclassification. **the read found a second half it did not name:**

`TDialect` is a *type* parameter, so it is erased at runtime — the predicate at `:47` takes
`output: unknown` and no dialect value at all. so:

```ts
isLambdaEndpointErrorEnvelope<'contemp'>(out)   // the ancient branch STILL runs
```

⇒ a **contemp** caller whose output matches the flat ancient pair is narrowed to
`LambdaEndpointErrorEnvelope<'contemp'>` — a type shaped `{ error: { … } }` that the runtime value
does not have. the caller then reads `.error.message` and gets `undefined`.

**that is a type the value never satisfies, handed out by a guard.** the misclassification is a wire
ambiguity; this is a soundness hole in the guard's own contract.

## the branches

| branch | what it does | rework |
|---|---|---|
| **A** — take a runtime `dialect` argument | the guard can then skip the ancient branch when the caller declared contemp | 🔴 **dirty** |
| **B** — refuse the ancient branch under `<'contemp'>` | ❌ **impossible.** `TDialect` is erased; the runtime cannot read it | — |
| **C** — state the ambiguity where it surfaces | the assert names the one case its diagnosis is wrong | ✅ **clean — SHIPPED** |

## why A is dirty — MEASURED, never asserted

this drive has been overruled three times (F13, F14, F16) for a CLEAN grade asserted from a mental
model of the blast radius. so this row measures first:

| what | measured 2026-09-11 |
|---|---|
| occurrences of the two exports | **59, across 12 files** |
| of those, the public barrel | `src/index.ts`, `src/publicSurfaceShapes.test.ts`, `src/advertisedExamples.test.ts` |
| the contract it would change | a **shipped public export's signature** |

🔴 **and A contradicts a RULED row.** F9 — *"the payload dialect travels in the return **type**"* — is
`✅ ruled`. branch A moves the dialect back into a runtime argument for this one operation, so it is
not merely a cost; it is a partial reversal of a verdict the wisher already gave.

⇒ that is what earns the dirty grade here, and it is a *structural* reason rather than an edge count
— which is precisely the distinction F16 got wrong.

## what shipped — branch C, and only the half that is clean

the assert's hint read, flatly:

> *"the handler rejected this event."*

under the ancient heuristic that is a **confident wrong diagnosis**, which sends an author to search
for a rejection that never happened. it now names the likely cause first and then the one case where
it does not hold.

⇒ this is the **F4 split** applied on sight: take the half that moves a real cost, leave the half
that needs a council. an author who hits the ambiguity now learns what happened from the error
itself, whichever way A is eventually ruled.

## 🔴 the second lane, and the direction it added

`enroll-impl-arch-defects` (i024 r011) reached this same code from the other end — the **mismatched
declaration** rather than the ambiguous shape — and it named a direction this entry had not priced:

| the caller declares | the value actually is | what happens |
|---|---|---|
| `<'contemp'>` | a **bare** ancient envelope | `.error.class` throws a bare `TypeError`. loud, but it names no fix |
| `<'ancient'>` | contemp | 🔴 **`.errorType` reads `undefined`. no throw at all** |
| `<'contemp'>` | ancient **+ a plain `error` field** | 🔴 **`.error.message` reads `undefined`. no throw at all** — see below |

⇒ **the quiet directions are `rule.forbid.failhide`'s exact shape**, in a tree that is otherwise
strict about it — and they are the worse cases, because a silent `undefined` teaches an author naught.

### 🔴 the THIRD direction, found at i027 — and it corrected a clamp that overstated itself

`enroll-impl-behavior-intent` (i027 r010) put the failhide as *"`.error.message` reads `undefined`,
no throw at all"*. **that did not match row 1**, which throws — so the sentence read as a reviewer
error, and the cheap move was to cite the extant clamp and move on.

⇒ **it was probed instead, and the words name a real case the entry had not held.** where the value
carries a non-envelope `error` field ALONGSIDE the ancient pair, the first hop resolves to the
handler's own data, the second reads a property that data does not carry, and no throw arrives:

```ts
{ error: 'a field of my own', errorMessage: '…', errorType: 'BadRequestError' }
```

⚠️ **and row 1's clamp had asserted a guarantee this case disproves.** it was named *"fails
loudly"* — true of the bare fixture it ran on, and **false of the narrow in general**. a reader takes
an assertion's NAME for its claim, so the name now carries the bound
(`…— ON A BARE ANCIENT VALUE`) and the third case sits beside it.

✅ clamped and bite-probed: a stub that refuses a value with an `error` field drops **exactly one**
test — the new one — so it is red on purpose the day a council closes the hole.

🟡 **the lesson is about the PROBE, not the find.** the review's sentence was wrong about the
mechanism it cited and right about the behavior it described. had it been graded on the mismatch it
would have been dismissed, and the case would still be open. ⇒ **probe a reviewer's words against
the code before you grade them against your own model of it.**

> *"The code's own docblock advertises this pair as delivering the 'F9 guarantee': a cross-dialect
> field access does not compile. That guarantee holds only when the declared `TDialect` happens to
> match the actual runtime shape — a fact enforced nowhere, only by author discipline."*

🟡 **and it named why 23 rounds missed it**: *"every fixture's declared `TDialect` matches its actual
shape."* the test file proved the guarantee only on the calls where it cannot fail.

✅ **both directions are now clamped as KNOWN** in `isLambdaEndpointErrorEnvelope.test.ts` — the pair
states what the guard does and does not promise, so an editor who "repairs" either meets a red test.
that is the same move the `errorType` asymmetry got at i023: where a limit cannot be *prevented*, the
intent is still worth an assertion.

🔴 **and at i025 the unit clamp was ruled the WRONG GRAIN for it** — `rule.require.test-coverage-by-grain`
puts a contract hazard at acceptance, not unit:

| grain | what it proves |
|---|---|
| unit (`isLambdaEndpointErrorEnvelope.test.ts`) | the narrow misbehaves on a **hand-built fixture** |
| acceptance (`local.sdkContract`, `[case13]`) | it misbehaves on **a real run output, through the published barrel** |

⇒ **different claims, and only the second is the one a migrant meets.** `[case13]` ships, bite-probed
— and it asserts a *known limit*, so it is red on purpose the day branch A lands. an editor who
closes the hole must come to the contract suite to delete it, which is where the limit belongs on the
record.

## 🟡 why the confidence moved 76% → 84% → 88% → 91%

**76% → 84%: two lanes reached the same defect from different directions, in one round, with no
shared premise.** one came via the wire's shape ambiguity, the other via the type parameter's
erasure — and they meet at the same three lines. that is convergent evidence of the kind this drive
has learned to trust over its own read.

**84% → 88%: a third lane arrived at i027, and it moved the row twice over.**

| what it supplied | why it prices in |
|---|---|
| a third independent arrival | three lanes, no shared text, one defect — the same evidence class that moved it to 84% |
| a **case the entry had not held** | the direction table was short a row, so the deferral had been priced against an incomplete hazard |

⚠️ **the second is the reason it is +4 rather than +2.** a lane that confirms a known hazard raises
confidence in the *diagnosis*; a lane that widens the hazard raises confidence that **deferral to a
council is the right call**, because the branch analysis must now answer three directions rather than
two — which is exactly the ripple that graded branch A dirty in the first place.

**88% → 91%: the settler ran, and it came back zero.** see the section below — 250 matches, 24 repos,
not one success payload shaped `{ errorMessage, errorType }`, spot-verified on a repo the lane did not
name. that converts branch C from a structural argument into a structural argument **plus a measured
zero**.

### what the measurement retired, and what still holds it short of 95%

this row carried **two defensible readings**. the measurement settles one of them:

| the reading | status |
|---|---|
| the ambiguity is **inherent to the ancient wire format** — no tag exists, so *no* classifier can do better, and a guard that pretends otherwise would be the lie | ✅ **backed.** and now backed empirically: nothing real collides |
| the **erasure** half is *not* inherent — a contemp caller declared their dialect and the guard discards it at runtime, which is this code's choice rather than the wire's | ⬜ **live, and untouched by the zero** |

⇒ **the second reading is what remains**, and the measurement cannot reach it: the three directions
collide an envelope with an envelope, so a search for stray success payloads answers a different
question.

🟡 **the two readings still disagree about whether the erasure is a defect or a fact** — that is what
a council is for, and it is why this row stays open rather than closes on a verdict a driver wrote.

## ✅ the settler — NAMED at i024, RUN at i027, and it came back zero

> does any real handler return `{ errorMessage: string, errorType: string }` as a SUCCESS?

**`enroll-impl-arch-defects` ran it: 250 matches across 24 repos, and not one is a success payload.**
every match sorts into four buckets, none of them the collision this row feared:

| bucket | what it is |
|---|---|
| retry / telemetry wrappers | `{ errorMessage: error.message }` built **inside a catch**, for a log — never a response |
| genuine ancient envelopes | `svc-images/resizeApi.ts:73`, `svc-heartbeat/apiGatewayHandler.ts:42` — correctly shaped errors |
| consumer assertions on **deliberate rejections** | every `invokeHandlerForTesting` / acceptance hit |
| frontend form state | `app-marketplace-web` — not a lambda envelope at all |

✅ **verified rather than taken on report.** the review's sharpest citation was re-read at source, and
so was a repo the review never named:

```
ahbode/svc-service-providers  → 4 matches · 2 retry wrappers · :63 destructures BOTH fields,
                                 :65 asserts 'provider does not exist for uuid' — a rejection
ahbode/svc-quotes             → 1 match  · { providerUuid, errorMessage: error.message } in a log
```

⇒ the buckets hold on a sample the lane did not choose, which is what makes the zero worth trust.

### 🔴 what the zero CLOSES — and the half it does not touch

| half of this row | what the measurement does to it |
|---|---|
| **the false positive** — a success payload misread as an envelope | ✅ **settled.** a real zero over 250 sites, so the hazard is real and **unexercised** |
| **the erasure** — a declared `TDialect` discarded at runtime | ⬜ **untouched.** the three directions collide *envelope against envelope*; no success payload is involved |

⚠️ **so the row does not close on this evidence, and the reviewer's own recommendation — *"close
F19/F20 at branch C"* — is right about the half it measured.** to close the whole row on it would be
to answer the question that was asked and bank it against the question that was not.

🟡 **and the measurement bounds itself**, in the reviewer's own words: *"bounded, as ever, to
`ahbode/*` local clones (the same floor every reach figure in this drive uses), but it's a real zero
over a non-trivial sample, not an absence of looking."* ⇒ a floor, stated as one — the same discipline
the vision's 318-site figure carries.

.note = **this section read *"this entry does not run it, and states plainly that it did not"* until
  i027.** the F14 lesson it cited — *a fulcrum which names a cheap settler and leaves it unrun is an
  unasked question* — was the right principle, and the search was genuinely out of this stone's
  reach. ⇒ **the ask on the record is what got it run**, by a lane with the reach the stone lacked.
  that is the mechanism at work, and it earns the note.

## 🔴 rule this row WITH F20 — raised at i026 by `enroll-impl-behavior-intent`

> *"**F19 and F20 are the same underlying soundness class** (a shape-heuristic classifying 'is this
> an ancient error envelope,' with no authoritative discriminator) surfacing on two boundaries at two
> different confidence levels … a single council ruling … would likely resolve both at once."*

✅ **taken.** the two rows ask one question at two boundaries:

| row | the boundary | what it trusts instead of a verdict |
|---|---|---|
| **this row** | referenced | the caller's **declared** `TDialect`, erased at runtime |
| **F20** | serialized | the payload's **shape**, where aws's verdict was in hand |

⇒ **the shared question is one line: may a classification rest on a declaration or a shape, where an
authoritative signal exists or could?** ruled apart, the two can produce answers that do not compose.

🟡 **and F20's branch E is already evidence for one half of it** — on the serialized boundary the
authoritative signal turned out to exist, to be free to consult, and to have hidden a live failhide
for the whole drive. this boundary has no such signal available, which is precisely the asymmetry a
council should weigh rather than assume.

⚠️ **that asymmetry is a THREE-way split, never the two-way one this section drew** — corrected at
i038 r011 (D1), which found the serialized half reaches both loci:

| boundary | an authoritative verdict? |
|---|---|
| serialized, `at: 'cloud'` | ✅ aws's `functionError` — what branch E consults |
| serialized, `at: 'local'` | 🔴 **none.** `onSerialized.ts:358` passes `functionError: undefined` |
| referenced (this row) | 🔴 none, and none could exist — there is no wire to render a verdict |

⇒ so *"the serialized boundary has a signal"* is true of one locus of two, and **the local locus sits
in the same evidential position as this row** — it classifies by shape with no verdict available.
a council that prices the two rows apart on *"one has a signal, one does not"* is short a case.

## .see also

- `F20` — the same soundness class on the serialized boundary. rule the two together
- `F9` — dialect-as-a-generic, `✅ ruled`. branch A partially reverses it
- `F12` — the error shape is not independently overridable. same surface, adjacent fork
- `rule.always.fix-forward-under-scouts-honor` — the SAFE/CLEAN split that let C ship now
