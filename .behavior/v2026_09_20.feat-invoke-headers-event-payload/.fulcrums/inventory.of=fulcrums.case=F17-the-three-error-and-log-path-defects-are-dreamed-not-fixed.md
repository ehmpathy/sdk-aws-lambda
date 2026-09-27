# F17 — the three error-path and log-path defects are DREAMED, not fixed, because each repair breaks a contract this wish's bound does not open

**rework** = clean · **status** = open · **confidence** = 🔴 **94%**

## the fork, stated fairly

peer lane `r009` (ergo-friction-hazards) raised three concerns. **every fact in all three is
correct**, and I concede each. what forks is the **conclusion** — whether the execution stage of an
`invoke`-input-shape rename owes the repair.

| | the sense | what it implies |
|---|---|---|
| **A** | a defect the review surfaces on this branch is this stone's to repair | each of the three lands here, and the wish's stated bound stops to bind |
| ✅ **B** | a defect **inherited**, whose repair breaks a contract the wish's bound protects, is dreamed and flagged | the three become queue entries with measured repairs, and the wish ships its own deliverable |

⇒ **B is taken**, for all three, and the bound that decides it is the wish's own first line.

## the bound the wish states, verbatim

> **this task changes `invoke`'s INPUT SHAPE only. it must not move what lives in `request.event`.**
>
> *a proposal that demands those move has grown into a different task and must **stop and
> re-scope** rather than press on.*

⇒ the wish does not merely omit the error path — it names a chain-behavior hazard and instructs a
driver who meets one to **stop**. so a repair that moves chain behavior is the case the bound was
written for, rather than an omission a driver may fill in.

## the three, each measured

### 1. blocker.1 — `errorMessage` and `errorType` name different classes

the wire emits `errorMessage: "✋ ConstraintError: validation failed: …"` beside
`errorType: "BadRequestError"`. ✅ **real, and it ships to every 4xx caller.**

**inherited — measured, not asserted.** the producer is `getErrorResponseBody.ts`, and this branch
does not touch it:

```
$ git diff HEAD --stat -- src/domain.operations/genLambdaEndpoint/middleware/
   ->  9 files.  `getErrorResponseBody.ts` is NOT among them.
```

⚠️ **and one file in that list IS material, which is why the check was run rather than skipped**:
`genConstraintErrorMiddleware.ts` shows 12 changed lines. read: **doc-comment only** — the
`payload`-vocabulary retirement (F01). its test's 8 lines are a local variable rename
(`asWirePayload` → `asResponseWire`). ⇒ zero behavior, in the one file that could have carried it.

🔴 **the sweep the review did not run — the class is 11× wider than the one case it named.**
`rule.require.sweep-the-defect-class`: the cause is *"the error's `.message` carries a
library-rendered class prefix, while `errorType` carries the sdk's own class word."*

⚠️ that holds only where the two writers **disagree**. an entry whose `.message` opens
`BadRequestError:` beside `errorType: "BadRequestError"` is OUT — they agree, so no reader is
misled; so is one with no class prefix at all (`"internal server error"`). the family, each row a
**read** of every hit rather than a count of them:

| snapshot file | raw `errorType` hits | in class |
|---|---|---|
| `blackbox/__snapshots__/local.sdkContract.acceptance.test.ts.snap` | 6 | **6** |
| `blackbox/__snapshots__/local.introspection.acceptance.test.ts.snap` | 2 | **2** |
| `blackbox/__snapshots__/local.payloadCompat.acceptance.test.ts.snap` | 2 | **2** |
| `blackbox/__snapshots__/local.httpResponse.acceptance.test.ts.snap` | 7 | 🔴 **1** — the review's own case |
| | 17 | **11** |

⇒ **4 files, 11 entries** — against the review's 1 file, 1 case.

⚠️ **this table said 14 in its first draft, and claimed `local.httpResponse` held "+5 more".** it
did not: the figure came from a **count of grep hits** rather than a read of each, and 6 of that
file's 7 hits fall outside the cause. ⇒ the reviewer named the **only** instance in the file they
graded. the correction is the drive's sixth instance of one defect class — *a claim in the register
of a measurement, with no observation behind it* — and its tell is now on the record: **a grep's hit
count is not a measure of the class**, since the pattern that finds a family is wider than the cause
that bounds it.

🔴 **and the naive repair is FORBIDDEN by a booted invariant.** `invariant.ancient-vs-contemp-callers`
requires an ancient caller receive `errorType: 'BadRequestError'` — *"to return `ConstraintError`
would break their error handlers."* so the two fields may not simply be converged: **only
`errorMessage` may move**, and `errorType` must not. a repair that does not know this makes the
defect worse.

⇒ dreamed, with that constraint recorded:
`.dream/v2026_09_22.fix.error-wire-names-its-class-two-ways.md`

### 2. blocker.2 — no cors or owasp headers on error responses

✅ **real, live, and clamped green** — `[case8][t1]` asserts both header sets absent.

