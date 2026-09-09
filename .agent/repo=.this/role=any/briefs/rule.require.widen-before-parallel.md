# rule.require.widen-before-parallel

## .what

before you add a contract **beside** an extant one, prove the extant contract cannot be
**widened** to cover the new case. a second export is the fallback, never the first move.

## .why

one needless peer spawns a whole design. the case that produced this rule proposed
`forApiGatewayWire` as a peer to `forApiGateway`. that single choice generated:

- a fulcrum — "peer export vs mode flag?"
- a second fulcrum — "does the peer keep the middy chain or go plain?"
- a shared-chain-builder refactor, whose only job was to keep the two peers from drift
- a name that mashed two dimensions (`rule.forbid.names-that-mash-dimensions`)
- a doubled coverage plan — every guarantee proven twice, under two names

widen the one contract and all five vanish at once. none of them was a real question; each was
an artifact of the peer.

the recurrent costs of a peer:

- **drift** — two chains, two error seams, two places a fix must land, and one of them will be
  forgotten
- **a choice at every call site** — the caller must learn which to pick, and will pick wrong at
  least once (hick's law)
- **a scaffold to hold them level** — the shared builder exists only because the peer exists
- **doubled proof** — every invariant verified twice

widen costs exactly one item: a break for extant callers. that is a one-time, mechanical,
compiler-guided edit — and on a library with no installed base it costs zero.

## .the test — for the proposer

before you write a peer, answer three:

1. **can the extant type widen to a superset that covers both cases?** if the new case reads as
   "the old case, plus a choice", the answer is usually yes.
2. **what does the widened form cost an extant caller?** count the call sites and name the shape
   of the edit. `return x` → `return { body: x }` is mechanical. a re-think per call site is not.
3. **is the installed base real?** an unreleased or newly-released library has no base to
   protect. do not pay for backwards compat that no one has bought.

if (1) is yes and (2) is mechanical, **widen** — and say so in the yield, with the version bump
the break earns.

## .the test — for the reviewer

when a proposal adds a second export that shares a prefix, a trigger, or a middleware chain with
an extant one, write the union type yourself. if it fits on one line, the peer is unjustified.

the smell list — each is a confession that widen was skipped:

- the proposal contains a fulcrum of the form **"peer export vs mode flag"**. the fork exists
  only because a third option was off the table.
- the proposal adds a **shared builder / extracted chain** so the two do not drift. the scaffold
  is the tell.
- the coverage plan repeats the same guarantees under two names.
- the new export's name needs a qualifier the extant one does not have.

## .the caveat — when a peer IS right

a peer earns its place when the two cases share a name and little else:

- the inputs differ in **kind**, not merely in shape (a queue trigger vs an http trigger)
- the **guarantees** differ (one at-least-once, one exactly-once)
- a union would need a discriminant no caller can supply meaningfully

if the union reads as `PickAny<{ ... }>` or one added optional key, it is a widen. if it reads as
a tagged union of two unrelated shapes, it may be a peer. say which, and why, in the yield.

## .examples

### 👎 bad — a peer, and the scaffold it demands

```ts
export const forApiGateway     = (config: A) => buildChain(config, { serialize: true });
export const forApiGatewayWire = (config: B) => buildChain(config, { serialize: false });
// buildChain exists ONLY to keep these two from drift.
// every future guarantee must be wired into both, and verified twice.
```

### 👍 good — one contract, widened

```ts
export const forApiGateway = <TInput, TBody>(config: {
  invoke: (...) => Promise<ApiGatewayResponse<TBody>>;  // PickAny<{ status, headers, body }>
}) => chain;

// { body: x }                                  -> 200 + json  (the convenient default)
// { status: 204 }                              -> 204, no body
// { status: 308, headers: { Location } }       -> a redirect
// { headers: { 'Content-Type': 'text/xml' }, body: xml } -> verbatim bytes
```

## .enforcement

- a new export parallel to an extant one, with no recorded attempt at widen = **blocker**
- a shared-builder refactor whose only purpose is to keep two parallel contracts level = **blocker** (delete one contract)
- a "peer vs flag" fulcrum raised with no "neither — widen" option on the table = **blocker**
- a peer whose case is recorded against the caveat above = false positive

## .see also

- ⚖️ **`rule.prefer.wet-over-dry` (mechanic) — the COUNTERWEIGHT.** do not widen to serve a case no
  one has. applied alone, this rule permits a speculative widen; that one alone permits a needless
  peer. read the pair together
- `rule.forbid.names-that-mash-dimensions` — a mashed name is often the tell of a needless peer
- `rule.prefer.defaults-match-common-case` (ergonomist) — a widened contract must keep the common case a one-liner
- `rule.require.retest-the-model-on-every-family` — the same failure at model grain: derived from one case, applied to two
- `rule.require.review-attempts-deletion` — "could this be one export instead of two?" is a deletion question
