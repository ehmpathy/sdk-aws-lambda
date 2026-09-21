# inventory.of=fulcrums

design forks best-guessed mid-drive. each row has an entry file. the council reads this at the
close, sorted by `rework`.

## the inventory

| case | title | rework | status | confidence |
|------|-------|--------|--------|------------|
| [F1](inventory.of=fulcrums.case=F1-faithful-passthrough-not-never-throw.md) | the util is a faithful pass-through, not a never-throw | clean | ✅ **ruled** — wish **A3** | — |
| [F2](inventory.of=fulcrums.case=F2-the-name.md) | it is named `runLambdaEndpoint.{onSerialized,onReferenced}` | clean | ✅ **ruled** | — |
| [F3](inventory.of=fulcrums.case=F3-flat-payload-default.md) | the default payload is **contemp**; flat is opt-in | clean ⬇️ | ✅ **ruled** — flipped | — |
| [F4](inventory.of=fulcrums.case=F4-ship-from-root-barrel.md) | it ships from the root barrel, not a subpath | clean | 🔴 **ruled by the wisher 2026-09-10 — load-time half TAKEN**; install/bundle half stays open | 85% → 70% → **ruled in part** |
| [F5](inventory.of=fulcrums.case=F5-assertion-helper-in-scope.md) | ~~an envelope-aware assertion **reader**~~ · the union **narrow** ships | clean | 🔴 **superseded in its LARGE half only** | — |
| [F6](inventory.of=fulcrums.case=F6-context-override-surface.md) | the lambda `Context` is overridable, and partial | clean | open | 88% |
| [F7](inventory.of=fulcrums.case=F7-handler-agnostic-not-endpoint-bound.md) | the util is handler-agnostic, not `genLambdaEndpoint`-bound | clean | open | 91% |
| [F8](inventory.of=fulcrums.case=F8-promise-only-handlers.md) | the util takes promise-style handlers only, not callback-style — **and now refuses them LOUDLY** | clean | open ⬅️ **shape changed last** | 82% → **90%** ⬆️ |
| [F9](inventory.of=fulcrums.case=F9-dialect-as-a-generic.md) | the payload dialect travels in the return **type** | clean | ✅ **ruled** | 90% |
| [F10](inventory.of=fulcrums.case=F10-wire-faithful-event-factories.md) | the event factories are **wire-faithful** by default — they send what aws sends | clean | open | 94% ⬅️ highest |
| [F11](inventory.of=fulcrums.case=F11-trail-never-selects-the-dialect.md) | `trail` carries the exid and **never** selects the dialect — the frame derives from `struct.payload` | clean | ✅ **RULED 2026-09-11 — (a): the code stands, the demo was already amended** | 92% — **and the 92% held** |
| [F12](inventory.of=fulcrums.case=F12-error-shape-not-independently-overridable.md) | the error shape derives from `struct.payload`; it is **not** independently overridable | clean | open | 93% |
| [F13](inventory.of=fulcrums.case=F13-run-output-type-vs-the-strip.md) | ~~the run output type does **not** model the JSON strip — clamped and deferred~~ → **REPAIRED**: `WireStripped<T>` | clean | 🔴 **closed — overruled at r006** | 78% — **and the 22% held the truth** |
| [F14](inventory.of=fulcrums.case=F14-snapshot-tests-auto-accept.md) | ~~every snapshot test auto-accepts — clamped and deferred~~ → **REPAIRED**: `[ -n "$RESNAP" ]` | clean | 🔴 **closed — I overruled myself at r008** | 88% — **and the premise was measured false** |
| [F15](inventory.of=fulcrums.case=F15-optional-inputs-on-the-sdk-boundary.md) | optional inputs stay on the sdk boundary — the rule's REASON over its directory | clean | open | 90% |
| [F16](inventory.of=fulcrums.case=F16-getparsedresponse-stays-in-asklambdaendpoint.md) | ~~`getParsedResponse` stays in `askLambdaEndpoint`'s serde~~ → **LIFTED** to `lambdaEndpointWire/` | clean | 🔴 **ruled by the wisher 2026-09-10 — LIFT. shipped** | 72% — **and the 28% held the truth** |
| [F17](inventory.of=fulcrums.case=F17-ancient-caller-fixture-stays-raw-wire.md) | the ancient-caller fixture **stays**, as a raw-wire instrument — its drift is repaired instead | clean | open ⬅️ **the second row that overrules a lane** | 93% |
| [F18](inventory.of=fulcrums.case=F18-round-id-citations-in-shipped-docblocks.md) | shipped docblocks **narrate the drive** (`rule.forbid.chronological-accretion`, blocker-class — the VOICE half) AND cite a review round **never committed** (the CITATION half, one line in `bhrain`). ⚠️ **the count lives in the entry** — it has moved UP, not down | clean on C, **dirty on A/B (the sweep)** | open ⬅️ 🔴 **raised SEVEN times; VOICE half named as a rule violation at i044 r011** · re-measured at i037: the backlog GROWS | 88% |
| [F19](inventory.of=fulcrums.case=F19-ancient-envelope-classified-by-shape-alone.md) | the ancient envelope is classified by **shape alone**, and `TDialect` is erased so a contemp caller gets the ancient branch too — in **three** directions, two of them silent | clean on C (**shipped**), **dirty on A** · clean on **D (F22)** | ✅ **contemp half CLOSED by F22** (branch D — the dialect-fixed pair); ancient half stays — inherent wire ambiguity | 76% → 84% → 88% → **91%** ⬆️ |
| [F20](inventory.of=fulcrums.case=F20-three-drifted-ancient-error-detectors.md) | *"is this an ancient error envelope"* is answered **three times** — and at i028 two of the three proved to answer **different questions**, so the collapse is LOSSY | clean on C+**E** (**both shipped**), **dirty on A/D** | ✅ **contemp third UNIFIED + EXACT via F22**; ancient thirds differ by boundary — do NOT collapse | 81% → 89% → 92% → **95%** ⬆️ |
| [F21](inventory.of=fulcrums.case=F21-a-wrapper-defeats-the-arity-guard.md) | a **spread-relay wrapper** defeats the callback-handler arity guard — `.length` resets to 0 — and the obvious remedy refuses a legitimate **sync** handler to catch it | **clean** | open · ✅ **the settler RAN, and the population is now measured** — 252 spread-relays / 23 repos against **0** production callback handlers, so the conjunction the defect needs is empty | 60% → **88%** ⬆️ |
| [F22](inventory.of=fulcrums.case=F22-the-envelope-stamps-its-codec-version.md) | the contemp envelope stamps its **codec version** — `LambdaEndpointError::contemp@$version` — so *"no tag → not a contemp envelope"* is EXACT rather than a heuristic | clean | ✅ **RULED + IMPLEMENTED 2026-09-13** — gates green, both clamps bite-proven ⬅️ 🔴 **it ANSWERS the F19/F20 council** on its contemp half, and closes a live failhide | — |
| [F23](inventory.of=fulcrums.case=F23-asklambdaendpoint-coerces-an-unknown-dialect.md) | `askLambdaEndpoint` **silently coerces** an unknown dialect to contemp; its peer `runLambdaEndpoint` **throws** on the same input — one concept, two validation stances | **dirty** on the repair (safe 🔴), **clean** on the record | open ⬅️ **the RECORD gap named at i040/i041 §1a, now closed**; the repair stays deferred (shipped production caller) | 88% |
| [F24](inventory.of=fulcrums.case=F24-onserialized-fuses-dispatch-with-two-leaf-executions.md) | `onSerialized` fuses dispatch with two leaf executions (cloud delegates, local runs) — the extract was declined **five times** and never recorded as a fork | **dirty** on the extract (A), **clean** on the record (B) | open ⬅️ **the RECORD gap named at i044 r011, now closed**; the extract stays deferred (core dispatch file, no CI to confirm a move) | 85% |

