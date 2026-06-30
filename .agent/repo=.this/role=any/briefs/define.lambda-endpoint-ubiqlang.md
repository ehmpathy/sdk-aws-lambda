# define.lambda-endpoint-ubiqlang

## .what

the ubiquitous language to address a lambda endpoint in this codebase.

a **LambdaEndpoint** is the domain entity for a callable lambda function. it
carries its natural-key parts plus its serialized **slug**:

```ts
interface LambdaEndpoint {
  service: string;   // svc-$noun, e.g. 'svc-invoice'
  access: string;    // env access level, e.g. 'prep'
  function: string;  // the function (the "bare" name), e.g. 'getInvoice'
  slug: string;      // serialized key = aws function name
}

class LambdaEndpoint extends DomainEntity<LambdaEndpoint> implements LambdaEndpoint {
  public static primary = ['slug'] as const;
  public static unique = ['service', 'access', 'function'] as const;
}
```

- **primary = ['slug']** — the artificial/serialized key. it is also the aws
  lambda function name, so it doubles as the wire identifier:
  `slug = '{service}-{access}-{function}'` e.g. `svc-invoice-prep-getInvoice`.
- **unique = ['service', 'access', 'function']** — the natural key. the slug is a
  deterministic serialization of these three parts.

## .why

we kept the flat `functionName: string` plus loose `service` / `function` fields
side by side, all over the codebase. that is a name smell:

- the string `'svc-invoice-prep-getInvoice'` hides its structure; every consumer
  re-parses it (slice, split, indexOf) to recover the parts.
- the parts (`service`, `access`, `function`) traveled as separate ad-hoc args,
  easy to mismatch or drop.
- `bareFunctionName` is a smell: "bare" describes what was stripped, not what the
  value *is*. it is simply `endpoint.function`.
- error metadata like `{ service, function, functionName }` is the same data said
  three ways. it is one value: the `endpoint`.

a single domain entity removes the ambiguity: speak in `LambdaEndpoint`, parse
once at the boundary, pass the structured value everywhere else.

## .vocabulary

| concept | definition | example |
|---------|------------|---------|
| LambdaEndpoint | the addressed lambda (entity) | `{ service, access, function, slug }` |
| endpoint.service | the owner service (svc-$noun) | `svc-invoice` |
| endpoint.access | the env access level | `prep` |
| endpoint.function | the function (the "bare" name) | `getInvoice` |
| endpoint.slug | serialized key = aws function name | `svc-invoice-prep-getInvoice` |

## .public selector

callers select an endpoint via `input.which` (business identity) plus the ambient
`context.env.access`:

```ts
input:   { which: { service: string; function: string } }
context: { env: { access: string; region? } }   // access required
```

note: `access` lives in `context.env`, NOT in `which` — it is the caller's ambient
runtime, not part of the request (see rule.require.env-access-in-context).
operations build the `LambdaEndpoint` from `input.which` + `context.env.access` via
`asLambdaEndpoint({ service, access, function })`.

## .names

| 👎 smell | 👍 ubiqlang |
|----------|-------------|
| `functionName: string` (as identity) | `endpoint` (or `endpoint.slug` for the string) |
| `bareFunctionName` | `endpoint.function` |
| `asBareFunctionName(...)` | `asLambdaEndpoint(...)` → entity with `.function` |
| `getLambdaFunctionName(...)` | `asLambdaEndpoint({ service, access, function }).slug` |
| `{ service, function, functionName }` | `{ endpoint }` |
| separate `service` + `function` args | one `endpoint` arg |

transformers (defer to get/set/gen + as* conventions):

- `asLambdaEndpoint({ service, access, function })` — build the entity, compute `slug`
- `asLambdaEndpoint({ slug })` — parse a slug string → full entity; strict: throws
  if the slug does not match the exact `{service}-{access}-{function}` shape (no
  partial match)

## .scope

- domain.objects: `LambdaEndpoint`
- domain.operations that address endpoints: getOneLambdaContract,
  getAllLambdaContracts, askLambdaEndpoint
- communicators: sdkLambdaInvoke, sdkLambdaGetAllFunctions
- error metadata: carry `endpoint`, not loose `service`/`function`/`functionName`

## .enforcement

- new code that passes a flat `functionName` string as identity = nitpick
- `bare*` names for an endpoint part = nitpick
- re-parse of the slug string outside the `asLambdaEndpoint` transformer = nitpick

## .see also

- rule.require.svc-noun-prefix — endpoint.service must be `svc-$noun`
- ehmpathy/architect: rule.require.ubiqlang, define.domain-operation-grains
- ehmpathy/mechanic: rule.require.domain-driven-design (DomainEntity, primary/unique)
