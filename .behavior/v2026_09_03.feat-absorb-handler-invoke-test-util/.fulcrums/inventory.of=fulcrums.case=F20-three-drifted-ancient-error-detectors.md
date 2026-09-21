# F20 — "is this an ancient error envelope" is answered THREE times, and the three disagree

| field | value |
|---|---|
| **rework** | **dirty** on A/B/D · clean on C and **E** |
| **status** | ✅ **CONTEMP third UNIFIED + made EXACT by F22** 2026-09-13; ancient thirds differ by boundary, by design; the full collapse is answered — do NOT collapse |
| **confidence** | 81% → 89% → 92% → **95%** ⬆️ — the settler ran at i027, and at i028 the collapse was measured **lossy**; see below |
| **raised** | i025 r011 `enroll-impl-arch-defects`; the root cause **independently confirmed** at i026 by that lane AND by `enroll-impl-behavior-intent` |
| **where** | `lambdaEndpointWire/getParsedResponse.ts` · `…/error/getIsLambdaErrorResponse.ts` · `…/error/getIsContempErrorTagged.ts` · `runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope.ts` · `domain.objects/LambdaEndpointErrorResponseBody.ts` |

## ✅ addressed by F22 — the contemp third, and the collapse question answered

the council question F19 shares with this row — *may a classification rest on a declaration or a
shape, where an authoritative signal exists or could?* — was ruled by the wisher via F22: **make the
signal exist where you can.**

| the third | F22's effect |
|---|---|
| the CONTEMP detector | ✅ ONE shared implementation (`getIsContempErrorTagged`, unified at i029), now version-stamped and **exact** — the tag is an authoritative signal we author end to end |
| the two ANCIENT detectors | unchanged, and that is the verdict: the ancient wire has no signal to stamp, so the wire check (`'errorMessage' in parsed`) and the run check (both fields, both string) legitimately answer different questions — see `getIsAncientErrorResponse`'s own docblock |

⇒ **the "collapse the three into one" deferral is answered: do NOT collapse.** i028 measured the
collapse LOSSY, and F22 states why in structure — the contemp third rests on an authoritative tag,
the two ancient thirds rest on a shape at two boundaries that ask different questions. one
implementation cannot serve all three without loss of a real distinction.

**the contemp third retains no open question.** the ancient thirds stay as documented, per-boundary
heuristics — the wire's own ambiguity, not this code's.

## the drift, stated fairly

one domain question — *"is this parsed payload an ancient-dialect error envelope"* — has three
implementations, and they do not agree:

| where | shape required | the boundary it gates |
|---|---|---|
| `domain.objects/…ErrorResponseBodyAncient` | `errorType: string` — **required** | the canonical type, lifted at **F16** to be the one source of truth |
| `lambdaEndpointWire/…/getIsAncientErrorResponse` | `'errorMessage' in parsed` — **no type check, `errorType` never inspected** | `getParsedResponse`, i.e. the wire hydration on BOTH loci |
| `runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope` | both fields, both typed `string` | `onReferenced`'s return-type narrow |

⇒ **F16 lifted the TYPE and left the two PREDICATES where they were.** its stated reason —
*"one operation writes it, another types it"* — closed the reach-in for `runLambdaEndpoint` and never
reconciled the file one directory over.

## 🔴 and it is F19's ambiguity, in a WIDER form, on the boundary this wish newly exercises

**F19** documents the shape-alone heuristic on the *referenced* boundary: a legacy handler whose
legitimate SUCCESS output happens to be shaped `{ errorMessage, errorType }` reads as a rejection.
that row was analyzed, clamped, and documented.

`getIsAncientErrorResponse` has the same hazard on the **serialized** boundary and it fires on
`errorMessage` **alone** — so the ambiguous set is strictly larger. the actor is the one this whole
wish exists to admit:

> a `createStandardHandler` handler — the **F7 majority**, 19 of 20 repos — that legitimately returns
> `{ errorMessage: "…" }` as business data, run through `onSerialized`, is misclassified as a lambda
> failure and thrown as a `LambdaEndpointError`.

⇒ the reviewer's own summary is exact: *"the hazard was found, reasoned about at length, and
fixed/documented on one boundary, while an older, looser copy of the identical logic sits unexamined
on the other — newly reachable through this wish's own new surface."*