## 🔴 F22 answers the F19/F20 council — ruled 2026-09-13

**the council question was answered by a move neither row had priced.** both rows asked *may a
classification rest on a declaration or a shape, where an authoritative signal exists or could?* —
and every branch on the board took the absent signal as a given.

⇒ the wisher's answer: **make the signal exist.** stamp the codec version on the contemp envelope,
and *"no tag → not a contemp envelope"* becomes exact.

| row | its contemp half | its ancient half |
|---|---|---|
| **F19** | ✅ **closed by F22** — the tag is authoritative, so the shape fallback no longer runs under a contemp declaration | ⬜ open, and **inherently so** — the ancient wire carries no tag to stamp |
| **F20** | ✅ same, on the serialized boundary | ⬜ open — and branch E already reads aws's verdict on the cloud locus |

🟡 **and it keeps F9 rather than reverses it.** branch A would have moved the dialect into a runtime
argument; F22 instead splits the predicate into a `Contemp`/`Ancient` pair, so the caller names the
dialect by which function they call — a runtime choice where a type parameter could not reach.

🔴 **as shipped 2026-09-13, refined by the wisher in the same session.** three facts:

- the version is a **codec** integer (`@1`), never the package version — a codec version bumps on a
  wire-format change, not per release, and `tsconfig.build.json`'s `rootDir: "src"` bars a
  `package.json` import besides.
