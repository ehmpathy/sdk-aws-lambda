# F10 — `asHeadersRecord` fills a record by an annotated `forEach` mutation

## .the fork

the response's `Headers` must become a plain record. two ways:

- A. `Object.fromEntries(headers.entries())` — immutable, one expression
- B. a local record filled by `headers.forEach(...)` — a mutation, annotated

## .taken = B, and why at the time

A does not compile. `tsc` answers `TS2339: Property 'entries' does not exist on type 'Headers'`
(measured, `git.repo.test --what types`, the first cut of `asHeadersRecord`). the declared `Headers`
under this tsconfig's lib is not iterable and has no `entries()`, so `forEach` is its one reader.

the mutation is local: the record is made in the function, filled, and returned whole, so no reader
sees it part-filled. `rule.require.immutable-vars` sanctions exactly this — an unavoidable mutation,
isolated and annotated — and the extant `src/__test_assets__/getOneHttpResponse.ts` does the same for
the same type, with the same annotation.

## .rework = clean

A becomes possible if the tsconfig adds `dom.iterable` to its `lib`, which is a change to every file's
types and is not made here. one function changes if it is.

## .confidence = 85%, low because

- a peer lane graded it a blocker on the rule's text, and proposed `Array.from(headers.entries())`,
  which has the same compile fault

## .where

`src/domain.operations/askLambdaEndpoint/serde/asHeadersRecord.ts`

## .verdict

open — for the fulcrum council.
