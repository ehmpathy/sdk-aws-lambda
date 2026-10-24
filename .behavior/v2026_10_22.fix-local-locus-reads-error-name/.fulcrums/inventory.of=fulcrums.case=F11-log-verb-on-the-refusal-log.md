# F11 — the shared refusal log is named `logSqsRecordRefused`

## the fork

two sqs variants emit one `sqs.record.refused` warn with one shape. the leaf that holds it needs a name.

| option | for | against |
|---|---|---|
| **`logSqsRecordRefused`** (taken) | says what it does. `rule.require.get-set-gen-verbs` exempts imperative commands (`dispatchTask`, `enqueueTask`), and a log emit is that class: a fire-and-forget effect, no state read or written | the only `log*` operation in `src` (`grepsafe 'export const (log\|emit\|warn\|report)[A-Z]' --path src` → 1 hit, this file), so it starts a convention |
| `setSqsRecordRefusal` | a sanctioned verb | `set` promises an idempotent upsert of state; a log line is neither state nor idempotent. the name would lie |
| inline `log.warn` at both sites, as `sqs.record.invalid` is | no new name at all | two copies of a four-field shape drift; the one durable trace of a deleted message (F9) is the field set an operator queries on |

## taken, and why at the time

`logSqsRecordRefused`. the exemption covers it in kind, and the two rejected names either lie or duplicate.

## rework

clean — a rename across three files (the leaf and its two callers), no public export.

## confidence — 85%, and why it is low

the exemption's examples are queue commands, not logs. a reviewer may read `log` as an unsanctioned verb, and this repo has no prior `log*` operation to point to.

## where

`src/domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/logSqsRecordRefused.ts`

## verdict

open.
