# rule.require.illegal-states-unrepresentable

## .what

express a shape's **cardinality** in the type, not in prose and not in a runtime guard. if a
value is meaningless, the compiler must reject it.

## .why

`{ status?: number; headers?: Record<string, string>; body?: TBody }` admits `{}`. an empty
response is meaningless — and left unchecked it reached middy's response-defaults step, which
applies `statusCode ??= 500`. the result is the worst class of defect: the wire says server
fault, the code says success, and no log fires. a **silent 500**.

three ways to close it, worst to best:

| rung | mechanism | catches it |
|---|---|---|
| prose | "callers must supply at least one field" | no one |
| runtime guard | throws at invocation | at run time, in prod, on a path a test may miss |
| **the type** | `PickAny<{ status, headers, body }>` | at compile time, always |

the third costs one import and closes the whole class. prefer it
(`rule.prefer.prevent-over-correct` — the top rung of that ladder is "make it impossible").

## .the test — for the proposer

for each all-optional object you declare, ask: **"is `{}` meaningless?"**

if it is, the type is wrong. reach for the cardinality type:

| the rule | the type |
|---|---|
| at least one key | `PickAny<T>` (type-fns) |
| exactly one key | `PickOne<T>` (type-fns) |
| a non-empty list | `[T, ...T[]]` |
| one of two shapes | a discriminated union |
| a value that must be validated | a branded type + `is$Noun.assure` (`rule.require.assure-via-type-checks`) |

## .the test — for the reviewer

find every object type whose keys are **all** optional. for each, write `{}` in your head and ask
what the code does with it. if the answer is a default that lies — a 500, a zero, an empty write,
a no-op that reads as success — the type must carry the cardinality.

a second tell: **the proposal states the constraint in prose.** prose about cardinality is a
confession that the type does not hold it. the same goes for a runtime guard whose only job is to
reject a shape a type could have refused.

## .the caveat

a bag that is genuinely optional in every part — a set of overrides, a patch, a log projection —
is legitimately all-optional, because `{}` denotes "no override", which is a real state. **the
test is what `{}` denotes, never the count of optional keys.**

and a type cannot hold every invariant. a range, a format, a cross-field rule belong to a
`is$Noun` check with `.assure` at the boundary. this rule asks only that you not leave to run
time what a type can refuse at compile time.

## .examples

### 👎 bad — prose plus a downstream default that lies

```ts
/**
 * .note = at least one of status, headers, or body must be supplied
 */
type ApiGatewayResponse<TBody> = {
  status?: number;
  headers?: Record<string, string>;
  body?: TBody;
};
// `return {}` compiles, ships, and emits a 500 the handler never chose
```

### 👍 good — the type refuses it

```ts
import type { PickAny } from 'type-fns';

type ApiGatewayResponse<TBody> = PickAny<{
  status: number;
  headers: Record<string, string>;
  body: TBody;
}>;
// `return {}` is a compile error; the note becomes unnecessary
```

## .enforcement

- an all-optional object type where `{}` is meaningless = **blocker**
- a runtime guard for a cardinality a type could hold = **nitpick**
- prose that states a cardinality the type does not hold = **blocker**
- an all-optional bag where `{}` denotes "no override" = false positive

## .see also

- ⚖️ **`rule.avoid.constraints-the-state-already-proves` — the COUNTERWEIGHT.** hold real
  cardinality in the type, **and no more**. applied alone, this rule produces a conditional type
  that proves a tautology; read the pair together
- `rule.prefer.prevent-over-correct` (ergonomist) — the ladder this sits at the top of
- `rule.require.shapefit` (mechanic) — types must fit; a mismatch is a defect
- `rule.require.assure-via-type-checks` (mechanic) — the runtime backstop for what a type cannot hold
- `rule.forbid.failhide` (mechanic) — a silent 500 is the failhide this prevents
- `rule.require.explicit-optout` — once a field is required, hold its shape here
