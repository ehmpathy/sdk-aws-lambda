# rule.require.contemp-contracts-default

## .what

always use contemp contracts by default. backwards compat only when caller is explicitly identified as ancient.

## .why

### contemp is the standard

contemp callers send `{ event, trail }` wrapper and expect modern semantics:
- `ConstraintError` for caller faults
- `MalfunctionError` for server faults

ancient callers send flat payload and expect legacy semantics:
- `BadRequestError` for caller faults

### explicit detection required

contemp is opt-in, per transport; ancient is what an absent opt-in means:
- opt-in present (the wrapper for direct invoke, our header for an aws-delivered event) = contemp caller = modern semantics
- opt-in absent = ancient caller = legacy semantics
- see `invariant.ancient-vs-contemp-callers.md` for the carrier per transport

### no speculative compat

never add backwards compat "just in case". compat is owed to a caller with no opt-in — never to an opted-in caller, and never by a guess at what an opted-in caller "really" wants.

## .examples

### good — explicit ancient detection

```ts
const isContempCaller = getIsWrappedPayload({ payload });

const body = isContempCaller
  ? getErrorResponseBodyContemp({ error, errorClass: 'ConstraintError' })
  : getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });
```

### bad — ancient by default

```ts
// 👎 assumes ancient by default
const body = getErrorResponseBodyAncient({ error, errorType: 'BadRequestError' });
```

### bad — speculative compat

```ts
// 👎 compat "just in case" without detection
const body = {
  errorType: 'BadRequestError',  // ancient compat
  errorClass: 'ConstraintError', // contemp semantics
  // now callers don't know which to use
};
```

## .scope

- error serialization in middleware
- response format in handlers
- any contract boundary between caller and server

## .enforcement

backwards compat without explicit ancient detection = blocker

