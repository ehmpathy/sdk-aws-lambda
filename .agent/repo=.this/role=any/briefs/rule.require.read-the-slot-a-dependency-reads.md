# rule.require.read-the-slot-a-dependency-reads

## .what

before you assign a new sense to a **field a dependency also reads**, grep the dependency's source
for every read of it. a slot you share with a third party is part of **its** contract, and its
readers are the constraint — never your model of what the slot is for.

```ts
// 👎 the model says "the input translator turns inputBefore into inputAfter",
//    and the natural seam for that is the framework's own event slot
request.event = translate(request.event);
//      ^ but @middy/http-cors reads request.event.headers in its `after` hook,
//        so this starves cors of the request and it emits NO headers at all.
//        no type error, no throw — the headers are simply absent.

// 👍 the slot's readers are found first, so the model is designed around them
//    (or the value is carried elsewhere and the slot left alone)
```

## .why

a shared slot fails in the quietest way a slot can fail:

- **the framework does not object.** middy types `request.event` loosely on purpose, so an
  overwrite compiles. the vendor reads the field, finds the wrong shape, and **degrades** —
  it does not throw.
- **the loss is an absence, never an error.** cors that emits no headers looks identical to cors
  never registered. so only a test that asserts the *presence* of a vendor's output catches it,
  and most suites assert their own output instead.
- **your model is what misleads you.** a four-point pipeline model says what each slot denotes
  *to you*. it says not one word about who else reads it. the more coherent the model, the more
  confidently you will repurpose a field you do not own.

measured on this stone: a design named four pipeline points and picked `request.event` as the home
for one of them. `@middy/http-cors` reads that field in `after`. the defect surfaced only because
one extant test asserted cors headers were **present** — had the suite only asserted status and
body, the widen would have shipped with cors silently dead.

## .the test — for the proposer

before you write to any field of a framework-supplied object, ask: **"who else reads this?"**

| the field is | verdict |
|---|---|
| declared by your own code, read only by your own code | write to it freely |
| supplied by a framework (`request.*`, `ctx.*`, `req.locals`, a middleware bag) | **grep the dependency's source for every read, before you design around it** |
| documented by the vendor as yours to set | still grep — docs lag dist |

then check the direction of the read. a vendor that reads the slot in a **later** hook than yours
is the dangerous case, because your write lands first and its read fails second, out of sight of
your own code.

and if the slot turns out to be taken, prefer a **new** channel over a clever restore. an
overwrite-then-restore depends on hook order between two packages you do not control, which is
precisely what a dependency bump changes.

## .the test — for the reviewer

for every assignment to a framework object's field, ask: **"what proves the framework does not
read this?"**

- a grep of the dependency's source, cited → verified
- "it is the input slot, so it is ours after the handler runs" → **inferred; flag it**

the tells:

- an assignment to a well-known framework field (`request.event`, `res.locals`, `ctx.state`)
  where the proposal reasons about the field's *purpose* rather than its *readers*
- a claim about **several** dependencies at once ("cors and security-headers both read it") —
  a shared role invites a shared assumption, and one of them is usually different
- a model that assigns a slot to each of its points, with no note of prior occupants
- a coverage plan that asserts only the code's own output, never a vendor's contributed headers or
  fields. that plan cannot catch this class

## .the caveat

- **this is not a ban on writes to framework slots.** frameworks offer them to be written. the
  rule asks only that the write follow a read of who else reads.
- **a vendor's own sanctioned side-channel is the safe answer** (middy's `request.internal`,
  express's `res.locals`), because the vendor promises not to read your keys. prefer it — and
  still grep it once.
- **a dist read is legitimate evidence here.** the docs describe intent; the dist describes the
  reads. cite file and line so the next reader can re-check it after a bump.
- **a claim about what a dependency ACCEPTS from you owes no grep** — that is the vendor's own
  declared contract. the grep is owed for what it **reads** out of a slot you both touch.

## .examples

### 👎 bad — the model picks the slot, and one vendor reader goes dark

```ts
// the pipeline model: inputBefore -> inputAfter, so the translator writes the event
const before = async (request) => {
  request.event = asHandlerInput({ payload: request.event });
};
// @middy/http-cors, registered `after`, reads request.event.headers -> undefined
// result: zero cors headers on every response. no error anywhere.
```

### 👍 good — the readers are found, so the slot is left alone

```ts
/**
 * .note = `request.event` must stay http-shaped through the chain: `@middy/http-cors` reads
 *         `request.event.headers` and derives the http method from `request.event` in its
 *         `after` hook (`@middy/http-cors/index.js:38,83,106`). so the handler's input is
 *         carried at `event.body`, never in the event's place
 */
```

### 👍 good — the coverage that catches the class

```ts
// assert a VENDOR's contributed output, not only our own
then('cors headers are present', () => {
  expect(result.headers['Access-Control-Allow-Origin']).toBe('*');
});
```

## .enforcement

- an assignment to a framework-supplied field, with no recorded read of that field's other
  readers = **blocker**
- a claim about which dependencies read a slot, sourced to their shared role rather than to a
  grep = **blocker** (the claim misleads every later reader, and it is the exact form this rule
  exists to catch)
- an overwrite-then-restore of a shared slot that depends on hook order between third-party
  packages = **blocker** (use a side-channel)
- a coverage plan for a chain with third-party middleware that asserts no vendor-contributed
  output = **nitpick**
- a write to a vendor's sanctioned side-channel = false positive

## .see also

- `rule.require.measure-the-value-you-emit` — the twin: a claim about a value you **emit** owes a
  run. this one: a claim about a slot you **share** owes a grep. both fire when a vendor's
  declaration is mistaken for verification
- `rule.require.positive-control-before-absence-claims` — the third of the family: a claim that a
  symbol is **absent** owes a positive control, because a tool's silence is not a result. together
  the three name one defect — **a claim sourced to other than a verified observation** — with three
  sources: a vendor's type, a shared role, and a tool's zero
- `rule.require.retest-the-model-on-every-family` — the same defect at model grain; here the
  un-retested consumer is a **third party**, which is why no bind site could reveal it
- `rule.require.trust-but-verify` (mechanic) — the general form
- `rule.forbid.failhide` (mechanic) — a starved vendor degrades silently; that silence is the
  failhide this prevents
- `rule.require.read-package-docs-before-use` (mechanic) — read the docs before you use it; read
  the **dist** before you repurpose what it reads
