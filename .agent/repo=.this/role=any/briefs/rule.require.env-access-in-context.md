# rule.require.env-access-in-context

## .what

`env` is ambient context, never business input. every operation that addresses a
lambda endpoint MUST receive `env.access` via its `context` argument, and
`env.access` is a **hard requirement** — there is no default and no fallback.

```ts
// 👍 required shape
operation(
  { which: { service, function } },          // business input (no access)
  { env: { access: 'prep', region? }, ... }, // ambient context (access required)
);
```

## .why

### env is context, not input

the `(input, context)` contract splits two different kinds of knowledge:

- **input** = what the caller is asking about — the business identity of the
  endpoint: `{ service, function }`. this is the same no matter where the code runs.
- **context** = the ambient runtime the caller is operating in — `env.access`
  (`test` | `prep` | `prod`), `env.region`, `log`, injected sdk clients. this
  changes with deployment, not with the request.

`access` describes *where the caller is running*, not *what it wants*. a caller in
prep asking for `getUser` and a caller in prod asking for `getUser` send the
identical input; only their ambient env differs. so `access` belongs in `context`,
exactly like `log` and `region` — putting it in `input.which` would conflate the
request with the runtime and force every call site to restate its own environment.

the endpoint slug `{service}-{access}-{function}` is then assembled inside the
operation from `input.which` + `context.env.access` via `asLambdaEndpoint`.

### access is required — no silent default

`env.access` MUST be provided. it is never defaulted (e.g. to `prod` or `prep`)
because the wrong default is dangerous:

- **wrong target**: access selects which deployed lambda you actually invoke
  (`svc-user-prep-getUser` vs `svc-user-prod-getUser`). a silent default could
  route a prod caller to a prep function, or leak a prep call into prod.
- **security gate**: introspection is only exposed when `access === 'prep'`. a
  defaulted access could expose schemas where they must not be, or block them
  where they must be.
- **fail loud over guess**: an absent `env.access` is a misconfiguration. surface
  it as a `ConstraintError` (caller must fix) rather than guess and mis-route.

this is the same principle as `feedback: prefer strict all-or-none over
partial/null states` — no silent fallbacks; fail loud at the source.

## .scope

operations that address a `LambdaEndpoint`:

- `askLambdaEndpoint`
- `getOneLambdaContract`
- `getAllLambdaContracts`

their `context.env.access` is a required (non-optional) field; `input.which`
carries only `{ service, function }` (or `{ service }` for getAll).

## .examples

### 👍 good

```ts
await askLambdaEndpoint(
  { which: { service: 'svc-user', function: 'getUser' }, event: { userId } },
  { ...log, env: { access: 'prep', region: 'us-east-1' } },
);
```

### 👎 bad — access in input

```ts
await askLambdaEndpoint(
  { which: { service: 'svc-user', access: 'prep', function: 'getUser' }, event },
  { ...log },
);
```

### 👎 bad — access defaulted / absent

```ts
// env.access absent → must throw ConstraintError, not assume an env
await askLambdaEndpoint({ which: { service, function }, event }, { ...log });
```

## .enforcement

- `access` in `input.which` (instead of `context.env`) = blocker
- `env.access` optional or defaulted on an endpoint-addressing operation = blocker
- absent `env.access` handled by a silent fallback instead of a thrown
  `ConstraintError` = blocker

## .see also

- define.lambda-endpoint-ubiqlang — the LambdaEndpoint entity + slug
- ehmpathy/mechanic: rule.require.input-context-pattern, rule.require.dependency-injection
- ehmpathy/architect: prefer.env_access.prep_over_dev
