# rule.require.positive-control-before-absence-claims

## .what

a claim that something is **absent** must rest on a search you proved was **looking in the right
place**. run a positive control first — the same query in a form certain to produce hits — then trust
the zero. a tool's silence is not evidence until you have shown the tool can speak.

```
# 👎 the zero is trusted on sight
rhx grepsafe --pattern 'forApiGateway' --glob 'blackbox/**'
#   -> 🐢 crickets...  matches: 0
#   "no acceptance test uses forApiGateway" -> FALSE. the glob is a BASENAME filter,
#   so a path-shaped glob matches no basename and reports zero, cheerfully.

# 👍 a control first, then the claim
rhx grepsafe --pattern 'forApiGateway' --path blackbox
#   -> 21 lines. the tool CAN see this directory, so now a zero would mean one.
```

## .why

an absence claim is the one claim whose evidence is indistinguishable from a broken instrument. a
positive find carries its own proof — you are looking at the match. a zero carries no proof at all,
and every failure mode of every search tool produces exactly the same zero:

- **a path-shaped glob against a basename filter.** `grepsafe --glob 'src/**'` matches no basename,
  so it returns zero. its peer skill `globsafe --pattern` IS path-shaped, so two similar-looking
  flags take opposite semantics, and the one that fails does so without a word.
- **a dot-directory.** ripgrep skips hidden directories by default, so a search of `.behavior/` or
  `.agent/` returns `No matches found` for a pattern present on every page.
- **a name that does not exist.** `--glob 'forApiGateway.ts'` returns zero when the file is
  `genLambdaEndpoint.forApiGateway.ts` — and an export whose name differs from its file makes this
  the *likely* mistake, not the rare one.
- **a scope narrower than you think.** a default `--path .` that excludes `node_modules`, a
  gitignore-aware walk, a `--type` filter that omits the extension you need.

not one of these emits a warn. each prints the same calm zero a real absence prints. so an absence
claim made without a control is a claim whose confidence is unearned — and the danger is precise:
**the zero is exactly the answer that ends the search.** a false positive gets investigated and
corrected; a false zero closes the question and ships.

measured on the case that produced this rule: a self-review leaned on `--glob 'blackbox/**'` zeros
across three rounds. one of those zeros gated a **blocker fix** — the unexport of three public types
on the claim that no acceptance test asserted them. re-run in the sound form, the claim held. it held
**by luck**: at the moment it was written, a real absence and a tool artifact were the same
observation.

## .the test — for the proposer

before you write "there is no X", ask: **"have I shown this search can find any hit at all?"**

| what you have | verdict |
|---|---|
| a zero, plus the same query in a form that produced hits | ✅ claim the absence |
| a zero, plus a hit in the searched scope for a pattern certain to match | ✅ claim the absence |
| a zero alone | **not evidence — run a control** |
| a zero from a query form you have not used successfully before | **not evidence — the form is the suspect** |

the cheapest controls, in order of preference:

1. **widen the same query** — drop the glob, keep the pattern. if the wider form finds hits and the
   narrow one does not, the narrowing is the suspect, never the codebase.
2. **invert the pattern** — search for a term you know is on every page of that scope (`import`,
   `export`, `const`). a zero here proves the scope itself is unreachable.
3. **list before you grep** — `globsafe` the directory and read the real filenames. this catches the
   nonexistent-name case, which no pattern change can.

and one habit that removes the whole class: **prefer `--path` over `--glob` for a directory bound.**
a path is a place; a glob is a filter over names. most absence claims are about a *place*.

## .the test — for the reviewer

find every absence claim in the artifact — "no X exists", "not one test asserts Y", "the only Z is",
"I searched for W and found none" — and for each ask: **"what proves the search reached the scope?"**

- a recorded query in a form that also produced hits → verified
- a recorded query with a zero and no control → **flag it; the claim is unfounded, whether or not it
  happens to be true**
- no recorded query at all → **flag it harder**; an unrecorded absence claim cannot even be audited

the tells:

- an absence claim with **no command recorded**. a positive find can cite a file and line; an absence
  can cite only its method, so a method left unstated is the whole evidence left unstated.
- a **glob that names a path** (`'src/**'`, `'blackbox/**/*'`) passed to a flag whose semantics the
  artifact never demonstrates