### 🔴 it reaches BOTH loci, and it is STRICTLY WORSE on `local`

⚠️ **this section named `at: 'cloud'` alone until i038 r011 `enroll-impl-behavior-intent` (D1), and
the row's own table three lines up already said otherwise** — *"the wire hydration on BOTH loci."*
so the page carried the wider truth in one cell and the narrower one in its headline actor sentence,
which is the cell a reader quotes.

the local locus hydrates through the very same operation:

```ts
// runLambdaEndpoint.onSerialized.ts:356-361 — the local return
return getParsedResponse<WireDelivered<TOutput>>({
  payload: asWirePayload(output),
  functionError: undefined,   // ← :358. there is no aws to ask
  endpoint,
  exid,
});
```

🔴 **and the `undefined` is what makes local the harder half, which inverts how this row had ranked
the two:**

| locus | discriminators in hand | what branch E can do |
|---|---|---|
| `cloud` | aws's `functionError` **and** the payload shape | catches *"aws said fault, no shape matched"* |
| `local` | the payload shape, **alone** | 🔴 **naught** — the verdict is always `undefined` |

⇒ so the shape heuristic is not the *primary* discriminator on the local locus; it is the **only**
one. branch E narrowed the cloud half and left the local half exactly as it was — which is correct
(`:358` reads *"no verdict — trust the shapes"* rather than *"no error"*, the distinction that made D
dirty and E clean), and it means **the residue this row leaves open is concentrated on the locus that
runs in every ci pipeline.**

🟡 **it does not raise the severity, and it widens the reach.** the settler's zero (250 matches, 24
repos, no success payload) was over producers rather than over loci, so it covers `local` and `cloud`
alike — the hazard stays *real and unexercised* on both. what changes is the council's picture: a
verdict that reaches for `functionError` as the answer repairs one locus and cannot reach the other.

## 🔴 the root cause the review did not name — the authoritative signal is already in hand

`getParsedResponse` **receives** aws's own verdict and **never reads it**:

```ts
// getParsedResponse.ts:23-28 — the input type
export const getParsedResponse = <TResponse>(input: {
  payload: Uint8Array | undefined;
  functionError: string | undefined;   // ← :25, declared
  endpoint: LambdaEndpoint;
  exid: string | null;
}): TResponse => {
```

`functionError` appears **once** in that file — in the signature. the body classifies by payload
shape instead, for all 108 lines of it.

and the value is real, not a placeholder: `sdkLambdaInvoke.ts:38` maps it from aws's
`result.FunctionError`, `executeLambdaInvocation.ts:86` forwards it — and a **peer operation in this
same repo already uses it**:

```ts
// getOneLambdaContract.ts:110
if (response.functionError) { … }
```

⇒ **so the serialized boundary holds an unambiguous aws-authored signal and guesses from payload
shape beside it.** that is a sharper statement of the defect than "three copies drifted", and it
names a branch the reviewer's "collapse to one predicate" does not reach.

⚠️ **and it is not a one-line fix, which is the honest half.** the LOCAL locus has no aws to ask, so
it passes `functionError: undefined` (`runLambdaEndpoint.onSerialized.ts:457`). a discriminator that
reads `functionError` would work on `cloud` and fail open on `local` — the exact locus divergence
this drive spent i024 to repair. the local locus would have to synthesize the signal it already
holds, since it knows it caught a throw: `asWireFunctionErrorPayload` sits on that `.catch`.

## the branches, priced

| branch | what it does | rework |
|---|---|---|
| **A** — tighten the wire predicate to the strict one | one predicate, both boundaries | 🔴 **dirty** — see below |
| **B** — loosen the strict predicate to the wire one | one predicate, both boundaries | ❌ **worse.** it widens F19's hole rather than closes it |
| **C** — clamp the agreement where it holds; document the threshold divergence | states the contract the code actually has | ✅ **clean — SHIPPED** |
| **D** — make `functionError` the PRIMARY discriminant, synthesized on `local` | replaces the heuristic outright | 🔴 **dirty** — the local locus has no verdict to synthesize from |
| **E** — read `functionError` as a LAST-RESORT narrow, and only in the present direction | closes the failhide half with no local-locus change | ✅ **clean — SHIPPED at i026** |

