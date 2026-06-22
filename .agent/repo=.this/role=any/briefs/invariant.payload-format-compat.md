# invariant.payload-format-compat

## .what

genLambdaEndpoint handlers must accept all payload formats gracefully. trail is optional in the raw event; handlers always receive a normalized context with trail.

## .why

### incremental upgrade support

services upgrade at different times. a new handler may receive calls from:
- **upgraded clients** — send `{ ...event, trail: { exid } }`
- **legacy clients** — send raw `event` (no trail wrapper)

if handlers reject legacy payloads, upgrades become all-or-none.

### external trigger support

not all event sources are under our control:

| trigger | payload control | trail? |
|---------|-----------------|--------|
| askLambdaEndpoint | full control | yes, injected |
| simple-lambda-client (legacy) | full control | no |
| SQS | aws-defined | no |
| SNS | aws-defined | no |
| EventBridge | aws-defined | no |
| API Gateway | partial (body) | only if client sends |
| aws console / cli | user-defined | no |

handlers must work with all sources.

### manual invocation support

developers test via aws console, cli, or direct sdk calls. these rarely include trail context. handlers should still work.

## .the invariant

```
middleware MUST:
  1. accept event with trail:    { ...event, trail: { exid } }
  2. accept event without trail: { ...event } (no trail property)
  3. generate fresh exid when trail is absent
  4. inject normalized context.log with trail into handler

handler ALWAYS RECEIVES:
  - context.log with trail.exid (extracted or generated)
  - handler never sees raw payload format differences
```

the handler is isolated from payload format variations. middleware normalizes.

## .implementation

createTrailMiddleware handles this:

```ts
// extract exid from event if present
const exidFromEvent = request.event?.trail?.exid ?? null;

// generate exid if not provided
const exid = exidFromEvent ?? `exid:${randomUUID()}`;

// inject normalized log into context
request.context.log = genContextLogTrail({ trail: { exid, stack: [] } }).log;
```

key: `?.trail?.exid` — safe navigation when trail is absent.

## .handler perspective

the handler always sees the same interface:

```ts
invoke: async ({ event }, { log }) => {
  // log.trail.exid is ALWAYS present
  // handler doesn't know if caller sent trail or not
  log.debug('process', { exid: log.trail.exid });
}
```

## .test coverage

integration tests must cover:

| case | payload | expected |
|------|---------|----------|
| new client | `{ message: 'hello', trail: { exid: 'exid:abc' } }` | exid = 'exid:abc' |
| legacy client | `{ message: 'hello' }` | exid = generated |
| SQS event | `{ Records: [...] }` | exid = generated |
| null trail | `{ message: 'hello', trail: null }` | exid = generated |

## .enforcement

- middleware that assumes trail exists = blocker
- handler that accesses raw event.trail directly = nitpick (should use context.log.trail)

