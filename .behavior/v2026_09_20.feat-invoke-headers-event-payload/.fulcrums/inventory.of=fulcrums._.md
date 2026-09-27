# inventory of fulcrums

every fork best-guessed on this drive, and every call made under 93% confidence.

**rework** = what it costs to reverse. `clean` = a rename or a swapped default that does not
ripple. `dirty` = callers hardened against it, or later work built upon it.

<!-- prettier-ignore -->
| case | title | rework | status | confidence |
|---|---|---|---|---|
| [F01](inventory.of=fulcrums.case=F01-the-wishs-payload-was-right-and-the-convention-was-wrong.md) | 🔴 **the wish's `payload` was RIGHT** — `{ headers, payload, event }` | clean | 🔴 **RULED**, per the wisher (was: `request`, 90%) | settled |
| [F02](inventory.of=fulcrums.case=F02-headers-earns-a-peer-slot-on-external-evidence-only.md) | `headers` earns a peer slot — on **78 measured production reads** | clean | open | 🔴 **96%** |
| [F03](inventory.of=fulcrums.case=F03-request-collides-with-middys-internal-bag.md) | ⛔ ~~`request` collides with middy's internal bag~~ — **MOOT**, `request` was struck by F01 | clean | 🌙 **dissolved** | n/a |
| [F04](inventory.of=fulcrums.case=F04-the-envelope-stays-a-live-alias-documented-not-frozen.md) | the envelope is **deep-frozen**, not merely documented | clean | 🔴 **RULED** — freeze, per the wisher (was: document, dirty, 80%) | settled |
| [F05](inventory.of=fulcrums.case=F05-the-exported-type-is-renamed-to-request.md) | `UnifiedApiGatewayEvent` **keeps its name**; the `*Payload` types become `*Wire` | clean | 🔴 **RULED** — keep (85% → rename → **back to keep**) | settled |
| [F06](inventory.of=fulcrums.case=F06-the-twin-does-not-follow.md) | the twin (`forAskEndpoint`) does **not** follow | clean | open | 🔴 **98%** |
| [F07](inventory.of=fulcrums.case=F07-a-clean-break-over-a-both-fields-release.md) | a **clean break**, over a both-fields release | clean | 🔴 **RULED** — hard cutover, per the wisher | settled |
| [F08](inventory.of=fulcrums.case=F08-header-key-case-unmeasured.md) | header keys are **lowercased**, not documented as unmeasured | clean | 🔴 **RULED** — case-fold, per the wisher (was: document, 82%) | settled |
| [F09](inventory.of=fulcrums.case=F09-the-readme-line-is-an-addition-not-a-staleness-check.md) | the readme acceptance line read as an **addition**, not a staleness check | clean | open | 84% |
| [F10](inventory.of=fulcrums.case=F10-the-terms-are-enbriefed-in-this-wish.md) | the four terms are **enbriefed in this wish**, not deferred to its own | clean | 🔴 **RULED** — enbrief, per the wisher | settled |
| [F11](inventory.of=fulcrums.case=F11-the-chronology-clause-is-reseeded-not-fixed-here.md) | the chronology clause is **reseeded**, and this yield cut to citations | clean | open | 88% |
| [F12](inventory.of=fulcrums.case=F12-the-schema-describes-the-pair-not-the-body.md) | `schema.input` describes **the pair** `{ headers?, payload }` — `headers` an OPTIONAL key | 🔴 dirty | 🔴 **RULED** — the pair + opt-in enforcement, per the wisher | settled |
| [F13](inventory.of=fulcrums.case=F13-the-envelope-carries-payload-not-body.md) | the envelope carries **`payload`**; the deletion that defended its absence is struck | clean | 🔴 **RULED** — one word, per the wisher | settled |
| [F14](inventory.of=fulcrums.case=F14-the-defended-exception-rule-is-reseeded-not-written-here.md) | the **defended-exception** rule is written here **AND** reseeded upstream | clean | 🔴 **RULED** — both, per the wisher (was: reseed only, 76%) | settled |
| [F15](inventory.of=fulcrums.case=F15-the-variant-export-defect-is-ruled-and-fixed-here.md) | 🔴 `src/index.ts`'s variant-export defect — `genLambdaEndpoint = forAskEndpoint & { forAskEndpoint, forApiGateway }`, and **no variant exported beside it** | 🔴 dirty | 🔴 **RULED** — option C, per the wisher (was: escalated; before that, open) | settled |
| [F16](inventory.of=fulcrums.case=F16-the-commit-and-the-rebase-are-sequenced-after-approval.md) | the `feat!` commit and the rebase are sequenced **after approval**, never before it | clean | open | 🔴 **97%** |
| [F17](inventory.of=fulcrums.case=F17-the-three-error-and-log-path-defects-are-dreamed-not-fixed.md) | the three error-path and log-path defects are **dreamed, not fixed** — each repair breaks a contract the wish's bound protects | clean | open | 🔴 **94%** |
| [F18](inventory.of=fulcrums.case=F18-the-envelope-compound-stays-restated-not-aliased.md) | the envelope's compound type stays **restated twice**, not extracted to an alias — the two sites are joined by a compile-checked assignment | clean | open | 🔴 **91%** |
| [F19](inventory.of=fulcrums.case=F19-the-jest-dotlog-snapshot-scan-is-dreamed-not-fixed.md) | jest's scan of the gitignored `.log/` is **dreamed, not fixed** — the trigger was removed, the trap left dormant | 🔴 dirty | open | 🔴 **93%** |
| [F20](inventory.of=fulcrums.case=F20-trail-rides-the-invoke-bag-in-sqs-and-not-yet-in-apigateway.md) | ⛔ ~~`trail` rides the `invoke` bag in `forSqs` and not in `forApiGateway`~~ — the wisher struck the **SLOT**, so `forApiGateway` was right all along | clean | 🌙 **dissolved** | n/a |
| [F21](inventory.of=fulcrums.case=F21-the-envelope-freeze-reaches-three-variants-and-not-the-fourth.md) | ⛔ ~~the freeze reaches **three** variants and not `forAskEndpoint`~~ — the wisher ruled **all four** freeze; the axis was a migration schedule | clean | 🌙 **dissolved** | n/a |