## 🔴 branch E — found because the reviewer named the defect better than I had

at i025 I had this row as *"three detectors drifted, root cause is an unread parameter"* and priced
the only `functionError` branch as **dirty**. the i026 lane put it differently:

> *"the defect isn't 'three drifted detectors that need reconciling' — it's a **dead, misleading
> parameter on a shared operation** … the signature *implies* the ground truth is consulted, so a
> maintainer reading the call site has every reason to believe a real AWS fault classification backs
> the throw/return decision. It doesn't."*

⇒ and it named two moves: wire it in, or delete it from the signature. **a third exists, and it is
both safe and clean**, which is why it shipped on sight rather than waited for a council:

🔴 **the fall-through at `getParsedResponse.ts:116` was a LIVE FAILHIDE, and no lane had named it.**
where aws reported a fault whose payload matched neither envelope shape, the operation
`return parsed as TResponse` — **it handed a reported fault to the caller as a success**.

| aws said | shape matched | before | after E |
|---|---|---|---|
| fault | yes | throws, richly classified | **unchanged** — the shape branches still win |
| fault | **no** | 🔴 **returned as a success** | throws, with the payload in metadata |
| no fault | — | unchanged | **unchanged** |

**it only ever narrows.** it converts no extant throw into a return, so it cannot commit the inverse
failhide branch A risks — which is exactly why it needs no council where A does.

🟡 **and it does not fail open on the local locus**, which is what made D dirty and E clean:
`onSerialized.ts:457` passes `functionError: undefined`, which reads as *"no verdict — trust the
shapes"* rather than as *"no error"*. **aws is consulted where it spoke, never assumed silent where
it could not speak.**

⇒ clamped by four assertions at `getParsedResponse.test.ts` `[case8]`/`[case9]` — the rule is a
CONJUNCTION (aws said fault **and** no shape matched), so it takes a pair per direction. bite-probed
both ways: the check stubbed off → 2 fail; the check inverted → the suite dies at collection.

⚠️ **what E does NOT do: it leaves the three predicates unreconciled.** a payload shaped
`{ errorMessage }` from a handler that legitimately returns it, with no aws fault, is still
misclassified exactly as before. that is the half a council still owns.

## why A is dirty — MEASURED, never asserted

this drive has been overruled **three times** (F13, F14, F16) for a grade asserted from a mental
model of the blast radius. so this row measures first, and reports what the measurement says even
where it argues against the entry's own call:

| what | measured 2026-09-11 |
|---|---|
| occurrences of the four exports | **42, across 7 files** |
| of those, the **public barrel** | 🟡 **zero** — `rhx grepsafe … --glob 'src/index.ts'` → 0 matches |
| the extant clamp on the loose behavior | `getIsLambdaErrorResponse.test.ts:105-113` asserts `{ errorMessage }` **alone** → `true` |

🔴 **so the CLEAN half of the test PASSES, and A is dirty on SAFE instead.** this is the first row on
this board whose dirt is a behavior claim rather than an edge count — and the distinction is the one
F16 got wrong in the other direction.

what A actually changes: a payload with `errorMessage` and no `errorType` flips from *"an error, so
throw"* to *"a success, so return"*. **the failure mode is a real lambda error handed back to a
caller as a success payload** — `rule.forbid.failhide`, on a wire boundary, for any producer this
drive has not enumerated.

⚠️ **and the population is not enumerable from here.** both producers I *can* read always set
`errorType` — `getErrorResponseBodyAncient` requires it as an input, and aws's own `Unhandled`
response carries it. but `getIsAncientErrorResponse` parses **whatever a lambda returned**, and this
wish's own premise is that the population is 20+ repos of handlers nobody has audited.

## 🔴 why the TYPE cannot be reconciled ahead of the predicates

the obvious cheap half — alias the local `LambdaErrorResponseAncient` to the canonical
`LambdaEndpointErrorResponseBodyAncient`, which F16 lifted for exactly this purpose — **is not
clean, and the reason is F19's.**

| | local type | canonical type |
|---|---|---|
| `errorType` | `?: string` — optional | `: string` — **required** |

