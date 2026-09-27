# F19 — jest's scan of the gitignored `.log/` is dreamed, not fixed

| | |
|---|---|
| **rework** | 🔴 **dirty** |
| **status** | open |
| **confidence** | 🔴 **93%** |
| **where** | `jest.config.ts`, `jest.unit.config.ts`, `jest.integration.config.ts`, `jest.acceptance.config.ts` |
| **caught** | 2026-09-23, self-review 6/8 (`has-critical-paths-frictionless`), first command |

## 🔴 the correction that came first — this entry was written about ONE defect, and there are TWO

⛔ ~~the fork is: fix jest's `.log/` scan, or defer it.~~ **struck, within the same review round.**

the first draft of this entry graded **one remedy** (`modulePathIgnorePatterns`) and let that grade
rule **two defects**. jest walks `.log/` for two separate purposes, and they take two separate knobs:

| the half | what jest does | the knob | verdict |
|---|---|---|---|
| **test discovery** | loads any `*.test.ts` there as a **suite** | `testMatch: '!**/.log/**'` | 🔴 **SHIPPED — safe + clean** |
| **snapshot discovery** | pairs any `*.snap` there against no test | `modulePathIgnorePatterns` | ⚠️ **deferred — this entry** |

⇒ **measured apart, not assumed apart.** with the `testMatch` line in and BOTH poison files restored:

```
before:  Test Suites: 3 failed, 53 passed, 56 total     exit 2
after:   Test Suites: 53 passed, 53 total               exit 2   ← suites fixed
         Snapshots:   1 file obsolete, 91 passed        ← and the snap half SURVIVED
```

⚠️ **the second run is the one that matters.** had i stopped at the first, i would have reported the
class closed on the strength of a suite count — and the `.snap` would have kept the run red with no
entry anywhere to say why. `rule.require.sweep-the-defect-class` names this exact shape: *a sweep
bounded to one axis of a cause that names no axis.*

## the fork, stated fairly — for the SNAPSHOT half only

a `.snap` file dropped anywhere under the **gitignored** `.log/` is picked up by jest's snapshot
scan, paired against no test, reported obsolete, and **fails the run** — `✋ failed` beside
`tests: 634 passed, 0 failed`.

| | |
|---|---|
| **A — close it now** | add `modulePathIgnorePatterns: ['<rootDir>/.log/']` to the jest config(s), dogfood it both ways, ship it inside this wish |
| **B — remove the trigger, dream the trap** | rename the one scratch file at fault, record the trap as a dream + this fulcrum, leave this knob untouched |

## taken, and why at the time