- the detector is **ONE boundary**, not a bare/versioned fork — the wisher flagged *"why a branch?
  why degrees of freedom accretion?"* and it collapsed to `/^prefix(@|$)/`. the reframe:
  **absence of `@version` IS version 0**, the pre-F22 (v0.3.0) producer, which `origin/main`
  confirms emits the bare tag. the wire's two-shape tolerance is finite and dies once every producer
  passes F22; the code branch was the avoidable accretion, and it is gone.
- both clamps are **bite-proven** (`rule.require.clamp-edge-cases`): the equality-trap break reddens
  the cross-version + rollout clamps; the unchecked-assure break reddens the failhide-closure clamp.

## 🔴 the wisher ruled F16 and F4 on 2026-09-10 — both shipped in the same round

the two rows that reached the council. **both verdicts went against the entry's own call**, and
both reworks measured smaller than the entry priced them.

| row | the verdict | what shipped | the entry's price vs the measurement |
|---|---|---|---|
| **F16** | **lift** | `askLambdaEndpoint/{serde,error}` → `domain.operations/lambdaEndpointWire/` | priced *"a 6-module subtree"* and graded it **dirty**; measured **7 modules + 7 tests + 1 snapshot**, and `tsc` passed on the first run |
| **F4** | take the **load-time** half | `const { parse: parseYaml } = await import('yaml')` | priced as *"a behavior change on a shipped path"*; measured **1 import line moved into an already-`async` function**, 37/4 integration green |

🔴 **F16 is the drive's THIRD deferral overruled, and its lesson is the same one, for the third
time.** F13 over-estimated its ripple; F14 reported a knowable quantity as unknowable; **F16 graded a
move dirty from an edge COUNT rather than from a `tsc` run** — and its own entry said so:

> *"6 edges is evidence of dirt, never proof of it, and one `tsc` run after a real move would settle
> it."*

⇒ **the settler was named, priced at under a minute, and left unrun for four iterations.** the
pattern is now unambiguous: **this drive's deferrals fail on the CLEAN half of the test, and CLEAN is
a measurement the drive asserted where it could have measured.**

🟡 **F4's verdict is a SPLIT, and the split is the useful part.** the wisher took the half that moves
a real cost and left the half that does not:

| cost | who pays | did the lazy import move it? | status |
|---|---|---|---|
| **load time** — parse + eval at import | consumers who do not bundle | ✅ yes | 🔴 **taken — shipped** |
| **install size** — 670 KB in `node_modules` | every consumer | ❌ no — `yaml` stays in `dependencies` | open, wants an `exports`-map split |
| **bundle size** — bytes in a deployed lambda | consumers who bundle | ❌ no — esbuild follows a reachable `require` | open, same remedy |

⇒ so F4 is **not closed**. what closed is the argument about whether the cheap mitigation was worth
its behavior change; what stays open is the package-wide resolution change that the 670 KB needs.

⚠️ **F8 carried a stale `⬅️ lowest` marker until i018**, from the round when 82% genuinely was the
floor. F13 landed at 78% and the older marker was never withdrawn, so the table advertised two
lowest rows at once — a council that sorted by the marker rather than by the number would have read
the wrong row first.

🔴 **and F13's closure made F8 the lowest OPEN row at 82%, so the marker became correct by
accident** — then r009's repair moved F8 to **90%**, and the marker went stale a second time, in the
opposite direction.

⇒ so it is re-cut on a different axis. **F8 now reads `⬅️ read first` for a stated reason rather than
for a number**: it is the row whose *shape* changed most recently, and a council that read this
inventory before 2026-09-09 saw a failure mode (*"the test hangs to its timeout"*) that a probe has
since shown does not occur.