- a search of a **dot-directory** that returned zero — almost always the default-skip, not an absence
- an absence claim about a symbol whose **file name and export name differ**; the search likely used
  the name the author remembered
- a table of "what I did NOT find" where every row shares one query form, and that form is never
  shown to work

and the structural tell: **the artifact's negative claims are load-bearing for a deletion.** an
absence claim that justifies removal of code deserves the control most, because a false zero there
deletes a live consumer.

## .the caveat

- **this is not a demand to control every grep.** a zero you use to *guide* a search ("no hits here,
  look elsewhere") costs you little if wrong. the rule fires when a zero becomes a **claim** —
  recorded in a yield, cited in a review, or used to justify a deletion.
- **a positive control need not be a separate command.** a query that returns hits *and* shows the
  absence of your specific term among them is its own control — you have seen the tool read the
  scope.
- **a well-known-good form needs no fresh control each time.** once `--path src` is demonstrated in
  an artifact, later `--path src` zeros in the same artifact inherit it. cite the demonstration.
- **an absence proven by a type system or a compiler is already controlled.** `tsc` that reports no
  reference, a build that fails on a removed export, a test that goes red — each is a positive signal
  of the tool's reach, so no separate control is owed.
- **a claim about a value you emit, or a slot you share, is a different rule** — see below. this one
  is specifically about *absence*.

## .examples

### 👎 bad — a "what I did NOT find" list with one untested form

```md
## what I searched for and did NOT find
- no extant http harness anywhere in `blackbox/`
- no extant schema builder to reuse
- no second copy of the reconcile left behind
```

three deletion-adjacent claims, no command recorded, no control. if the query form was wrong, all
three are wrong together — and they read as three independent confirmations.

### 👍 good — each absence carries the form that produced it

```md
## what I searched for and did NOT find
each stated with the form that produced it — a bare "I found none" is not an acceptable line.

- **no extant http harness** in `blackbox/` or `src/__test_assets__/`
  (`globsafe 'blackbox/**/*.ts'` → 16 files, each read or listed — so the scope is reachable)
- **no `@deprecated` marker** in `src` (`grepsafe --pattern '@deprecated' --path src` → 0;
  the same `--path src` form returns 21 hits for `Translate`, so the tool reads this scope)
```

### 👍 good — the control that catches a nonexistent name

```
rhx grepsafe --pattern 'use\(' --path src --glob 'forApiGateway.ts'   ->  0
rhx globsafe --pattern 'src/.../genLambdaEndpoint.forApiGateway/*.ts' ->  12 files
#   the real name is genLambdaEndpoint.forApiGateway.ts — no pattern change would
#   ever have revealed that. only the directory listing did.
```

## .enforcement

- an absence claim used to justify a deletion, with no positive control recorded = **blocker**
- an absence claim recorded in a yield or review with no query form stated = **blocker**
- a path-shaped glob passed to a basename filter, with its zero read as a find = **blocker**
- a zero from a dot-directory search, read as an absence = **blocker**
- a zero used only to guide a search, never claimed = false positive
- an absence established by a compiler, a red test, or a failed build = false positive
- a later zero in a form the same artifact already demonstrated = false positive

## .see also

- `rule.require.measure-the-value-you-emit` — a claim about a value you **emit** owes a run
- `rule.require.read-the-slot-a-dependency-reads` — a claim about a slot you **share** owes a grep of
  the dependency's source
- ☝️ **those two plus this one are one family**: a claim sourced to something other than a verified
  observation. the first mistakes a vendor's type for a measurement, the second mistakes a shared
  role for a read, and this one mistakes a tool's **silence** for a result. silence is the most
  seductive of the three, because it feels like data.
- `rule.forbid.failhide` (mechanic) — a tool that returns zero for an unmatched glob is failhide in
  the tooling; this rule is the discipline that survives it
- `rule.require.trust-but-verify` (mechanic) — the general form; this names the source that most
  often masquerades as verification in a **review**
- `rule.require.review-attempts-deletion` — "which claim did I verify with an untested method?" is a
  deletion question
- `rule.forbid.unqualified-variant-exports` — an export whose name differs from its file makes the
  nonexistent-name zero the likely mistake rather than the rare one
