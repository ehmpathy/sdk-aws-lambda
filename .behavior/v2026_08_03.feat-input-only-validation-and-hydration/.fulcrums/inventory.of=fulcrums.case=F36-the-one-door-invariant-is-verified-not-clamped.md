# F36 — the "one door to `z.toJSONSchema`" invariant is verified, never clamped

| field | value |
|---|---|
| **case** | F36 |
| **title** | a structural invariant the whole change rests on has no mechanical guard |
| **rework** | ~~dirty~~ → **clean**, measured — one new `.integration.test.ts`, no config touched |
| **status** | ✅ **RESOLVED — clamped, and the clamp is proven to bite.** no wisher call is owed |
| **confidence** | — (the fork dissolved; a run replaced the estimate) |
| **where** | `src/domain.operations/genLambdaEndpoint/middleware/genIntrospectionMiddleware.getJsonSchemaFromZod.ts:94` |

## .the resolution

`genIntrospectionMiddleware.getJsonSchemaFromZod.integration.test.ts` now states the invariant as
a run. five rows, and **both defect arms are proven red**:

| probe | the row that went red | what it proved |
|---|---|---|
| a second prod call site (`src/probeSecondDoor.ts`, throwaway) | `[t1] exactly ONE prod call site remains` | the count fires, and **names the offender by path** |
| the door's own flag flipped to `{ io: 'output' }` | ``[t2] it passes `{ io: 'input' }` `` | the face is graded, not merely the count |

each probe was reverted and the suite returned green — **5 passed** (`rule.require.clamp-edge-cases`,
which asks that a clamp be seen to fail before it is trusted).

⇒ and the clamp carries its own **positive control** (`[t0]`, two rows): it asserts the walk reaches
a real corpus **and** fires on more than one file before the prod filter. so the filtered count is a
result rather than a broken-walk artifact
(`rule.require.positive-control-before-absence-claims`).

## ⚠️ .the deferral's decisive premise was FALSE, and that is the find

row 3 of the fork table read:

> *"a test that greps `src` — **no precedent** — the repo's only tests that touch the filesystem
> read generated output in a temp dir"*

**a filesystem read has a declared genre in this repo: `.integration.test.ts`**
(`rule.forbid.unit.remote-boundaries` names it outright — *"if it touches the outside world, it's
not a unit test"*, and `src/` already carries 9 such files). so the precedent was there the whole
time, one rule away, and i graded the rework **dirty** on a premise i never checked.

⇒ **the tell, on the record for the next traveler: a `dirty` grade sourced to *"no precedent"* is a
claim about the repo, and a claim about the repo owes a read of the repo** — never a recollection
of it (`rule.require.trust-but-verify`, applied to my own estimate).

## .the fork, as it stood — kept, because it is the record of the wrong call

| option | the case for it | the case against |
|---|---|---|
| **verify, and defer the guard** (taken, then overturned) | the bullet is a state claim, and the state holds | a second door reopens the defect, and one of its two arms is silent |
| a lint rule that allowlists the one file | states the invariant where a contributor meets it — at the keystroke | a lint-config change re-grades 178 files and can surface unrelated violations |
| **a test that reads `src`** (✅ landed) | cheapest to write | ~~no precedent~~ — **false**; the genre is declared |
| hide `z` behind a module boundary | strongest | fights the fact that `z` is used legitimately for schema declaration everywhere |

## .three defects in my own clamp, each caught by a run

recorded because each is the shape a careless reviewer would have passed:

1. **the walk relativized at every recursion level**, so inner paths were re-relativized by the
   outer frame and no longer opened — `ENOENT` on a path that plainly exists. the repair pulls the
   relativize out of the recursion, to one call at the top
2. **`useThen`'s proxy re-reads a string subject as a char-indexed object**, so `toMatch` and
   `toContain` both broke on the door's text. a **promise awaited N times** runs its executor once
   and hands back the real value — the identical repair `[case14]` of the peer spec landed for an
   error subject, so this is the second instance of one class

⇒ and a third, subtler: the first draft asserted `not.toContain("io: 'output'")` on the door's
text. that row went red **because the door's own doc names the discarded face at length, on
purpose** — so the assertion graded the documentation rather than the code. it is now a **count of
call sites**, which is the property a per-schema branch would actually change.

## .the verdict, once ruled

**self-ruled, on a measurement rather than a preference.** the deferral asked for a wisher call on
*"whether a lint-config change is in bound"* — that question is **moot**, since the instrument that
landed touches no config at all.

## .see also

- `.dream/v2026_09_18.fix.the-one-door-to-tojsonschema-has-no-clamp.md` — the dream this closes;
  its two arms and three rungs stand as the analysis, and rung 3 is the one that landed
- `review/self/for.5.3.verification._.r1.has-behavior-coverage.md` — the review that caught it
- `rule.require.clamp-edge-cases` — the mandate that a clamp be seen to fail
- `rule.forbid.unit.remote-boundaries` — the precedent the deferral said was absent
