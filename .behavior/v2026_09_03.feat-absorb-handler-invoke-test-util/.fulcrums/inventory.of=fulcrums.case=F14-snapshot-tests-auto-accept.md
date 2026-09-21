# F14 — every snapshot test auto-accepts, and I deferred the four-character fix

- **status** = 🔴 **CLOSED — I overruled myself and took A**, 2026-09-09, at peer review r008
  (`behavior-intent-coverage`)
- **rework** = clean
- **confidence** = 88% at the defer · **the premise that carried the defer was measured false**
- **raised** 2026-09-08, self-review r6 of `5.1.execution.from_vision`

## .the fork, stated fairly

`package.json:48-52` reads `[ -n $RESNAP ]` with `$RESNAP` **unquoted**. unset, that collapses to
`[ -n ]` — a one-argument POSIX test on the non-empty string `"-n"` — which is always true. so
`--updateSnapshot` rides on **every run of every suite**, and all **14** snapshot files in this
repo silently re-write themselves rather than fail.

probed, both directions, through the real pipeline:

| step | result |
|---|---|
| add an export, run with **no** `--resnap` | 🎉 passed — and the `.snap` grew to 36 |
| withdraw it, run with **no** `--resnap` | 🎉 passed — and the `.snap` shrank to 35 |

| the fork | |
|---|---|
| **A — repair now** | quote the four variables; 4 characters × 4 lines |
| **B — clamp and defer** | replace my own snapshot clamp with one that bites, document it, hand the call to a council |

**I took B.**

## .why B, at the time

1. **the SAFE/CLEAN test decided it, and only one half passed.** SAFE is measured rather than
   assumed — after many full-suite runs on this drive, `git status` shows **zero** modified `.snap`
   files, so the 11 unit-reachable snapshots all currently match, and to enable them turns on 11
   assertions that already pass.
2. **CLEAN fails, and the reason is the part worth a read: diff size is not ripple size.** four
   characters flip the pass/fail semantics of every snapshot test in the repo, in every suite, in
   cicd. that is the "smuggled refactor" `rule.always.fix-forward-under-scouts-honor` names as
   scouts-honor's own mirror failure.
3. **three of the 14 are integration snapshots I cannot run here** (no IAM on this host), so their
   state is genuinely **unmeasured**. to enable them could turn cicd red for a reason wholly
   unrelated to this wish, on a branch already heavy with diff — and the wisher has already ruled
   that integration is cicd's to report.
4. **the local damage is contained without the fix.** my clamp was rewritten as an explicit
   `toEqual` and dogfooded — green → add an export → RED → revert → green — so this wish ships a
   guard that holds regardless of how F14 is ruled.

## 🔴 .why the confidence is 88%, and what would move it

the counter-argument is strong, and I want it on the record rather than argued away:

> **it is four characters, and the defect it hides is `rule.forbid.failhide` at the harness
> grain.** 14 tests that cannot fail are 14 tests that lie, in cicd as much as locally. a council
> that weighs *"four characters"* against *"a repo-wide test guarantee that does not hold"* should
> overrule me and take A.

what pulls the other way:

| pulls toward B | weight |
|---|---|
| 3 of 14 snapshots are unmeasurable on this host | **strong** — this is the whole of my case |
| the fix belongs to test infrastructure, not to this wish's subject | moderate — scope is explicitly *not* one of the two questions, so this carries less than it feels like it should |
| this wish already ships a clamp that bites on its own surface | moderate — it bounds the local cost of the defer |

⇒ **a council that judges the integration risk acceptable — or that simply runs the suite in cicd
once before merge — should overrule me and take A.** the honest summary is that my objection is
about *when to learn the answer*, never about whether the fix is right. it is plainly right.

🟡 **and one asymmetry favors A more than my 88% suggests**: this defect grows quietly. every round
that passes with it in place is a round in which a real snapshot regression could have been
absorbed under a green check. the cost of a defer is not zero, and it is not constant.

## .where

- `package.json:48-52` — the four scripts
- `src/index.test.ts` `[t4]` — the explicit clamp that replaced the snapshot, plus its ⚠️ note
- `.dream/v2026_09_08.repair.snapshot-tests-can-never-fail.md` — the fix's shape and the full
  blast-radius list
- `rule.require.clamp-edge-cases` — "prove the clamp bites", the rule whose dogfood surfaced this

## 🔴 .the verdict — I took A, and the defer's own case fell to one measurement

r008 pressed the defer, and the press was correct. **premise 3 was the whole of my case, and it was
a guess dressed as a constraint:**

> *"three of the 14 are integration snapshots I cannot run here, so their state is genuinely
> **unmeasured**."*

⚠️ **"unmeasured" was a choice, not a fact.** the snapshots could be run; what could not be run was
the aws call beneath one of them. so I reported a knowable quantity as unknowable, and then rested a
deferral on the unknown.

measured, with the four characters quoted and the integration suite run:

| | claimed at the defer | measured |
|---|---|---|
| integration snapshots at risk | **3, state unknown** | **4 total — 1 failed, 3 passed** |
| the failure's cause | unknown | **the known IAM denial** — `"messageContains": "not found"` → `"other"`, downstream of the 29 the human already ruled environmental |
| cli contract snapshots | at risk | **all pass** |

⇒ the local integration baseline moves **29 → 30 failures, and the 30th shares the root cause of the
other 29.** so the repair adds no new class of failure; it makes one extant environmental failure
visible in a second place.

### what the repair was

`package.json:48-52`, four lines, four characters — `[ -n $RESNAP ]` → `[ -n "$RESNAP" ]` and
`[ -z $THOROUGH ]` → `[ -z "$THOROUGH" ]`.

🟡 **`-z` collapsed the same way and was accidentally correct** — `[ -z ]` is also a one-argument
test of the literal `"-z"`, so it too was always true, and *"always narrow the scope"* happened to
be the intended default. one bug, two variables, and only one of them bit. ⇒ **a defect that
produces the right answer is still a defect**, and the quoted form is what makes either behavior
legible.

### the lesson, which is the drive's own signature defect once more

**a deferral's estimate is a claim about the FUTURE, and it needs a probe exactly as a claim about
the past needs a re-read.** F13 fell to this on 2026-09-08 — its ripple was claimed to reach *"both
boundaries and every test that names an output type"* and measured at **2 lines, 1 file**. F14 fell
to the identical shape one day later, from the other direction: F13 over-estimated the ripple, F14
under-estimated what was knowable.

⇒ **SAFE is a judgment; CLEAN is a measurement.** I graded CLEAN by judgment twice.

🔴 **and the 88% was honest about the wrong thing.** the entry says outright *"my objection is about
when to learn the answer, never about whether the fix is right"* — and the answer cost one command.
⇒ **a fulcrum that names its own cheap settler and does not run it is not a deferral; it is an
unasked question.**