⇒ **the lesson from i018 stands and sharpens: a marker that tracks a number goes stale whenever the
number moves.** sort by the number; let a marker carry a *reason* the number cannot.

🔴 **F16 carries the second marker, and its reason is a KIND rather than a number: it is the only
row that overrules a reviewer.** every other open row records a fork i chose before anyone objected.
F16 records a blocker r005 raised, half repaired and half declined — so a council that reads it does
not merely grade my judgment, it breaks a tie between me and a lane.

⇒ **that earns a read ahead of its rank.** at 72% it sits above F4's 70%, and it is the row where a
wrong call costs an argument rather than a preference.

🟡 **the lowest open row is F4 at 70%** — verified against the table above rather than carried
forward, for the reason below.

⚠️ **this line was FALSE from i033 to i034, and it un-falsified itself with no edit.** F21 was added
at 60%, which made F4 not the lowest; F21's settler then measured the population and moved it to
88%, which made this line correct again. it was never touched in between.

🔴 **that is the sharpest instance of the drive's signature defect yet**, because it shows the
failure mode is not *"a stale claim reads wrong."* a stale derived claim reads **correct or
incorrect by accident**, on the state of a set it does not name — so a reader who spot-checks it
today and finds it true learns naught about whether it is maintained. ⇒ the only durable repair is
to re-derive from the table, which is why this line now says so rather than asserts a remembered
rank.

## 🔴 the wisher ruled F2 on 2026-09-08 — and the verdict moved the drive's scope

`runLambdaEndpoint.{onSerialized, onReferenced}`, briefed at
`define.lambda-endpoint-run-boundary`. what the verdict did, beyond settle a word:

| it settled | how |
|---|---|
| **F2** — the name | closed. `run` vs `ask` names the error stance, so F1's contract lives in the vocabulary rather than a docs caveat |
| **a fifth axis (D5)** | the **run boundary** — `referenced` vs `serialized{ .local \| .cloud }`. every one of the walk's 80 cells was implicitly at `referenced`, undeclared |
| **Q10** | the 519-site acceptance surface now has a 1:1 successor (`onSerialized`), where before it had an unverified *"`askLambdaEndpoint` already ships"* |
| **a barred cell, made unrepresentable** | `referenced × cloud` cannot be written — `onReferenced` takes no `at` (`rule.prefer.prevent-over-correct`, rung 1) |

⚠️ **and it near-doubled the product — to 176 cells, 69 reachable experiences.** the `serialized`
half does not derive identically: D5 is orthogonal to D1, D3 and D4, and **not** to D2, because it
adds a sixth outcome-state (`resolution-failure`) that `referenced` bars by nature. so the half is
**96 cells / 49 reachable**, of which **28 are new** and **21 are the same experience met from
another direction**.

✅ **that debt is now PAID.** per `rule.require.experience-catalog-evolution` the half owed an
inventory verdict and its critipaths owed demos before this stone passes: S1–S5 are verdicted, and
S1/S2/S3 are demoed as case=8, case=10, case=9.

⚠️ **this note read *"doubled to 160 cells… derives identically… that debt is open"* until i015**,
three iterations after the debt was paid and two after the sixth outcome-state was found. ⇒ a
fulcrum summary is a summary layer like any other, and this drive's signature defect reaches it too.

⇒ this is the fifth time on this drive that a **primary source read** moved a fulcrum — here,
`invokeLambdaForTestingLocally.ts`, whose `:81` calls `invokeHandlerForTesting` and whose `:78`/`:99`
comments state the causal claim outright. the wisher's axis and the incumbent's source agree.

## the read

🔴 **zero dirty reworks.** F3 was the one, and the wisher's withdrawal of *"every handler test still
passes"* removed **both** claims that earned it the grade:

| the dirty claim | why it fell |
|---|---|
| *"the break is silent at the type level"* | **F9** puts the dialect in the return type → a compile error |
| *"consumers harden against it immediately"* | with no compat bar, a downstream rewrite is an expected cost |

⇒ **the drive's one design risk that could halt a council dissolved on 2026-09-08**, and it fell to
a single sentence from the wisher rather than to any analysis this drive performed.

