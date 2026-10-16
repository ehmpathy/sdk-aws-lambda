# F3 — sqs/sns/cloudfront lifts recorded as next, not built

## .the fork

the foreman's design: build `forSqs.*` now *if the read is one codepath with api gateway; else
record as next*.

## .taken = record as next, and why at the time

- not one codepath. api gateway has one headers bag per invoke; sqs has one `messageAttributes` bag
  per **record**, and a batch may carry ten records with ten exids
- `trail.md`: one invoke, one trail — a per-record trail has no slot to live in. which exid wins for
  a batch is a new decision, not a reuse of this one
- #51 is an api gateway defect; the sqs lift is not needed to close it
- sns, cloudfront: the foreman already scoped them as next. kinesis has no bag

## .rework = clean

additive. no consumer or later stone hardens against the absence of an sqs lift.

## .confidence = 80%, low because

- a `perBatch` variant has one invoke grain and could reuse the read, if "first record's exid" were
  acceptable — a call no one has made

## .where

`invariant.ancient-vs-contemp-callers.md` detection table; `trail.md` built/unbuilt list.

## .verdict

**ruled: defer** — the wisher, 2026-10-15, verbatim:

> lets defer. we should first decide how we would even slap trail exids onto those messages to begin with

so the receive side waits on the send side: how a producer attaches the exid to a message comes
first, the batch-grain read second. the dream records both, in that order.