## ✅ 🔴 the one that needed a VERDICT — F15, escalated **and ruled** 2026-09-23

⛔ ~~**the only fulcrum on this board that awaits the wisher.**~~ — **struck. it was asked, and it
was answered the same day.**

> 🔴 **the verdict: neither A nor B.**
>
> ```ts
> genLambdaEndpoint = forAskEndpoint & { forAskEndpoint, forApiGateway }
> ```
>
> *"the only acceptable `genLambdaEndpoint` shape is the one that has
> `genLambdaEndpoint.{forApiGateway,forAskEndpoint,etc}` that rides on it. `forApiGateway` should
> never be directly exported"* · *"`forAskEndpoint` is acceptable as the default"* · *"both must be
> as leafs"* — the wisher, 2026-09-23

✅ **landed, and all six gates green** (969 tests, +2 for the new key-set clamp). enruled at
`rule.forbid.unqualified-variant-exports`; enbriefed at `domain.terms/genLambdaEndpoint.md`.

🔴 **and the ruled option is the one this board told the council to kill on sight** — see the struck
warn at the foot of this section. **the escalation was right; the recommendation was wrong.**

⚠️ **the pre-verdict case is kept verbatim below**, because the reversal is the record.

---

### the case as it stood, before the verdict

every other open row is best-guessed and driven on; this one was a question, asked.

it reached the wisher by the path the rules prescribe rather than by a silent deferral: a peer lane
(`repo-rules`, 5.3.verification) raised it as **blocker.1** — the **third** raise, and each earlier
answer had been an argument rather than a change
(`rule.always.reread-the-subject-a-repeated-find-names`). the re-read, plus an **architect** second
opinion, surfaced a fact **neither side of the fork had measured**:

```
ahbode/svc-gateway        package.json:85   "sdk-aws-lambda": "0.4.1"
ahbode/svc-home-services  package.json:76   "sdk-aws-lambda": "0.3.0"
```

🔴 **both consumers pin EXACTLY**, so no release reaches either automatically. the deferral's whole
case was *"it keeps `svc-home-services` outside the break"* — and that repo sits three minors behind,
so it absorbs the rename in one upgrade pr **whether this ships now or later**. ⇒ the deferral saves
it **zero**, and costs `svc-gateway` a **second 78-file pass**.

| | |
|---|---|
| **the driver recommends** | **A — land it now.** the two halves are not separable: to free the family name for `genLambdaEndpoint.forApiGateway`, the ask variant must give it up, so *"defer"* defers the `forApiGateway` half too — the half whose 78 consumer call sites are open right now |
| **the reason against, stated** | the wish's bound is explicit and procedural: *"this task changes `invoke`'s INPUT SHAPE only"*, and growth beyond it *"must stop and re-scope."* one upgrade pr would also **confound two independent breaks** in one changelog entry |
| **why it is the wisher's** | **F07 is exact precedent** — the same class of question (how much break does one release carry) went to the wisher and came back in one sentence. and F15 said so itself at 79%: *"it is the wisher's call, and I did not ask"* |

