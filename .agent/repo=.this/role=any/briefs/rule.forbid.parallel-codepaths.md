# rule.forbid.parallel-codepaths

## .what

no two code paths may carry the **same guarantee**. one guarantee, one path.

this is the contract-grain, blocker-severity root of the family. the statement-grain twin is
`rule.avoid.unnecessary-ifs` (mechanic, nitpick) — that one guards narrative readability inside
a procedure; this one guards a guarantee across a surface.

## .why

a guarantee split across two paths is a guarantee that will be half-kept.

- **the next guarantee lands once.** add validation, a log, a redaction, a retry — and it goes
  into one path while the other quietly does without. the paths do not drift because someone was
  careless; they drift because the second path is invisible at the moment of the edit.
- **each path must be verified separately.** two paths means every invariant proven twice, so the
  coverage plan doubles and the second half is the half that rots.
- **the reader must hold both.** a reader who wants to know "does this endpoint validate?" now
  needs the config *and* the branch, not the signature.

measured on this stone: an optional `schema` field would have forked **validation and
introspection at once**, so one omitted field silently moved two guarantees. that is the shape of
the defect — a small syntactic option, a large semantic fork.

## .the line — observed data vs handed config

this rule cannot be "no forks", because a domain genuinely forks. the line:

| fork on... | verdict | why |
|---|---|---|
| **data you observe** — a payload shape, a caller kind, a state | ✅ legitimate | the domain has two cases; the code must too |
| **config you were handed** — a field's presence, a mode flag, an option | ⛔ collapse | you invented the second case, then charged every maintainer for it |

this repo mandates a fork of the first kind: `invariant.ancient-vs-contemp-callers` requires two
error-body shapes, chosen from the observed payload (`getIsWrappedPayload`). that is the domain's
own split, and this rule never touches it.

`if (config.schema)` is the second kind. it exists because a config field was optional, and it
vanishes the moment the field is required with an explicit opt-out value
(`rule.require.explicit-optout`).

## .the test — for the proposer

for each guarantee your design makes, ask: **"when i add the next guarantee here, how many places
must it land?"**

- **one** → good
- **two or more** → collapse the paths before you write either one

then check the source of each fork you kept, against the table above. a fork on observed data
stays. a fork on handed config gets one of these remedies:

| the fork | the collapse |
|---|---|
| a config field's absence | require the field, opt out by value (`rule.require.explicit-optout`) |
| a mode flag on one export | widen the type so the mode is data, not a flag (`rule.require.widen-before-parallel`) |
| a branch on presence of a body / a key | make the shape total, so the branch has no case to serve |
| a guard for a cardinality | hold it in the type (`rule.require.illegal-states-unrepresentable`) |

## .the test — for the reviewer

pick a guarantee, then **count its registrations**. validation, logs, redaction, error conversion,
introspection — each should appear exactly once. two appearances of the same guarantee is the
defect, whatever the syntax that produced them.

concrete grep targets:

- `if (config.` / `if (options.` / `if (opts.` — a branch on handed config
- `?.` or `??` where the absent arm skips a guarantee rather than supplies a value
- two `.use(` / `.register(` calls for one concern
- two functions whose bodies differ only in one boolean

and one structural tell: **a helper extracted purely to keep two paths level.** the helper proves
the author saw the duplication and chose to manage it instead of delete it. it satisfies *this*
rule while it hides the contract defect underneath — which is why `widen-before-parallel` is a
separate rule and not a rename of this one.

## .the caveat

- **an early return is not a parallel path.** it shortens one path
  (`rule.avoid.unnecessary-ifs` names this exception explicitly).
- **a fork on observed data is not a parallel path.** ancient vs contemp, a queue record vs an
  http event, a draft vs a final invoice — the domain has two cases.
- **two paths with genuinely different guarantees are not parallel.** parallel means *same
  guarantee, twice*. a fast path and a durable path make different promises, and each is one path
  for its own promise.

## .examples

### 👎 bad — one option, two guarantees forked

```ts
if (config.schema) chain.use(genValidationMiddleware(config.schema));
if (config.schema) chain.use(genIntrospectionMiddleware(config.schema));
// the next guarantee lands in one of these arms and not the other
```

### 👍 good — the field is required, so there is one path

```ts
chain.use(genValidationMiddleware(config.schema));     // always
chain.use(genIntrospectionMiddleware(config.schema));  // always
// z.any() is how a caller opts out, on the page, at the call site
```

### 👍 good — a fork the domain requires, kept

```ts
// two error shapes, chosen from OBSERVED payload — not from config
const body = isContempCaller
  ? getErrorResponseBodyContemp({ error, errorClass: 'ConstraintError' })
  : getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });
```

## .enforcement

- two code paths that carry the same guarantee = **blocker**
- a branch on handed config (a field's presence, a mode flag) where a total shape would serve = **blocker**
- a helper extracted only to keep two paths level = **blocker** (delete a path, not the duplication)
- a fork on observed data, or an early return = false positive

## .see also

- `rule.avoid.unnecessary-ifs` (mechanic) — the statement-grain, nitpick twin
- `rule.require.explicit-optout` — the most common source of a config fork, and its collapse
- `rule.require.widen-before-parallel` — the contract-surface axis; a shared builder satisfies THIS rule and still fails that one
- `rule.require.illegal-states-unrepresentable` — hold cardinality in the type so no guard forks
- `rule.require.fewer-paths-via-idempotency` (architect) — the same pressure, applied to mutations
- `invariant.ancient-vs-contemp-callers` — the fork this repo requires, which this rule protects
