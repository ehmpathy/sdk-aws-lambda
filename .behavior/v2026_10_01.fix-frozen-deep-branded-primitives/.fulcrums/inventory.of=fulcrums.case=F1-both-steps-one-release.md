# F1 — both steps ship on one branch, as ONE commit, in one 0.7.1 release

## verdict — ruled by the wisher, 2026-10-02

**both steps ship together, as a patch, in one commit** (option C below).
verbatim: *"both should ship together"* · *"all ships as a patch"* · *"and its all one commit dude"*.

## the fork

- **A** — step 1 alone ships as 0.7.1; step 2 follows as its own PR and 0.7.2
- **B** — both steps on this branch, as two commits; the release that cuts is 0.7.1 and holds both
- **C** — both steps on this branch, as one commit; the release that cuts is 0.7.1 ← **ruled**

## the best guess before the verdict: B — superseded

recorded as it stood, so a reader can see what the wisher overruled:

- the wish says step 2 "is unblocked from the start" — type-fns v1.21.5 is published (2026-10-01) and
  exports `FrozenDeep` with the primitive arm (`src/index.ts:19` at tag `v1.21.5`)
- the wish's "ships as 0.7.1" holds under B or C: the one release cut is 0.7.1, and it carries the fix
- B's case for two commits — step 1's bite proof runs while the arm is still local — is kept under C
  by a probe in the work tree: the clamp was measured red against the repo-owned 0.7.0 type before the
  swap, and is recorded in `[case8]`'s `.to check it bites`

## rework: clean

the commit could be split onto two branches; naught builds on the order.

## confidence: 100% after the verdict (85% before it)

the 85% came from the wish, which lists step 1 → 0.7.1 and step 2 as separate bullets and so may
have meant two releases. the verdict settled it.