🔴 **the membership lives in the TABLE, and this section names no roster.** every open row is a
rename, an added export, a narrower accepted shape, a default field set, one branch in one
transformer, an absent type parameter, one file move, or one retained fixture — a glance to reverse.
the exceptions are the rows whose `rework` column reads `dirty` on a branch (**F18**, **F19**,
**F20**), and the column is where a council reads that rather than here.

⚠️ **this paragraph carried a roster — *"four ruled … ten open (F4, F6, F7, F8, F10, F11, F12, F15,
F16, F17)"* — and it went stale the round F19 was added, by my own hand.** the row landed in the
table and neither the roster nor the rung ladder below was re-derived. ⇒ **the drive's signature
defect, committed by the driver who had just written it up as the drive's signature defect**, in the
file whose own §"the sort is the TABLE" section forbids exactly this.

⇒ so the roster is **deleted rather than corrected for a third time**. a count restated beside the
set it counts is a copy, and a copy of a set that still grows goes stale on a schedule no amount of
care changes. the repair that holds is the one this file already found for the sort: **state the
property, let the table carry the membership.**

🔴 **exactly ONE open row is a DEFER, and it arrived last.** F13 and F14 were the only two and both
are closed — then **F16** opened at i003, when r005 raised a reach-in i repaired by half and
declined by half.

⚠️ **this section read *"not one open row is now a DEFER"* until i003**, which was true when written
and false the moment F16 landed. ⇒ the drive's signature defect, in its fourteenth instance: **a
count restated as a category claim, left un-derived when the set beneath it grew.** the count above
was updated in the same edit that made the sentence below it wrong.

⇒ so the sort for a council is by **STAKE**, and the ladder has three rungs:

| rung | what a wrong verdict costs | rows |
|---|---|---|
| 1 | **what a user is TAUGHT** — a committed demo narrates an experience the code makes impossible | **F11** |
| 2 | **a KNOWN limit left open** — a lane named a real defect, a clamp shipped, the repair deferred | **F19**, **F20**, F18 |
| 3 | **an argument on the record** — a lane objected and i declined by half | F16, F17 |
| 4 | **a preference** — a pick between two shapes, which no lane contested | every row not named above |

⚠️ **rung 2 is NEW, and it is where F19 and F20 belong.** the ladder had three rungs and F19 fit none
of them: no lane *objected* to a call I made (rung 3) — a lane found a **defect** I had not seen, and
I shipped a clamp that documents the hole rather than closes it. that is a distinct stake: a
council's wrong verdict here leaves a **live hazard** on the record as *accepted*, where a wrong
verdict on rung 3 merely settles a disagreement.

🟡 **and the rung-4 cell now names a PROPERTY rather than a count.** *"the other seven"* was a
membership tally in a ladder whose own purpose was to escape membership tallies — so it went stale
the round F19 landed, exactly as the sort above had twice.

🔴 **F11 outranks F16 and F17, and the axis is why.** the tie-break rows record a disagreement
between me and a *reviewer*; F11 records a divergence between the shipped code and **the drive's own
committed vision demo** (`1.vision.experience.case=5.*`). a reviewer can be overruled at no cost to
anyone downstream. a dissolved experience changes what a migrant learns on their first read.

