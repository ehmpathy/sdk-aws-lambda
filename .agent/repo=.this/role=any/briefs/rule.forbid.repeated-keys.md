# rule.forbid.repeated-keys

## .what

a key path must not repeat a name at adjacent depths. `response.body.body`, `payload.payload`,
`event.event`, `trail.trail` each read one name twice in a row, and the repeat is a defect.

```ts
// 👎 the same name at two depths
expect(response.body?.body).toEqual(…)        // body.body
const { payload } = input.payload             // payload.payload
await invoke({ event: { event } })            // event.event

// 👍 each depth names what it holds
expect(response.body?.bodyReceived).toEqual(…)
const { payload } = input.event
await invoke({ event })
```

## .why

- **a repeat is a clear sign of a defect.** two layers carry one name because one layer is
  named for its content instead of its role, or because a layer holds no more than the layer
  above did. the reader meets the stutter before the cause.
- **the name stops naming.** a reader of `payload.payload` cannot say which one is the body,
  which one is the wrapper, or why both exist. `rule.require.ubiqlang` asks one word for one
  concept — a repeat spends one word on two.
- **the cause hides in plain sight.** the fix is never to delete a `.payload`. it is to ask
  which of the two layers is wrong: a wrapper that adds no field (flatten it), a name that is
  not the role (rename the outer for what it does), or a field that is not the thing its name
  claims (rename the inner for what it is).

## .the test

read each key path aloud. does a name appear twice in a row? then one of the two layers is
named wrong, or is not needed.

a name that returns later in a path (`event.payload.event`) is a different question — adjacent
repeats are the tell, distant ones are not.

## .the fix — ask which layer is wrong

| the cause | the fix |
|---|---|
| the outer layer is named for its content, not its role | rename the outer for the role: `response.body` holds an answer, so `answer.body` reads once |
| the outer layer adds no field | flatten it: `{ event: { event } }` is `{ event }` |
| the inner name is a fixture's or caller's choice that collides with the slot | rename the inner for what it holds: the echo of a request body is `bodyReceived`, not `body` |
| the inner field is the thing the slot name claims | the slot and field are one concept — keep one |

## .the sweep — a repeat is a class

a repeat found once is the cue to look for its kin (`rule.require.sweep-the-defect-class`).
`rg` has no backreferences, so `grepsafe` cannot say "the same word twice". write the pairs
out, widen the vocabulary to this repo's nouns, and keep a known hit in the query as its own
control (`rule.require.positive-control-before-absence-claims`):

```sh
rhx grepsafe --pattern '\b(body\??\.body|payload\??\.payload|event\??\.event|trail\??\.trail|headers\??\.headers|…)\b' --path src --path blackbox
```

## .the caveat

- **a key the vendor owns, at the wire.** a name an external contract fixes (aws's own key on a
  wire form) may repeat a name this repo uses one layer up. it is one case, named as one — put
  the vendor's key behind a `*Onwire` type and keep the repeat off the paved path
  (`domain.terms/payload.md`).
- **a test double is not exempt.** a fixture's echo is read by the same reader, and the stutter
  costs the same.
- **a generic is not a repeat.** `Array<Array<T>>` and `Record<string, Record<…>>` name a
  nesting of one shape, not a key path.

## .enforcement

- a key path in prod code that repeats a name at adjacent depths = **blocker**
- the same in a test, a fixture, or a snapshot = **nitpick** (the reader pays, the caller does not)
- a repeat explained by a comment instead of a rename = **blocker** (`rule.forbid.defended-exceptions`)
- a repeat forced by a vendor's wire key, held behind an `*Onwire` type = false positive

## .see also

- `domain.terms/payload.md` — `payload` is the body, so `payload.payload` has no sense to carry
- `rule.require.ubiqlang` (mechanic) — one word per concept
- `rule.require.sweep-the-defect-class` — a repeat found once is a class
- `rule.forbid.defended-exceptions` — a comment that explains the stutter is a defence, not a fix