⚠️ ⛔ ~~**kill the `Object.assign` callable-namespace compromise on sight** — it puts two valid
spellings for one variant on a public surface, which is what **F07** rejected for `rawEvent`.~~

🔴 **STRUCK — this is precisely what the wisher ruled.** the cost it names is real; the F07 analogy
**inverts**. F07 rejected `event` **and** `rawEvent` — *two slots with two senses*, where a caller
can take the wrong one. the callable default is **one function reachable two ways**: there is no
second thing to take by mistake.

⇒ and the cost i never measured: option A imposes a migration on `ahbode/svc-home-services` **for a
rename it gains naught from**. option C costs that repo **zero** and achieves every outcome A does.
**the pin table two paragraphs up was the evidence, and i applied it to one fork arm only.**

---

## 🔴 the one to read first — F01 overturned the DRIVE, not the wish

⛔ ~~**F01 overturns the wish's own lead proposal.** the wish names `payload`… this drive proposes
`request` instead, on evidence the wish did not carry.~~

**struck.** the wish was right and this drive was wrong, twice, on one premise nobody examined:

> **aws and http disagree about "payload", and api gateway is http.**

the repo had adopted **aws's** whole-message sense of `Payload` inside an **http** family. that
forced `event` to narrow to mean *the body*, which left the envelope nameless — and `rawEvent` is
the scar. `request`, the term this drive invented next, was reachable **only while that narrowing
held.**

⇒ the ruled shape is the wish's own word, one level lower than the wish put it:

```ts
invoke: ({ headers, payload, event }) => …
//        projection  the body   the whole object
```

⚠️ **F03 dissolved as a consequence** — it existed only to manage `request`'s collision with
middy's bag, and `request` is gone. a fulcrum that vanishes when a premise is corrected is the
signature of a defect at the shape grain, never at the detail grain
(`rule.require.review-attempts-deletion`).

### what this cost, stated plainly

| rounds | spent on |
|---|---|
| 1–3 | the case **against** the wish's word — correct reasoning, false premise |
| 4 | `request`, and a type rename to match it |
| 5 | ⇒ both struck in one wisher sentence |

**the premise was checkable at any point.** rfc 9110 calls it the *"payload body"*. no measurement
was needed — only the question *"does this word mean, in http, what we decided it means?"*

## 🔴 the RE-SCOPE — F12 + F13 widen the wish, deliberately

the wish carries a hard bound: *"a proposal that demands more has grown into a different task and must
stop and re-scope."* ⇒ F12 and F13 trip it, and the wisher re-scoped on 2026-09-21 rather than press
on. what the route now carries, against what the wish asked for:

| | the wish | after the re-scope |
|---|---|---|
| `invoke`'s bag | `{ headers, payload, event }` | unchanged |
| the envelope's body slot | untouched | 🔴 `body` → `payload`, and the `as`-cast dies (**F13**) |
| `schema.input` | untouched — describes the body | 🔴 describes **the pair** (**F12**) |
| `UnifiedApiGatewayEvent` | name and shape untouched | name kept, **gains a type parameter** |
| header keys | untouched — verbatim, either version | 🔴 **lowercased** (**F08**) |
| the handed envelope | untouched — a live, mutable alias | 🔴 **deep-frozen** (**F04**) |
| behavior | ⛔ none — *"field names, type names, no behavior"* | 🔴 **three changes** — see below |

🔴 **the last three rows are what leaves the wish's own bound**, and they are the reason this is a
re-scope rather than a widen. every prior entry on this drive could say *no behavior changes*. F12,
F08, and F04 cannot.

### 🔴 the behavior changes, each graded by who it can break

| the change | can it refuse or break a request that succeeds today? |
|---|---|
| **F12** — a header schema may refuse a request | ⛔ **no.** `headers` is an OPTIONAL key; the 65 unguarded sites declare none, so the guard is **opt-in**. the earlier *"new 400 path"* claim is struck |
| **F08** — header keys lowercased | ⚠️ **only a reader that indexes a capitalized key.** measured **0** across every consumer's `src/**`, control 68. the one residual is a downstream package I cannot read |
| **F04** — the envelope is frozen | ⚠️ **only a handler that writes to it.** measured **0** vendor writes across 5 middy packages; the 78 consumer sites read and forward |

⇒ **all three fail loudly** — a zod error, a key miss, a `TypeError` — and none fails silently, which
is the property that decides whether a behavior change is shippable at all
(`rule.forbid.failhide`).

⚠️ **the honest residual: F08's downstream read site is unmeasured.** if it indexes a capitalized key
it is already broken under v2 today, so the fold cannot worsen a deployment that works — but that is
an argument, not a run.

