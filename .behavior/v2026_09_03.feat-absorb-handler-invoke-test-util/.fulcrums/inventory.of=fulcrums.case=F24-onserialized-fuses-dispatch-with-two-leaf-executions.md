# F24 — `onSerialized` fuses dispatch with two leaf executions, and the deferral was decided by attrition

> 🔴 **raised as a blocker at i044 r011 `enroll-impl-arch-defects`, and the blocker is not the smell
> — it is that the smell was declined FIVE times and never recorded as a fork a council could
> overrule.** the reviewer's own words: *"every other design fork on this drive gets a numbered `F*`
> entry for council visibility; this one lives only in `.dream/`, un-owned … so it stops [getting]
> decided by attrition."* this entry is that record.

## the fork, stated fairly

`runLambdaEndpoint.onSerialized.ts` is one function at two grains
(`define.domain-operation-grains`):

| arm | what it does | grain |
|---|---|---|
| the preamble | guards (locus, dialect), then a locus branch | orchestrator |
| `at: 'cloud'` | delegates **wholesale** to `askLambdaEndpoint` | orchestrator |
| `at: 'local'` | resolves the handler, frames, runs, washes the throw | **leaf** |

two ways to answer it:

| branch | what it is | rework |
|---|---|---|
| **A · extract** `onSerialized.onCloud` / `.onLocal` (or `locus/runOnCloudLocus` / `runOnLocalLocus`) | the orchestrator becomes pure narrative: guard → dispatch; each arm's rationale travels with its arm | **marginal-SAFE, dirty-CLEAN** — a move of ~200 lines of live control flow, the arm the integration suite exercises most |
| **B · keep fused, record the call** | the file stays one function; this entry makes the deferral council-visible | clean |

## taken, and why

**branch B this round — the extraction stays deferred, and the deferral is now a fork on the board
rather than a dream nobody could overrule.**

`rule.always.fix-forward-under-scouts-honor`, answered honestly against the extraction (branch A):

| question | answer |
|---|---|
| **SAFE?** | 🟡 **marginal** — it moves behavior-critical dispatch code; the local arm is the most heavily integration-tested path in the subdomain |
| **CLEAN?** | 🔴 **no** — ~200 lines of live control flow, on the round before `5.3.verification`, in a core file, with commits forbidden so no CI run can observe the move |

⇒ the rule's table puts `safe 🟡 / clean 🔴` at **defer — and raise a fulcrum.** the prior five
rounds (i025, i032, i034/35, i039, i040) each reached the defer verdict and none raised the fork, so
the sixth reviewer met an undecided item and raised it as a blocker. **that asymmetry — a repeated
CLEAN-ish-but-declined call with no council row — is exactly what `rule.always.itemize-the-fulcrums-you-best-guess`
exists to close.**

🔴 **the dream's own `.note` was wrong to say "no fulcrum is owed."** it reasoned the deferral was
for SIZE alone, never a DIRT judgment — but five declines against a reviewer that repeatedly grades
the extraction *"cheap"* IS a judgment about ripple cost, weighed and re-weighed. that is a dirt
call, and a dirt call owes a fulcrum. the dream is fix-forwarded to point here.

## the reviewer's sharpest clause — and it is taken

> *"the repeated 'wet-over-dry' decline reads like the wrong rule applied to the question. This isn't
> a 'wait for 3 usages' case — it's about grain separation, not deduplication."*

**correct.** `rule.prefer.wet-over-dry` governs when to abstract a REPEATED pattern; this is one
function at two grains, which `define.domain-operation-grains` + `rule.require.orchestrators-as-narrative`
govern. so the decline's stated rationale was mis-cited. the deferral still holds on SAFE/CLEAN
grounds above — but on the size/risk of a move of live dispatch code at the stone's close, not on
wet-over-dry.

## rework

**dirty on A (extract), clean on B (record).** the extraction touches one core file's ~200 lines of
control flow and wants a CI run to confirm — unavailable while commits are barred. the record is
this file.

## the settler that would resize this

> does an extract of `onCloud`/`onLocal` change any observable behavior, or is it a pure move?

a pure move (byte-identical dispatch, same delegates) makes A **clean** and collapses this to "take
it in a later round with a CI run to confirm." the settler is a `tsc` + full integration run after
the move — which is a `5.3.verification`-or-later act, because it needs a commit this route forbids.

## confidence, and why 85%

high that the record is the right move THIS round — the extraction is genuinely dirty-CLEAN with no
CI to confirm it, and five prior rounds concurred on the defer.

short of 93% on whether A is ultimately owed at all: the reviewer grades the extraction *"cheap"*
and each locus *"independently testable"*, which is a real maintainability gain; I grade the move
risky only at THIS stone's close. a later round with commit access should re-run the settler above
and likely take A.

## where

- `runLambdaEndpoint.onSerialized.ts` — the fused function
- `.dream/v2026_09_11.repair.onserialized-holds-two-loci-in-one-body.md` — the work, and the shape of branch A
- `define.domain-operation-grains` · `rule.require.orchestrators-as-narrative` — the rules the fusion crosses

## the verdict

🪘 **open — recorded as a fork so the council rules it, rather than a sixth round that declines it by attrition.**

the ask is one line: **extract the two loci now, or ratify the deferral to a commit-enabled round?**

- **extract** → A, dirty-CLEAN at this stone but cheap once a CI run can confirm the pure move
- **defer** → B, taken this round; the settler above runs when commits return
