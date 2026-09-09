# rule.forbid.unqualified-variant-exports

## .what

when an operation has variants, the public export must name the **family and the variant**, never
the variant alone. and the family name must belong to the family — never to one of its variants.

```ts
// 👎 the variant is exported bare; the family name is taken by a peer variant
export const handler = forApiGateway({ ... });     // family absent from the name
export const handler = genLambdaEndpoint({ ... }); // this is the ASK variant, not the family

// 👍 the family names itself, each variant qualifies it
export const handler = genLambdaEndpoint.forApiGateway({ ... });
export const handler = genLambdaEndpoint.forAskEndpoint({ ... });
```

## .why

`src/index.ts` shows both halves of the defect at once:

| line | export | defect |
|---|---|---|
| 45 | `forApiGateway` | no verb, no family — `for` is a preposition, so the name breaks `rule.require.treestruct`'s `[verb][...noun]` outright |
| 56 | `genLambdaEndpoint`, **from `genLambdaEndpoint.forAskEndpoint.ts`** | a variant exported under the family's name |

that second row is the expensive one. once a variant holds the family name:

- **the family becomes unnameable.** `genLambdaEndpoint.forApiGateway` cannot be added without a
  break, because `genLambdaEndpoint` already denotes one variant. the peer that arrived second is
  forced into a bare name, which is exactly how row 45 happened — **row 56 caused row 45.**
- **one variant reads as the default and the rest as exceptions**, though the code makes no such
  claim. a caller who reaches for `genLambdaEndpoint` gets the ask-endpoint variant by accident of
  export order, never by a decision anyone recorded.
- **the file name and the export disagree.** the file is `genLambdaEndpoint.forAskEndpoint.ts` and
  the export is `genLambdaEndpoint` — a direct break of `rule.require.sync-filename-opname`, which
  exists so a reader can infer one from the other.
- **autocomplete stops paying out.** type `genLambdaEndpoint` and a reader should see every variant.
  bare peers scatter across the alphabet, which is the same loss `rule.require.order.noun_adj`
  guards against at the term grain.

so three extant rules already forbid this shape. what this rule adds is the **cause**: the defect
enters when a variant is exported before the family is, and it is cheapest to refuse at that moment.

## .the test — for the proposer

before you export an operation, ask: **"will this ever have a peer?"**

| answer | the export |
|---|---|
| no peer is conceivable | a plain `[verb][...noun]` export |
| a peer exists, or is likely | a **namespace object** whose keys are the variants |

then check the harder half: **does the family name denote the family, or one variant?** if a caller
can write the family name and receive a specific variant, the family has no name at all.

the remedy is the one shape `rule.forbid.barrel-exports` sanctions — a single object export:

```ts
// genLambdaEndpoint/index.ts  — the one allowed object export
export const genLambdaEndpoint = {
  forApiGateway,
  forAskEndpoint,
};
```

each variant keeps its own file, its own name inside that file, and its own tests. only the
**public surface** composes. note this is not a barrel: a barrel re-exports symbols one by one,
which multiplies import paths; this exports one value whose keys are the variants.

## .the test — for the reviewer

read `index.ts` and, for each export, ask two questions:

1. **is there a peer of this in the tree?** grep the directory for files that share its prefix. two
   files named `X.forA.ts` and `X.forB.ts` with two bare exports is the defect.
2. **does any export name a family that a directory also names?** if `X` is both a directory of
   variants and an exported value, one variant has taken the family's name.

the tells:

- an export whose **file name is longer than the export name**, where the extra part names a variant
  (`genLambdaEndpoint.forAskEndpoint.ts` → `genLambdaEndpoint`)
- an export that begins with a **preposition** — `for*`, `by*`. a preposition qualifies a noun it
  does not carry, so the noun was left behind
- two exports that a caller must choose between, with no common prefix to discover them by
- a directory whose name equals an exported symbol, but whose children are the real operations

## .the caveat

- **`with*` higher-order wrappers are exempt** — `withLogTrail`, `withRetry` are the extant sanctioned
  prefix for a decorator (`rule.require.get-set-gen-verbs` names them), and a decorator is a variant
  of no family.
- **a true peer needs no namespace.** two operations that share a prefix by coincidence rather than
  by family — `getOneUser` and `getOneUserSession` — are separate operations, not variants. the test
  is whether a caller **chooses between them for one job**.
- **middleware and types stay flat.** the namespace is for the operations a caller invokes; a
  `genTrailMiddleware` or a `UnifiedApiGatewayEvent` has no variant to qualify.
- **this is a break to fix**, so it earns a version bump. on a library with no installed base that
  costs zero (`rule.require.widen-before-parallel`'s third test).

## .examples

### 👎 bad — the variant takes the family name, so its peer cannot have one

```ts
// genLambdaEndpoint.forAskEndpoint.ts
export const genLambdaEndpoint = ...;   // a VARIANT, named as the family

// index.ts
export { genLambdaEndpoint } from '.../genLambdaEndpoint.forAskEndpoint';
export { forApiGateway } from '.../genLambdaEndpoint.forApiGateway';
//       ^ forced into a bare, verbless name because the family name was taken
```

### 👍 good — the family names itself, the variants qualify it

```ts
// genLambdaEndpoint.forAskEndpoint.ts
export const forAskEndpoint = ...;

// genLambdaEndpoint.forApiGateway.ts
export const forApiGateway = ...;

// genLambdaEndpoint/index.ts
export const genLambdaEndpoint = { forApiGateway, forAskEndpoint };

// a caller, at the call site
export const handler = genLambdaEndpoint.forApiGateway({ ... });
```

## .enforcement

- a variant exported under its family's name = **blocker** (it makes every peer unnameable)
- a variant exported bare, where a peer exists in the tree = **blocker**
- an export that begins with a preposition (`for*`, `by*`) = **blocker** (`rule.require.treestruct`)
- an export name that drops a variant part its file name carries = **blocker**
  (`rule.require.sync-filename-opname`)
- a `with*` decorator, or an operation with no peer = false positive

## .see also

- `rule.require.treestruct` (mechanic) — `[verb][...noun]`; a preposition is not a verb
- `rule.require.sync-filename-opname` (mechanic) — the file name and the export must agree
- `rule.forbid.barrel-exports` (mechanic) — the single object export this rule relies on, and why
  it is not a barrel
- `rule.require.order.noun_adj` (mechanic) — the same autocomplete payoff, at the term grain
- `rule.require.widen-before-parallel` — read first: a variant may not be needed at all
- `rule.require.ubiqlang` (mechanic) — one canonical name per concept, and a family is a concept
