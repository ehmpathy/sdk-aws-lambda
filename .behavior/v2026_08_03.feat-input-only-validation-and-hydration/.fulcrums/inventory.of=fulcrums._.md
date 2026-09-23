# inventory of fulcrums

> the forks this drive best-guessed, one row each, appended at the moment the call was made.
>
> ⚠️ **this inventory opens at stone `5.1`.** the fulcrums raised at stone `1.vision` were
> recorded in that stone's yield prose (`1.vision.yield.md`, `## fulcrums`) before this
> inventory existed — `f.2` and `f.3` archived with the cut `hydrate` design, `f.31` named by
> the peer bound. they are not restated here, because a record swept together after the fact
> loses the fork as it stood, which is the part a reviewer needs
> (`rule.always.itemize-the-fulcrums-you-best-guess`).

| case | title | rework | status | confidence |
|---|---|---|---|---|
| `F01` | the aws account assertion is deferred, so the IMDS refusal stays a partial guard | dirty | open | 88% |
| `F02` | the **wire body** of the 500 a bad schema position raises is snapped as a gap rather than repaired | dirty | open | 82% |
| `F03` | `zod` + `domain-objects` stay hard deps; no `peerDependencies` block is added | dirty | open | 79% |
| `F34` | the `setLambda` upsert budget (180s) is **measured insufficient** — a cold run breached it by 2x | dirty | open | 28% |
| `F35` | a bare `.transform()` throw is a **server fault at BOTH families** — and that is the CORRECT read, not a defect | ~~dirty~~ → **none** | ⛔ **RULED 2026-09-21 — NO REPAIR OWED** | 97% |
| `F36` | the "one door to `z.toJSONSchema`" invariant is verified, never clamped | ~~dirty~~ → **clean** | ✅ **resolved** — clamped, both arms proven red | — |
| `F37` | the `env.access` tier check is **recorded, never restored** — a real defect, measured out-of-diff | dirty | open | 74% |

🟡 **`F34` and `F35` were both raised at stone `5.3`, from measurements rather than from design forks.**

- `F34` — 🔴 **the cold run it asked for was RUN at review `r1.has-zero-test-skips`, and the budget
  lost.** it was *"the cheapest to settle on this board — one cold run and one grep"*, and the grep
  settled it in the direction nobody wanted: **≥357s against a 180s budget**, still a floor. the
  entry's own arithmetic then rules out the fallback too, so the rework grade moved `clean` →
  `dirty` and the confidence fell `62%` → `28%`
  - ⚠️ **it surfaced only because a `--changedSince` scope was widened**, never because a gate went
    red. warm, the same suite is 25s and green — so every ordinary run reports success
- `F35` — ⛔ **RULED 2026-09-21: NO REPAIR OWED.** a clamp written to CONFIRM a behavior overturned
  it: the post-parse funnel belongs to `domain-objects`, so a bare `.transform()` throw reaches a
  caller as a server fault
  - 🔴 **and that read is CORRECT.** a bare guard `throw` and a genuine null-deref inside a
    transform are **indistinguishable** — same plain `Error`, same `inst._zod.parse` frame, no
    property parts them. a server fault is the only honest read, and the safe direction to be wrong
  - ~~what sits at 58% is the call to record rather than repair, since every repair in reach is a
    `failhide` or a new vocabulary this sdk does not hold~~ — 🔴 **struck.** the vocabulary is
    **zod's own**: `ctx.addIssue` + `return z.NEVER` inside the transform guards AND reshapes, and
    lands a caller fault through the extant chain with no edit to this sdk. it is the mechanism
    `X.contract()` uses internally
  - ⇒ **the same indistinguishability also killed the follow-on signal dream** — a hint that fires
    *"when the throw arrives from a transform frame"* cannot part the two either, so it would steer
    a consumer with a real defect into a `rule.forbid.failhide`. rejected, not deferred
  - ⚠️ **to re-open, one claim must fall**: that the two throws produce no distinguishable
    observable state. clamped at `[case13][t3]` and `[case20][t3]`, each proven by revert. an
    argument does not suffice — show a schema shape where they differ
  - 🔴 **its BLAST RADIUS was stated one family wide until 2026-09-18, and it is two.** the entry
    read *"escapes as a **500**"* and named `forApiGateway` alone; `forAskEndpoint` hands the same
    middleware `asOutputAfter: false`, so its invocation **FAILS** rather than answers — which trips
    all three costs `invariant.badrequesterror-not-lambda-error` names, where a settled 500 trips
    one. caught by a peer at `enroll-impl-behavior-intent` @ `i011`, then measured at the handler
    grain for both families and clamped at `forAskEndpoint.test.ts` `[case13]`
  - ⚠️ **the confidence ROSE on a correction**, which reads backwards and is not: `91%` graded a
    narrower claim than `97%` does. the old number was right about what it measured and the claim
    beneath it was incomplete

🔴 **`F36` CLOSED at `i016`, and its deferral rested on a premise that was simply false.** the
fork table graded the test option *"no precedent — the repo's only tests that touch the filesystem
read generated output in a temp dir"*. a filesystem read has a **declared genre** here —
`.integration.test.ts`, named by `rule.forbid.unit.remote-boundaries`, with 9 extant files under
`src/`. so the `dirty` grade was a claim about the repo made without a read of the repo, and once
read, the rework was one file and touched no config.

- the clamp is `genIntrospectionMiddleware.getJsonSchemaFromZod.integration.test.ts` — 5 rows, and
  **both defect arms were driven red before it was trusted** (a second prod call site → `[t1]`; the
  door's flag flipped → `[t2]`), each reverted to green (`rule.require.clamp-edge-cases`)
- ⚠️ **a reviewer had graded this a nitpick and said the repair was cheap** — *"a test asserting
  call-site count would close it cheaply"*, at `enroll-impl-behavior-intent` @ `i016`. it was right,
  and my own 84% was an estimate where a read was available

⚠️ **`F02`'s title NARROWED at round `r10` @ `i009`, and its status did not.** the call originally
covered two halves; the **log** half shipped that round, so only the **wire** half is still the
wisher's. the entry records why, and why my stated reason to hold the log half back was wrong.

🔴 **`F37` is the only row here raised from a find a reviewer got PARTLY right, and it is the row
most likely to be overruled.** lane `r011` @ `i010` graded it a blocker on the premise that this
branch deleted the guard; two commands falsify that (`git log --diff-filter=D` names `#8`;
`git diff --stat origin/main` is empty for all three paths). **the code read underneath is correct
all the same**, and no prior round of any rubric had looked at it.

- so the entry records a **defect this branch did not cause and did not repair** — the shape
  `rule.require.sweep-the-defect-class` demands be *"measured, recorded, and flagged"* rather than
  left unlooked-at
- ⚠️ its 74% is the lowest non-`F34` figure on this board, and the entry names why: **this stone's
  buttonup mandate says *no exceptions***, and a reader who weights that over the scouts-honor
  CLEAN grade rules the other way

⇒ `F03` was likewise narrowed in COST rather than in SCOPE that round — a split install is now
diagnosed by name with a dedupe command. the manifest question is untouched. **both entries still
read `LIVE, NOT FIXED`** (`rule.require.deferred-defect-records-lead-with-status`).