a predicate that checks `'errorMessage' in parsed` and narrows to a type that **promises**
`errorType: string` hands out a type the value need not satisfy.

⇒ **that is F19's soundness hole, cloned onto the wire boundary by a change that looks like pure
cleanup.** the three type declarations are not careless duplication; each is an honest reflection of
a different check. unify the types while the checks stay apart and you manufacture the defect.

🟡 **so the reviewer is right that the fix is structural rather than another patch, and wrong that it
is therefore cheap.** the type drift is a *symptom* of the predicate drift, and it can only be
repaired in that order.

## what shipped — branch C

`serde/asWireFunctionErrorPayload.test.ts` `[case4]`, three assertions:

| assertion | what it holds |
|---|---|
| the wire detector classifies this function's real output as an ancient error | the agreement, where it holds |
| the stricter run detector agrees on the same payload | 🔴 the two boundaries cannot disagree about a payload **this** function produced |
| a SUCCESS output is refused by **both** | without it the pair passes on a predicate that answers `true` for every input |

⇒ this is the **F4 split** applied on sight: take the half that moves a real cost, leave the half
that needs a council. the divergence itself stays clamped as a KNOWN limit in
`isLambdaEndpointErrorEnvelope.test.ts`, never restated here.

## 🟡 why the confidence moved 81% → 89% → 92% → 95%

**92% → 95%, at i028: a lane proposed the collapse, and the collapse turned out lossy.** the section
above carries it — `errorType?` is optional because aws emits it that way, so a both-fields predicate
refuses a real payload. ⇒ the deferral is no longer *"expensive to reverse"*; it is *"the reversal
deletes a case."*

🟡 **95% is the bar above which `rule.always.itemize-the-fulcrums-you-best-guess` no longer demands a
row** — and this row stays anyway, because the question that remains (should the two share an
implementation?) is a design call a council owns, never a confidence I can raise my way out of.



**the i025 entry priced itself DOWN for a stated reason, and i026 removed that reason:**

> *"it sits below F19's 84%, deliberately: F19's confidence rose on two independent lanes that
> converged; this row has one lane plus my own root-cause read, which is weaker evidence than
> convergence and is stated as such."*

⇒ **at i026 the convergence arrived.** two lanes reached the unread `functionError` independently,
neither with the other's text:

| lane | how it reached the root cause |
|---|---|
| `enroll-impl-arch-defects` | from the SIGNATURE — *"declares `functionError` in its input type but **never reads `input.functionError` anywhere in its body**"* |
| `enroll-impl-behavior-intent` | from the PAIR — *"each is patched locally … rather than fixed at the root (AWS's own `functionError` signal, sitting unread in `getParsedResponse`)"* |

that is the same convergent evidence that moved F19 76% → 84%, and this drive has learned to trust
it over its own read. **a third confirmation is that the arch lane verified the parameter is
dead on *every* call path rather than hypothetically** — it checked both call sites.

### 🔴 89% → 92% — the settler ran, on the key THIS row's detector uses

at i027 the same lane ran the population search both rows had named and neither could reach: **250
matches, 24 repos, zero success payloads.** see the settler section below.

⚠️ **it lands harder here than on F19, and that inverts the two rows' order.** the search was on the
bare key `errorMessage` — which is this row's wire predicate verbatim (`'errorMessage' in parsed`),
and one field looser than F19's pair. so the looser detector got the looser evidence, and the zero
covers it exactly.

⇒ **this row now sits ABOVE F19 (92% vs 91%)**, where it opened three points below. the settler's
shape is what moved it, never a fresh argument.

what still holds it short of 95% is that **the two readings of the residue both survive**, and they
disagree about severity rather than fact:

- the drift is **bounded by producer reality** — every producer either lane can read always sets
  `errorType`, so the divergence window is empty in practice and C+E are the whole correct answer
- against that: the window is empty **only for producers we enumerated**, and this wish's premise is
  a population of unaudited handlers. under that read C+E close the failhide and leave the
  misclassification

## 🔴 rule this row WITH F19 — the behavior lane's ask, and it is right

