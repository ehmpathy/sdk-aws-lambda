# rule.require.snapshots-deny-volatile-not-allow-expected

## .what

a snapshot must **deny** the fields that churn and keep every other field. it must never **allow**
a curated list of the fields the author expected.

```ts
// 👎 an ALLOWLIST — it can only ever confirm what the author already thought of
expect({
  statusCode: result.statusCode,
  body: result.body,
}).toMatchSnapshot();

// 👍 a DENYLIST — it surfaces the field nobody thought to name
expect(asWireSnapshot({ wire })).toMatchSnapshot();
//     ^ drops `date` / `connection` / `keep-alive` / `transfer-encoding`, keeps ALL else
```

## .why

a snapshot exists to catch the change **nobody predicted**. that is its whole advantage over an
assertion: an assertion names a field, so it can only check that field, while a snapshot can hold
the entire value. an allowlist throws that advantage away and keeps only the cost — it is an
assertion with worse ergonomics and a file to maintain.

the failure is silent and total:

- **the unexpected field is exactly the defect.** a field the author did not name is a field the
  author did not consider, which is precisely where a defect hides.
- **it reads as thorough.** `toMatchSnapshot()` on a curated object looks like whole-value coverage
  in review. a reader cannot tell an allowlist from a denylist without a look inside the projection.
- **it never goes red for the right reason.** an allowlist snapshot goes red only when a field it
  already names changes — which an explicit assertion would have caught with a better message.

measured on the stone that produced this rule: **eleven** snapshots across one file each curated a
header allowlist (`{ statusCode, body }`, or two or three named headers). the sdk emitted
`Content-Type: application/json` on a body-less 204 and on a 308 redirect — a content-type that
contradicts the body, which is the exact byte pattern that raises twilio 11200, and the exact defect
the work existed to retire. all eleven were green. **seven review rounds passed over it.** one
denylist snapshot, added in the eighth, caught it on its first run.

## .the test — for the proposer

when you snapshot a value, ask: **"what in this value churns between runs?"**

| the field | verdict |
|---|---|
| a timestamp, a uuid, a port, a duration, a hostname, a stack trace | **deny it** — name it in the projection |
| a socket/transport detail the code under test never authored | **deny it** |
| every other field | **keep it, whether or not you expected it** |

then check the shape of what you wrote. if your projection is an object literal that **lists the keys
you want**, you built an allowlist — invert it into a filter over the keys you do not.

and one prompt that settles it: **"if the code started to emit a new field tomorrow, would this
snapshot show me?"** if no, it is an allowlist.

## .the test — for the reviewer

for each `toMatchSnapshot()`, read the expression inside it and ask: **"is this the whole value, or a
hand-picked subset?"**

the tells:

- an **object literal** built at the call site whose keys are copied out of the subject —
  `{ statusCode: result.statusCode, body: result.body }`. that is the allowlist, written inline.
- a projection whose name says which fields it keeps (`asStatusAndBody`) rather than which it drops
  (`asWireSnapshot`, `withoutVolatile`)
- a snapshot beside an assertion that checks **the same** field. the snapshot is then pure
  redundancy, which is the signature of a subset with no independent reach
- **a per-field mask with a literal** (`timestamp: '[masked]'`) — this one is fine and is the house
  pattern, so long as the rest of the value is spread whole (`{ ...result, timestamp: '[masked]' }`).
  the defect is the *omission* of unnamed fields, never the mask over named ones

## .the caveat

- **this does not forbid a projection.** a snapshot of a raw value with a timestamp in it churns on
  every run and gets deleted by the next maintainer. a projection is required; it must be a denylist.
- **`{ ...value, volatile: '[masked]' }` is a denylist**, expressed as a spread plus an override.
  that is the cheapest correct form and needs no helper.
- **a genuinely enormous value may be narrowed to a subtree** — `expect(files['svcSurf.ts'])` picks
  one file of many. that is a scope choice, not an allowlist, so long as the subtree itself is
  snapshotted whole.
- **a snapshot is not a substitute for an assertion.** `rule.require.snapshots` asks for **both**:
  the snapshot for review observability, the assertion for functional verification. this rule only
  governs the snapshot half.

## .the companion — prove the snapshot clamps, with the command CI runs

a denylist snapshot is still worthless if the test runner passes `--updateSnapshot`. verify it once,
by hand: **corrupt a snapshot value, then run the exact command CI runs.** if it passes and rewrites
the file, no snapshot in the repo is a clamp.

on the same stone this was true, and the cause was one unquoted variable in `package.json`:

```sh
$([ -n $RESNAP ] && echo '--updateSnapshot')     # 👎 unset -> `[ -n ]` -> a 1-arg test -> TRUE
$([ "${RESNAP:-}" = "true" ] && echo '--updateSnapshot')   # 👍 quoted, defaulted
```

`[ -n ]` asks *"is the string `-n` non-empty?"*, so `--updateSnapshot` was passed on **every** run,
locally and in CI. every snapshot in that repo was decorative and no one had noticed.

## .enforcement

- a `toMatchSnapshot()` on an object literal whose keys were hand-copied from the subject =
  **blocker**
- a projection named for the fields it keeps rather than the fields it drops = **nitpick**
- a snapshot whose only fields are also covered by an adjacent explicit assertion = **nitpick** (it
  has no independent reach; widen it or delete it)
- a test command that passes `--updateSnapshot` unconditionally = **blocker**
  (`rule.forbid.failhide` at the tool layer)
- a spread-plus-mask (`{ ...value, timestamp: '[masked]' }`) = false positive — that is this rule
  satisfied
- one subtree of an enormous value, snapshotted whole = false positive

## .see also

- `rule.require.snapshots.[lesson]` (mechanic) — why snapshots exist at all, and the demand for
  **both** snapshot and assertions
- `rule.require.contract-snapshot-exhaustiveness` (behaver) — the exhaustiveness this rule makes
  achievable; an allowlist cannot be exhaustive by construction
- `rule.require.clamp-edge-cases` (mechanic) — prove the clamp bites; the companion section above is
  that rule applied to the runner itself
- `rule.forbid.failhide` (mechanic) — an allowlist snapshot, and an unconditional
  `--updateSnapshot`, are both a green signal that verified none
- `rule.require.positive-control-before-absence-claims` — the same family: a signal you have not seen
  fail is not evidence
- `rule.require.review-attempts-deletion` — "would this snapshot show me a field i did not predict?"
  is a deletion question