🔴 **B.** and the SAFE/CLEAN test is what decided it, not scope
(`rule.always.fix-forward-under-scouts-honor` — *"the two questions grade the FIX, never the
scope"*):

| | |
|---|---|
| **safe?** | 🔴 **no.** `modulePathIgnorePatterns` governs **module resolution**, not merely snapshot discovery. a pattern that reaches one character too far excludes real suites — and the symptom of that is a **smaller green run**, the quietest defect a test config can have. the very stone i am under (`5.3.verification`) exists to refuse exactly that shape |
| **clean?** | 🔴 **no.** up to four config files, each loaded by every suite in the repo — a ripple far outside a diff whose subject is `rawEvent` → `{ headers, payload, event }` |

⇒ **both answers are no, so the fix is deferred and the deferral is recorded.** had either been yes,
the rule mandates i do it now.

### 🔴 and the contrast is the point — the same test ruled the other two instances the OTHER way

three instances of one cause surfaced in this round. the SAFE/CLEAN test did **not** rubber-stamp a
deferral; it split them:

| instance | the fix | safe? | clean? | verdict |
|---|---|---|---|---|
| **biome** lints `.agent/.cache/…/rmsafe/trash` | `"!**/.agent"` in `biome.jsonc` | ✅ affects lint reach only, and the tool **prints its own file count** | ✅ 1 line, 1 file, extant form | 🔴 **SHIPPED** — measured 188 → 179, and the 9 dropped enumerated |
| **jest** loads `.log/**/*.test.ts` as suites | `'!**/.log/**'` in `testMatch` ×3 | ✅ governs discovery only, and the **suite count** is printed | ✅ 1 line each, beside the extant `'!**/.agent/**'` | 🔴 **SHIPPED** — measured 56 → 53 |
| **jest** scans `.log/**/*.snap` | `modulePathIgnorePatterns` | ⛔ governs **module resolution** | ⛔ 4 configs | ⚠️ **this entry** |

⇒ **a test that yields the same answer every time is a rubber stamp.** this one yielded *ship* twice
and *defer* once, on the same cause, in one round — which is the evidence that it does real work.

⚠️ **what was NOT deferred**: the live break, in all three. `.log/verify/old.wireResponse.snap` →
`.snap.txt`, three `old.*.test.ts` → `.txt`, and both shipped config lines. every gate verified green
afterwards. the **trap** is what stays open here, and it is dormant.

## why the rework is dirty

the repair is one line **to write** and large **to prove**. a wrong `modulePathIgnorePatterns`
silently shrinks the corpus every other gate in this route depends on, and a shrunken corpus still
reports `🎉 passed` — so the failure mode of the fix is invisible to the same instrument that would
have to verify it. that is what makes it dirty rather than merely out of scope.

⇒ the dogfood the dream prescribes (`drop a .snap → green` / `revert the config → red`) is the
cheapest honest proof, and it belongs in a round whose subject is the test config.

## the confidence, and why it is not higher

**93%.** the 7 points:

- ⚠️ a reader may hold that a **gitignored** dir is by definition outside every tool's reach, and
  that jest's scan of it is the repo's defect to fix wherever it is found — scouts honor, one line,
  now. that read is not unreasonable; it weighs the line count and this entry weighs the **proof**
  cost
- ⚠️ and the trap bit **me**, in this very route, which is the strongest possible argument that it is
  live rather than theoretical. i answer that with the rename: the instance is closed, the class is
  queued, and `rule.require.sweep-the-defect-class` is satisfied by the sweep below rather than by
  the config change

## the sweep the cause implies

> **the cause**: *jest's snapshot scan walks a directory the repo's own tools write into, and the
> config excludes it nowhere.*

that sentence's subject is **the excluded-dirs list**, so the sweep is every dot-dir the tools write
to, against every jest config:

| dot-dir | written by | excluded in `testMatch`? | holds a `.snap`? |
|---|---|---|---|
| `.log/` | `git.repo.test`, and my scratch | ⛔ **no** | ⚠️ it did — now renamed |
| `.agent/` | the role briefs | ✅ yes | no |
| `.yalc/` | local package links | ✅ yes | n/a |
| `.behavior/` | this route | ⛔ **no** | ⛔ no, and no tool writes one there |
| `.dream/` · `.reviews/` · `.branch/` | dreams, reviews, binds | ⛔ **no** | ⛔ no |

⇒ **one live member, four dormant.** the two excluded dirs were excluded because a `.ts` under them
matched `testMatch` — a **test-discovery** fix — which is why the list never grew a
**snapshot-discovery** entry. the two concerns share a symptom and not a knob, and that is the whole
reason this was invisible.

### 🔴 and the sweep above is bounded to ONE TOOL — the widened one found a live member

the cause sentence names jest nowhere by necessity. stated at its real grain it is: **a code tool
walks a dot-dir the repo's own tools write into, and its config excludes it nowhere.** so the sweep
owes a row per tool, and that row found what the jest-only sweep could not:

| tool | its own scope config | excludes `.log/`? | excludes `.agent/`? | found |
|---|---|---|---|---|
| **jest** | `testMatch` · `modulePathIgnorePatterns` | 🔴 was **no** — suites **and** snaps | ✅ yes | 3 failed suites + 1 obsolete snap |
| **biome** | `files.includes` | ✅ n/a — `.log/` holds no `.ts` | 🔴 **no** | 🔴 **215 warnings, every one from a DELETED file** |
| **tsc** | `tsconfig.json` `include` / `exclude` | ⚠️ **unmeasured** | ⚠️ **unmeasured** | — |

🔴 **the biome mechanism is worth the record**: `rmsafe`'s trash preserves each deleted file's
**original path**, so a deleted `src/**/*.ts` lands back under a literal `src/` segment — and biome's
`"**/src/**/*.ts"` include matches it **by construction**. `useIgnoreFile: true` does not save it,
because the trash is ignored by a **nested** `.agent/.cache/.gitignore` and biome reads the root one.

⚠️ the `tsc` row is **honestly unmeasured**, and it is named rather than quietly omitted
(`rule.require.positive-control-before-absence-claims`) — it is the next check this class owes.

## the verdict, once ruled

_(unrecorded — open)_

## see also

- `dreams/v2026_09_23.fix.a-scratch-snap-under-dotlog-reddens-every-jest-run.md` — the work owed
- `dreams/v2026_09_23.reseed.a-test-runner-that-fails-with-zero-failures-owes-the-reason.md` — the
  peer half, in another repo: the runner reports the failure and hides its cause
- `rule.always.fix-forward-under-scouts-honor` — the two questions that ruled B
- `rule.require.sweep-the-defect-class` — the sweep above, run on the stated cause rather than on
  the form of the one instance