## 🔴 the SECOND inversion — F05, **A at 85% → struck, B ruled**

⚠️ this section was headed *"the one that inverted"*. there are two, and both fell to the **same
defect**, which is the point worth more than either entry.

F05 held that the exported type keeps its `…Event` name, on one sentence: *"`B` is a **second
public break**."* the wisher asked why the type should not simply be renamed. measured:

```
git.repo.get files --in ahbode/svc-gateway       --words 'UnifiedApiGatewayEvent' --paths 'src/**'  ->  0 files
git.repo.get files --in ahbode/svc-home-services --words 'UnifiedApiGatewayEvent' --paths 'src/**'  ->  0 files
  positive control, identical form:  --words 'sdk-aws-lambda'                                       ->  101 / 5 ✅
```

⇒ **the break was zero.** the type is exported and no consumer names it. 37 internal lines, one
`sedreplace`. A's only real objection did not exist, and it was never checked.

and the wisher's case was better than the one A argued against: the **noun flips mid-pipeline** —
`…RequestPayload` → `…Event` → back — which is a `rule.require.ubiqlang` break and very likely the
**origin of `rawEvent` itself**.

## 🔴 the class BOTH inversions share — **5 instances**, one drive

> **a claim stated in the confident register of a measurement, with no observation behind it.**

| # | the claim | what was true | the source it was drawn from |
|---|---|---|---|
| 1 | *"zero production consumers org-wide"* (F02) | 78 files — the search was aimed at `ehmpathy/*` | a search's **aim** |
| 2 | *"a repo outside the `ehmpathy/*` scope"*, priced at 8% (F07) | a named gap is a search declined, never a residual | a search's **reach** |
| 3 | `found: N files in 1 repos` | 5 repos had **fetch-failed**, in a warn nobody read | the tool's own **report of its reach** |
| 4 | *"a second public break"* (F05) | **0 consumer files**, controlled | an unexamined **cost estimate** |
| 5 | 🔴 *"a drive that overturns itself owes the reader the reason"* (F11) | it appears in **no brief**. i wrote it, then cited it back to myself | 🔴 **the rule set itself** |

⚠️ **rows 1–4 are one species and row 5 is another, and row 5 is worse.** a false measurement gets
re-run; a false **rule** gets obeyed. it was checkable by one grep against `.agent`, and nobody —
me least of all — thought to run it until the wisher asked *"where did you get this idea from?"*

⚠️ each instance is cheaper to catch than the last and **none of them was caught by a self-review**.
1 and 3 fell to a re-run; 2 fell to a reviewer; 4 and 5 fell to a wisher's one-line question.

⇒ the operational rule this yields: **an assertion is a measurement or it is a guess.** there is no
third state, and the confident register does not make one. ⚠️ **and it reaches your own citations**:
a rule you cite is a claim about the rule set, and it owes a grep exactly as a claim about a
codebase does.

## 🔴 the first inversion — F02, 78% → 71% → **96%**

F02 was titled *"on external evidence only"* and carried the thinnest confidence on the drive, for
three rounds. **self-review 4/5 inverted it.**

```
git.repo.get files --in ahbode/svc-gateway --words 'rawEvent' --paths 'src/**'   ->  78 files
```

> `…/rest/mutation/sendQuote.ts:75-76`
> `invoke: async ({ event, rawEvent }) => (await handle({ headers: rawEvent.headers, body: event })).body`

⇒ **`headers: rawEvent.headers`, 78 times, in production.** the wish's claim was right; my
measurement said zero because **i searched `ehmpathy/*` and the consumer lives in `ahbode/*`**.

⚠️ **the control passed and could not have saved me.** it proved the tool reads `ehmpathy/*` — which
was never the question. *a control proves your instrument works; it says not one word about whether
you aimed it somewhere true.*

⚠️ and F07 had **named this exact gap** and priced it at 8%: *"a repo outside the `ehmpathy/*`
scope."* ⇒ **a residual you can name is not a residual — it is a search you declined to run.**

⇒ the same find struck F07's *"no installed base"* leg. **the decision survived both** — the wisher
ruled a hard cutover with 78 on the table — but two entries had to be corrected rather than quietly
edited.

### the earlier 7-point drop, still on the record

**F08 declared itself orthogonal to F02, and F08's own body refutes that.** a peer slot raises a
read's *frequency*, and the key-case hazard's cost is `frequency × severity`. the correction is
recorded in both entries.

⚠️ the general lesson: **two fulcrums that touch the same field are not orthogonal by default**, and
a self-issued orthogonality claim is the one least likely to be audited
(`rule.require.trust-but-verify` — *"verify inherited claims, above all your own"*).