> *"**F19 and F20 are the same underlying soundness class** (a shape-heuristic classifying 'is this
> an ancient error envelope,' with no authoritative discriminator) surfacing on two boundaries at two
> different confidence levels … a single council ruling on 'should the dialect/error-classification
> be runtime-verified rather than type-declared-and-trusted' would likely resolve both at once."*

✅ **taken, and it changes how this row should be read.** both rows are the same question asked at
two boundaries:

| row | the boundary | what it trusts instead of a verdict |
|---|---|---|
| **F19** | referenced | the caller's **declared** `TDialect`, erased at runtime |
| **F20** | serialized | the payload's **shape**, where aws's verdict was in hand |

⇒ so a council that rules them apart can produce two answers that do not compose. **the shared
question is one line: may a classification rest on a declaration or a shape, where an authoritative
signal exists or could?**

🟡 and branch E is evidence for one half of that answer already: where the signal genuinely existed,
it was free to use, and its absence had been hiding a failhide for the whole drive.

## ✅ the settler — ASKED twice, RUN at i027, and it came back zero

> does any real handler return `{ errorMessage }` **without** `errorType` as a SUCCESS?

**`enroll-impl-arch-defects` ran it, and the search it chose answers THIS row more directly than
F19's.** it searched the bare key `errorMessage` — 250 matches, 24 repos — which is exactly the
predicate this row's wire detector uses (`'errorMessage' in parsed`), one field looser than F19's
pair. **not one match is a success payload.**

⇒ so where F19's zero is over the *pair*, this row's zero is over the *single key* — the looser
question, answered on the looser evidence. 🟡 **that makes the measurement stronger here than there**,
which is the opposite of how the two rows' confidences had been ordered.

✅ **spot-verified rather than taken on report**, on a repo the lane never named:

```
ahbode/svc-quotes  → 1 match · { providerUuid, errorMessage: error.message } · inside a log call
```

⇒ a bare `errorMessage`, in a live repo, with no `errorType` beside it — **exactly the shape this
row's detector would misread** — and it is a log argument, never a handler's return.

## 🔴 i028 — the word "DRIFT" was wrong about at least one of the three

`enroll-impl-arch-defects` (i028 r011) raised the pair as a blocker and offered a collapse:

> *"one canonical `isLambdaEndpointErrorResponseBodyAncient`/`…Contemp` pair, colocated with
> `LambdaEndpointErrorResponseBody` in `domain.objects/` … with both `getParsedResponse` and
> `isLambdaEndpointErrorEnvelope` built on it."*

⚠️ **the collapse would DELETE A CASE, and the case is aws's.** two files in this package already
declare it, and this row had cited neither:

| declaration | what it says |
|---|---|
| `getIsLambdaErrorResponse.ts:19-21` | `errorType?: string` — **optional**, on a type whose docblock reads *"from AWS Lambda or old genLambdaEndpoint"* |
| `getParsedResponse.ts:21` | the same `errorType?` in the operation's own header |

⇒ **a lambda that exceeds its duration answers with an `errorMessage` and no `errorType`.** a
both-fields predicate refuses it, so the payload falls to branch E's generic message and the specific
one is lost — on the most common production failure there is.

### so the three are not three answers to one question

🔴 **THE THREE ARE ONE TYPE AND TWO PREDICATES — and only the predicates ANSWER a question**, which
is why the table below has two rows under a header that says three:

| of the three | what it is | does it answer the question? |
|---|---|---|
| `LambdaEndpointErrorResponseBodyAncient` | a **type declaration** | no — it declares a shape |
| `getIsAncientErrorResponse` | a **predicate** | yes |
| `isLambdaEndpointErrorEnvelope` | a **predicate** | yes |

| predicate | requires | the question it answers |
|---|---|---|
| `getIsAncientErrorResponse` (wire) | `errorMessage` alone | *"did the upstream fault, by any route?"* |
| `isLambdaEndpointErrorEnvelope` (run) | both, both `string` | *"did MY handler return an envelope?"* |

⚠️ **so TWO live counts are both correct, over one subject, and the page said which for neither:**

| the count | what it counts | where it is stated |
|---|---|---|
| **three** | one type + two predicates | this row's title and its `where` field |
| **two** | the predicates alone | i035 r011 and i036 r011, both by grep |

