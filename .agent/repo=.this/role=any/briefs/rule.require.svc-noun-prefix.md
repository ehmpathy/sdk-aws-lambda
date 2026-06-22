# rule.require.svc-noun-prefix

## .what

service names must use `svc-$noun` prefix, not `$noun-service` suffix.

## .why

prefix pattern enables collocated groups:
- `svc-*` — services
- `app-*` — applications
- `lib-*` — libraries
- `sdk-*` — sdks

suffixes scatter related resources across alphabetical lists.

## .examples

### good

```
svc-jobs
svc-invoice
svc-customer
svc-seaturtle
```

### bad

```
job-service
invoice-service
customer-service
seaturtle-service
```

## .applies to

- lambda function names: `svc-jobs-prod-getJob`
- service identifiers in code
- repo names where applicable
- infrastructure resource names

## .enforcement

`$noun-service` pattern = blocker

