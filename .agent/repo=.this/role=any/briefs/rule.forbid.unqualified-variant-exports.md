# rule.forbid.unqualified-variant-exports

## .what

when an operation has variants, **every variant rides on the family object, and no variant is
exported beside it.** the family name belongs to the family, never to one variant.

```ts
// 👎 a variant bare; another variant under the family's name
export const handler = forApiGateway({ ... });
export const handler = genLambdaEndpoint({ ... });   // the family name, bound to one variant

// 👍 the family names itself; each variant qualifies it
export const handler = genLambdaEndpoint.forApiGateway({ ... });
export const handler = genLambdaEndpoint.forAsk({ ... });
```

## .the ruled shape — a family object, every variant a leaf

```ts
// a NEW family — a plain object
export const genWidget = { forA, forB };

// an EXTANT family whose bare name already shipped — callable, and the default is still a leaf
export const genGadget = Object.assign(forA, { forA, forB });
```

this repo's `genLambdaEndpoint` is the first form: a plain object, since it has no installed base.

| demand | why |
|---|---|
| every variant is a key, the default included | otherwise autocomplete lists a subset and the default reads as a different kind |
| no variant exported beside the object | the bare peer is the defect's cause |
| the default is ruled in a doc-comment | a caller of the bare name gets a specific variant by decision, not by export order |

each variant keeps its own file, name, and tests; only the public surface composes. this is one
object export, not a barrel (`rule.forbid.barrel-exports`).

## .the callable default costs a second call form — name the axis

`genGadget(…)` and `genGadget.forA(…)` are two call forms for one variant.
the axis is **backward compatibility**: has this family already shipped a bare name?

| family | shape |
|---|---|
| new | a plain object; ⛔ no callable default |
| extant, bare name shipped | a callable default, so extant callers pay zero |

no edit removes that property, so the two cases are two cases, not a rule with an excuse
(`rule.forbid.defended-exceptions`). record the trade at the declaration.

## .why

when a variant takes the family's name, the family becomes unnameable: the next peer cannot be
`genLambdaEndpoint.forApiGateway` without a break, so it ships bare and preposition-led. that is how
this repo got `forApiGateway` beside a `genLambdaEndpoint` that was really `forAskEndpoint` —
one slip caused the other. it also breaks `rule.require.sync-filename-opname` (file
`genLambdaEndpoint.forAskEndpoint.ts`, export `genLambdaEndpoint`) and `rule.require.treestruct`
(`for` is a preposition, not a verb).

## .the test — for the proposer

**"will this ever have a peer?"** no → a plain `[verb][...noun]` export. yes → a family object.
then: **does the family name denote the family, or one variant?** if a caller can write the family
name and receive a variant that is not also a key on it, the family has no name.

## .the test — for the reviewer

in `index.ts`, for each export:

1. is there a peer in the tree? two files `X.forA.ts`, `X.forB.ts` with two bare exports is the defect
2. does a directory share the export's name? then the export must be an object whose keys are every
   variant

the tells: a file name longer than its export name by a variant part · an export that begins with a
preposition (`for*`, `by*`) · a callable family whose default is absent from its own keys · two
exports a caller must choose between with no common prefix.

## .clamp the module's key set, not the call sites

```ts
// 👎 all green with a bare `forApiGateway` re-added
expect(typeof genLambdaEndpoint.forAsk).toBe('function');
expect(typeof genLambdaEndpoint.forApiGateway).toBe('function');

// 👍 refuses the bare peer
import * as sdk from '../src/index';
expect(Object.keys(sdk).filter((key) => key.startsWith('for'))).toEqual([]);
```

## .the caveat

- `with*` decorators are exempt — they are variants of no family
- two operations that share a prefix by coincidence (`getOneUser`, `getOneUserSession`) are not peers;
  peers are ones a caller chooses between for one job
- middleware and types stay flat
- the repair is a break, so it earns a version bump. measure the installed base first — the **pin**,
  not the import graph, decides it (`rule.require.pinned-versions`)

## .enforcement

- a variant exported under its family's name = **blocker**
- a variant exported beside the family object = **blocker**
- a callable family whose default is absent from its keys = **blocker**
- a callable default on a new family = **blocker**
- a callable default with no recorded axis = **blocker**
- an export that begins with a preposition = **blocker**
- an export name that drops a variant part its file name carries = **blocker**
- a clamp that reads only call sites, not the key set = **nitpick**
- a `with*` decorator, or an operation with no peer = false positive

## .see also

- `domain.terms/genLambdaEndpoint.md` — this rule's instance
- `rule.require.consistent-variant-contracts` — one vocabulary across the leaves
- `rule.require.widen-before-parallel` — read first: a variant may not be needed at all