**inherited**: `main` carries the identical relative order. the cause is the `onError`/`after`
axis of the chain's hook-order rule: those hooks run in **reverse** array order, so
`@middy/http-cors` at its index runs **before** the error builders that produce
`request.response`, reads `undefined`, and its own guard returns in silence.

⛔ **the repair moves the SUCCESS-path `after` order for every handler**, because the `after` and
`onError` phases share one array position. that is chain behavior for every consumer — the exact
class the wish's bound names.

⇒ dreamed: `.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`

### 3. nitpick.1 — `logTranslate.input` is dead for this family

✅ **real, clamped green** at `[case16][t1]`, with the twin family as its positive control at
`[t0]`. the `before` axis of the same hook-order rule: `genIoLoggerMiddleware` at index 3 reads
`context.log`, which `genTrailMiddleware` at index 8 writes, and `before` runs **forward**.

🔴 **this one had NO dream, and the review is what surfaced the gap.** the *defect* was recorded at
three code sites; the *repair* had no queue entry. ⇒ **caught this round**:
`.dream/v2026_09_22.fix.logtranslate-input-is-dead-for-the-apigateway-family.md`

⚠️ the reviewer's ask was *"it should either work or be refused loudly"*, and **both doors are
unsafe today**:

| door | why not now |
|---|---|
| make it RUN — move trail to index 3 | it also puts trail **above event normalization**, so trail's `exid` extraction would read the raw v1/v2 union in place of the reconciled event. unmeasured |
| refuse it LOUDLY — throw at construction | it converts a silent no-op into a hard failure at module load, for any extant consumer who sets the option |

⇒ the dream carries both doors, the probe each owes, and the order to try them in.

## why this is a DISPUTE and not a concede-and-fix

`rule.always.absorb-every-concern` makes concede-and-fix the default and dispute the escalation.
the escalation is earned here because the three share one property:

> **each repair changes behavior for every consumer of a chain the wish forbade this task to
> move.** the fork is a SCOPE call, and a scope call made in silence is what a fulcrum exists to
> surface (`rule.always.itemize-the-fulcrums-you-best-guess`).

⚠️ **a `.taken` cannot close them either**, which is the second half of the test
(`rule.always.raise-a-blocker-a-taken-cannot-close`): the concerns are not *"this is wrong"* — they
are *"this is not repaired"*, and an argument about an absence does not fill it. what closes them
is the repair, and the repair is out of bound.

⛔ **and this is NOT a `--as blocked`.** the acts are not gated on a human grant; they are gated on
a scope call a wisher rules at the fulcrum council. ⇒ dispute, drive on.

## the harm test — why each is `better` rather than `urgent`

| concern | the harm test (`rule.forbid.overzealous-blockers`) |
|---|---|
| 1 — two class names | ⚠️ **no nameable shipped harm.** both fields name a caller fault, both ride a 400. a triage reader must pick one, which is a clarity cost the team pays |
| 2 — no cors on errors | 🔴 **this one CAN name a harm** — a cross-origin browser caller cannot read the error body, so a 400 is indistinguishable from a network failure. its dream is graded **urgent** accordingly |
| 3 — dead log branch | ⚠️ **no shipped harm.** a redaction that never runs cannot leak, because the log it would have shaped is never emitted either. the harm is a trap for the author, not for a user |

⇒ concern 2's severity is real, and it is why its dream leads the queue. severity grades the
**defect**; it does not change which stone owes the repair.

## the rework, and why it is clean

| | |
|---|---|
| **clean** | to reverse this call is to open the three dreams and run their probes. no code hardens against it, and no later work builds upon the deferral |
| **what it does NOT defer** | ⛔ the records. each defect is clamped by a green test that goes red under its repair, each carries a status-first note, and each now has a dream with a measured repair and its blast radius |

## the confidence, and why it is not 100

**94%.** the 6%: a wisher may read the wish's bound more narrowly than I do — as a constraint on
the **`request.event` slot** specifically, rather than on chain behavior in general. under that
sense, concern 2's repair (an `onError` reorder, which touches no event slot) could be argued
in-scope.

⚠️ I weigh that at 6% because the bound's own sentence generalizes — *"a proposal that demands
those move has grown into a different task"* — and because a reorder that moves the success-path
`after` order for every handler is plainly a different task by any read. ⇒ the residual moves one
concern's home, never the shape of the call.

## where it is cited

- `.reviews/peer/…r009._.taken.by_self.ergo-friction-hazards.md` — all three concerns reduce here
- `.dream/v2026_09_22.fix.error-wire-names-its-class-two-ways.md`
- `.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`
- `.dream/v2026_09_22.fix.logtranslate-input-is-dead-for-the-apigateway-family.md` — caught this round

## the verdict, once ruled

⏳ **unruled.** the wisher settles it at the fulcrum council: an approval of 5.1 takes **B** and the
three dreams stand as the queue; an instruction to repair any of them takes **A** for that one, and
its dream names the probe to run first.
