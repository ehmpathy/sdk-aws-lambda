# seed: a variant holds the family name, so its peer cannot be qualified

**status:** OPEN, UNFIXED, and **out of the bound** of `v2026_08_03.feat-apigateway-wire-response`.
this file records it; it does not fix it.

**fulcrum:** F27 — settled by the wisher as *"qualify the variant with its family — ⚠️ out of
this wish's bound, enbriefed only"* (`1.vision.yield.md`).

**rule it breaks:** `rule.forbid.unqualified-variant-exports` — a rule **authored from this very
stone**, which is why it now fires on the code that produced it.

---

## the defect

`src/index.ts` exports two variants of one family, and neither export names the family:

```ts
// src/index.ts:46  — a variant, exported BARE, verbless, prefixed by a preposition
export { forApiGateway } from '.../genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';

// src/index.ts:62  — a variant, exported under the FAMILY's name
export { genLambdaEndpoint } from '.../genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
```

row 2 is the expensive one, and it **caused** row 1. once the ask-endpoint variant took
`genLambdaEndpoint`, no name was left for the family, so its peer had to arrive bare.

three extant rules already forbid the shape:

| rule | how it breaks |
|---|---|
| `rule.require.treestruct` | `for*` is a preposition, never a verb; `[verb][...noun]` is not satisfied |
| `rule.require.sync-filename-opname` | file `genLambdaEndpoint.forAskEndpoint.ts` → export `genLambdaEndpoint`; the variant part is dropped |
| `rule.forbid.unqualified-variant-exports` | a variant under its family's name makes every peer unnameable |

## the remedy

one object export, which is the single shape `rule.forbid.barrel-exports` sanctions:

```ts
// genLambdaEndpoint/index.ts
export const genLambdaEndpoint = { forApiGateway, forAskEndpoint };
```

each variant keeps its own file, its own internal name, and its own tests. only the **public
surface** composes. a caller then writes `genLambdaEndpoint.forApiGateway({ … })`, and autocomplete
on `genLambdaEndpoint` shows the full set.

## why it is out of bound here

**both cited lines predate this branch.** measured:

```
$ git show origin/main:src/index.ts
  45: export { forApiGateway }     from '.../genLambdaEndpoint.forApiGateway/…';
  56: export { genLambdaEndpoint } from '.../genLambdaEndpoint.forAskEndpoint/…';

$ git diff origin/main -- src/index.ts
  both lines appear as UNCHANGED CONTEXT — neither is a `+` line
```

so this branch neither introduced the shape nor touched it. to fix it here would:

1. **break a public surface this wish did not add.** every consumer's
   `genLambdaEndpoint(...)` call site becomes `genLambdaEndpoint.forAskEndpoint(...)` — a
   second, unrelated break piled onto a release that already carries one.
2. **widen the bound past the wish's `.acceptance`,** no line of which mentions export names.
3. **blur the revert boundary.** the wire-response work and an export rename could no longer be
   reverted apart.

## when to do it

alongside the next `genLambdaEndpoint` break, or as its own major bump. the library has no
installed base, so the edit is cheap — the expense is to pile it onto an unrelated release, never
the change itself.
