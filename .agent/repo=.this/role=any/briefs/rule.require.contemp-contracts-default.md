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

backwards compat is not opt-in, it's detected:
- `getIsWrappedPayload` checks for `{ event, trail }` structure
- no wrapper = ancient caller = legacy semantics
- wrapper present = contemp caller = modern semantics

### no speculative compat

never add backwards compat "just in case". if caller type is unknown, assume contemp.

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