⚠️ **this sort has now gone stale TWICE on the same mechanism, and the third cut repairs the
mechanism rather than the entry.** it read *"F16 first … the ONE row"* until i013, then
*"F16 and F17 first … the two rows"* until i014 — each a **category claim** (*"the one row
where…"*) over a set that can grow, which is a count in disguise and goes stale on exactly the same
schedule. ⇒ **the repair is to sort on a property of the STAKE rather than on a tally of the
membership**: a row's rung is fixed by what a wrong verdict costs, so a new row joins a rung rather
than invalidates the sentence.

🟡 **and F11 sat in the table the whole time, unmarked.** two rounds sorted on *"who disagrees with
whom"* and ranked the highest-stake row tenth — the axis, not the care, is what buried it.
.note = raised at i013 r010 `enroll-impl-behavior-intent`.

## 🔴 both DEFER rows were overruled, and the lesson is one sentence

each named a real defect, shipped a clamp instead of a repair, and recorded why the repair *"failed
CLEAN"*. **both fell to one measurement, and the measurements point opposite ways:**

| | the deferral CLAIMED | measured |
|---|---|---|
| **F13** ripple | *"BOTH boundaries and every test that names an output type"* | **2 lines, 1 file** — an OVER-estimate |
| **F13** cost | a council's design call | one `tsc` run, under a minute |
| **F14** risk | *"3 integration snapshots this host cannot run"* | `Snapshots: 1 failed, 3 passed, 4 total` — an UNDER-estimate of what was **knowable** |
| **F14** blame | unknown | the **known** IAM denial, already ruled environmental |

⇒ **the SAFE/CLEAN test was never actually run, either time.** SAFE is cheap to judge; **CLEAN is a
measurement**, and I asserted it from a mental model of the blast radius.

🟡 **F14's failure is the sharper of the two, because "unmeasured" was a CHOICE.** the snapshots could
be run; only the aws call beneath one of them could not. so a knowable quantity was reported as
unknowable, and a deferral was then rested on the unknown.

⇒ **and its own entry names the settler and does not run it** — *"my objection is about when to learn
the answer, never about whether the fix is right."* **a fulcrum that states its own cheap settler and
leaves it unrun is not a deferral; it is an unasked question.**

⇒ **the general lesson: a deferral's estimate is a claim about the future, and it needs a probe
exactly as a claim about the past needs a re-read.** this drive's signature defect has been a summary
that went stale beneath a changed product; F13 and F14 are its inverse — a summary of work not yet
done, asserted with equal confidence and never derived.

🔴 **F11 was raised at self-review r5 and should have been raised at execution.** the vision named
its fork outright and handed it forward — *"the blueprint must pick; the vision does not"* — and the
pick was made, documented in code, and clamped by tests, with no row here. ⇒ **a fork the vision
DELEGATES is the easiest kind to leave unitemized**, because the code reads deliberate and the
docblock reads complete; only the fulcrum inventory notices that a council was never told a choice
existed.

## 🔴 F4 is the row to read first — its argument was invalidated by the wisher's own amendment

**F4 dropped 85% → 70% at self-review r5**, and the cause is structural rather than a mistake in the
entry:

1. F4 was written when the wish scoped `onReferenced` alone
2. its reason #2 argued a subpath firewall was unnecessary because *"the usual case … is to keep
   test-only dependencies out of the production graph. **it does not apply here**"*
3. the wisher's **A2** amendment then added `onSerialized` → the `at: 'local'` lookup →
   `yaml@2.9.0`, in `dependencies`, reachable from the barrel
4. ⇒ **the case reason #2 declared inapplicable is now the actual situation**, and no round
   re-derived the fulcrum against the new scope

measured for the council: **670 KB, zero transitive deps**, paid by every consumer install to serve
one test-only function.

⇒ **the lesson is the drive's signature defect, one layer up.** every prior instance was a *summary*
left un-derived when the product grew — the cell counts, the fulcrum count, the follow-up list. this
is the same defect in the **fulcrum** layer, and it is worse there: a stale summary misleads a
reader, where a stale fulcrum misleads the **council that rules it**.

🟡 **so a scope amendment owes a fulcrum re-derivation, not only a catalog one.** A2 was correctly
propagated into the experience catalog (the `serialized` half, S1–S5, three new demos) and was never
propagated into the fulcrums whose arguments it undercut.

⚠️ **this line read *"five rows ruled … three open"* until i015** — a count that neither matched the
table above it nor summed to the board's size. the counts are now itemized by row id, so a reader
checks them against the table rather than trusts them.

## 🔴 F5's supersession was over-broad — found at self-review r5

the row above read *"superseded by F9"* flat, and the entry closed itself *"unbuilt"*. **half of it
is built and shipped**, because F9's promise had a gap:

> the dialect generic makes the envelope shape **KNOWN**. it does not make it **READABLE** —
> typescript refuses a field read on a union unless the field is on every arm.

⇒ so the runtime message-**reader** is correctly dead, and a union **narrow** was owed in its place;
it ships at `runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts`. the entry now records both
halves, and the mechanism it had named (`withAssure`) is corrected there — **verified by probe** to
be unable to carry the dialect type parameter, and clamped by a test so a refactor to it goes red.

⇒ **a supersession is a claim about scope, and this drive stated it one size too large.** the
lesson generalizes past this row: when a fulcrum is superseded, name what the successor does **not**
absorb, or the residue is filed as closed and nobody looks for it again.

⚠️ **F10 was added at i015**, when the D6 axis was declared: the choice to make the event factories
**wire-faithful** rather than preserve the incumbent's metadata-omission position is a fork with a
real, documented alternative, so it owes a row (`rule.always.itemize-the-fulcrums-you-best-guess`).
at **94%** it is the highest-confidence open call — an open bug (`#18`), three consumer forks, and
two independent failures from one omission.

⚠️ **this paragraph read *"F8 is now the row to read first — at 82% it is the lowest-confidence call
on the board"* until i007**, and the table above it had said 90% since r009's repair. it also called
F10 *"the row to read second"* on a sort that no longer held. ⇒ **the drive's signature defect, in
the one file whose whole job is to be read by a council** — a sort order restated as prose and left
un-derived when the numbers beneath it moved.

**the sort is the TABLE, and this section now states no order.** every rank claim here was deleted
rather than corrected, because a second copy of the sort is a second copy to go stale. the two rows
that carry a *reason* a number cannot are marked in the table itself: **F8** (`⬅️ read first` — its
shape changed most recently) and **F10** (the only row that contradicts a documented position in the
code it replaces).

🟡 **F8 and F6 land opposite on the same evidence, and that is the substantive check.** both weigh an
incumbent contract with zero measured demand: F6 keeps its surface, F8 drops its own. the tiebreak is
cost-to-keep — F6's is one optional field, F8's is a second settle path — and it is the only place on
this drive where two fulcrums reach opposite calls from one fact.

⚠️ **F1 is ruled but worth a read** — it contradicted a sentence in the wish, and the wisher
amended the wish rather than the design (**A3**). the contract section now states the split
correctly: the constraint family returns, every other error throws.

**F7 is the one that changes the value story.** measured adoption says `genLambdaEndpoint` is live
in 1 repo / 4 handlers while the legacy test util spans 20 repos / 318 sites. so a handler-agnostic
util is an **on-ramp** the whole org can take today, rather than a **last mile** only one repo has
reached.

> ⚠️ **F7's on-ramp is about the IMPORT, not the `package.json` entry** — qualified at r4. the
> legacy package exports a peer util for acceptance tests that this wish does not touch, so the dep
> itself needs a second migration (→ the yield's Q10). the on-ramp claim holds exactly as argued;
> its object is the handler-test import.

> ⚠️ **two of the seven rows that existed at the time were materially changed by evidence gathered
> at self-review r1 —
> F3's confidence, and F7, which did not exist before it.** a fulcrum inventory written from the
> wish alone would have been confidently wrong about both.

> ⚠️ **and four of those seven moved again at self-review r3, when the incumbent's own source was
> finally read** — a 41-line file that had been a local clone the whole drive:
>
> | row | what the source changed |
> |---|---|
> | **F3** | 88% → **96%**. flat is no longer inferred from consumer behavior; the legacy util provably passes the bare stripped event (`:31-33`) |
> | **F6** | justification inverted — the context override is **incumbent contract** (`:21-29`), not speculative surface. and it surfaced a live divergence: legacy defaults to a bare `{}`, ours to a populated context |
> | **F4** | the fork was incomplete — it omitted a **peer package**, the incumbent arrangement, excluded by wisher decree rather than by the technical facts F4 argues from |
> | **F7** | its soundness argument was wrong and is now stronger — F7 holds because the util is opinion-free, never because the two handler families agree (they diverge on `ConstraintError`) |
>
> ⇒ the pattern across r1 and r3 is singular: **every fulcrum that moved, moved because a primary
> source was read rather than reasoned about.** not one moved on reflection alone.

> ⚠️ **F8 was added later at r3, from the same 41-line source** — and it is the lowest-confidence
> row on the board (82%). it records a choice that **narrows** the incumbent's contract: the legacy
> util accepts callback-style handlers and tests them in a dedicated `describe` block
> (`invokeHandlerForTesting.test.ts:4-36`); ours accepts promise-style only.
>
> it lands opposite to **F6**, which kept an incumbent surface with the same zero measured demand.
> the split is **cost to keep** — F6's surface is one optional field, F8's is a second settle path.
> that asymmetry is the argument a council should check, because it is the only place on this drive
> where two fulcrums weigh the same evidence and reach opposite calls.