🔴 **and the ambiguity is not idle — it manufactured a blocker at i036 r011.** that lane read *"three"*,
went to find the third **detector**, and named `genLambdaEndpoint/middleware/getErrorResponseBody.ts`
— which **produces** the envelope and detects naught (`:50`, `:56-57`: three field WRITES, no
`typeof`, no branch). a false third, reached by a reviewer that had been told to expect one.

⇒ **a count is unreadable until its SET is named beside it.** the drive's signature defect is an
unmeasured claim; this is its quieter twin — a measured claim whose subject is unstated, so two honest
readers count two different things and each reports the other as wrong.

🟡 **the filename keeps the word `three`, deliberately.** it is a cited identifier (the `_.md`
summary row and several `.taken` files point at it), and the drive already learned at r4 that a
rename which fixes a word orphans every reference to it — *"a triage adds a mark and an order; it
must not re-name an identifier the whole drive already cites."*

🔴 **that is a real distinction, and it was nowhere in the code.** the predicate's `.why` read
*"ancient errors have flat errorMessage property"* — which states the shape and not the looseness —
and its test was labelled `[case1] object with errorMessage` / `returns true`, three labels that name
an input and no purpose.

⇒ **a test whose name states only its input is a test a reviewer cannot weigh**, so two lanes and
this row all read an intentional case as an accident. ✅ repaired at i028: the docblock carries the
aws citation and the downgrade it would cause; the test is renamed to
`[case1] an aws-shaped fault — errorMessage with NO errorType`.

🟡 **and this makes branch A/D MORE clearly dirty, never less.** the row had priced the collapse as
expensive; it is now known to be **lossy** as well — it removes a payload the package's own types
call legal.

⇒ what remains genuinely open is narrower than *"three drifted"*: **is the third detector redundant,
and should the two that answer different questions share an implementation that keeps both?** that is
the council's, and it is one question rather than three.

### 🔴 what the zero CLOSES, and what branch E already closed

| half of this row | status |
|---|---|
| the **failhide** — a reported fault returned as a success | ✅ **fixed at the root**, branch E, shipped and bite-probed |
| the **false positive** — a success payload misread as an envelope | ✅ **settled by the zero**: real, and unexercised |
| the **drift** — three predicates, three answers, on one question | ⬜ **open.** the zero says no collision occurs *today*; it does not reconcile the three |

⚠️ **so the row still does not close, and the reason is now narrow enough to state in one line**: a
measurement of what consumers ship cannot settle whether three detectors in *this* package should
agree. that is a design call, and it is the council's.

## 🟡 .the SHAPE a "yes" would take — so a council can price the ANSWER, not merely the question

added at i030 r011, which offered it and correctly marked it *"post-ruling"* and *"low urgency"*:

> *"give the three strategies one named home (e.g. a small `LambdaEndpointErrorDiscriminant` module
> with `.byDeclaredDialect` / `.byShape` / `.byWireVerdict` as siblings) **so the taxonomy is
> asserted by file structure, not just by comment**."*

⇒ **the last clause is the argument.** today the relationship between the three predicates is
asserted only in prose — three docblocks that cross-reference each other — and this drive has
already watched a cross-referenced docblock outlive its own premise by 13 iterations (i029, item A).
a file structure cannot go stale the same way.

| if a council rules… | the move |
|---|---|
| **"yes, share one home"** | one module, three named siblings. each keeps its own strictness; what is shared is the **taxonomy**, never the predicate |
| **"no, they answer different questions"** | ✅ naught to build. the three stay where they are, and the docblocks already carry the reason |

🔴 **it is NOT built ahead of the verdict, and the reason is this row itself.** to give the three a
shared home is to assert by file structure that they belong to one taxonomy — which is precisely the
question this row asks. so the build would presuppose its own answer
(`rule.prefer.wet-over-dry`, `rule.always.defer-fulcrums-to-last`).

## .see also

- `F19` — the same hazard on the referenced boundary, narrower. the two close together or not at all
- `F16` — the lift that reconciled the type and left the predicates. this row is its residue
- `F7` — the majority actor who meets this: 19 of 20 repos, still on `createStandardHandler`
- `rule.always.fix-forward-under-scouts-honor` — the SAFE/CLEAN split that let C ship now
