# F4 — step 2's stricter `Map` / `Set` type ships in a patch

## the fork

- **A** — ship it in 0.7.1 as-is
- **B** — wrap type-fns' type to keep the local `Map` / `Set` shape, so step 2 is a pure no-op
- **C** — ship step 2 as a minor

## taken: A, and why

- the delta is reachable only when a consumer's `.transform()` returns a `Map` / `Set` **and** the
  handler then calls `.set` / `.add` on it, or hands it to a `Map` / `Set`-typed sink (`case=_`
  row 3, `case=6`). the route out is one line — copy it (`new Set(payload.seen)`)
- that call mutates a value the sdk hands over frozen — `rule.require.frozen-invoke-inputs` already
  forbids it. type-fns refuses at compile time what the sdk's contract already denies
- B re-declares a local `FrozenDeep` variant — the very copy the wish deletes
- C signals a feature where none is added

## rework: clean

a minor bump is a commit-type edit before merge.

## confidence: 80%, and why it is low

no consumer was surveyed for a `Map` / `Set` transform; "rare" is a guess.

## verdict

**ruled 2026-10-02 by the wisher: A, a patch.** verbatim: *"this is fine for a patch"*.