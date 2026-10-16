# F5 — `fromApiGateway` declares http; undeclared events keep the wrapper

## .the fork

`runLambdaEndpoint` must pick the carrier — header or wrapper — per event. how does it know an
event is http?

- A. `asLambdaEvent.fromApiGateway` declares it on its output; any other event keeps the wrapper
- B. a new `struct` field, `transport: 'http'`, at the call site
- C. sniff the shape (`httpMethod`, `requestContext`) — forbidden by the invariant

## .taken = A, and why at the time

- the foreman's design names A
- the default call needs no new knob: the event builder already knows what it built
- C is forbidden: *"dialect inferred from the event's shape rather than a declared carrier = blocker"*

## .rework = clean

one internal mark plus one read. no caller writes the mark.

## .confidence = 70%, low because

- a hand-built api gateway object gets the wrapper and a 500 — the same symptom as #51, for a
  smaller group. case 5 `[t1]` softens it with a log that names the fix, but does not remove it
- the mark must survive or precede the json strip at `onSerialized` — a symbol does not survive
  `JSON.stringify`. the mechanism (symbol read before the strip, or a module-scoped `WeakSet`) is a
  blueprint choice

## .the cost, known

the mark is a non-enumerable symbol on the built event. a spread, `structuredClone`, or json round
trip drops it, and the copy meets the wrapper path. the wrapper is then refused at a `forApiGateway`
endpoint with a message that names both remedies, the copy loss among them (readme, "legacy handlers").

## .the handler stamp, built after the level 5 and 6 reviews

four peer rounds proposed a declaration on the handler, and the corpus evidence settled it: a consumer's
fixture helper builds its api gateway events with `{ ...event, headers, requestContext }`, a spread copy,
so every event it builds lost the mark and met the 500. each `genLambdaEndpoint` builder now stamps the
handler it returns with its carrier (`setHandlerTrailCarrier`), and the same constant feeds its
`genTrailMiddleware({ carrier })`. `onReferenced` and the local locus of `onSerialized` hold the handler,
so they read the stamp first and fall back to the event's mark for a plain handler. only the cloud locus
holds no handler, so the event's mark is its one declaration, and a copy there still fails loud with the
remedies. a stamp is not a registry: it is the same mechanism as the event mark, placed on the object
whose family it describes, and no locus reads both with a conflict.

## .a rule that read the event's headers, tried and removed

a carrier rule that also treated an event with an `x-trail-exid` header as `headers` made a copy of a
built event work once the header was set. a peer measured its cost: a direct-invoke event that carries a
forwarded request's header was framed for the wrong family (the output answered ancient while the type
promised contemp). an event cannot know which family receives it, so the contents of an event never choose
its carrier. the remedy for a copy is to pass the change to the builder; a raw captured event goes through
`struct: ancient` and arrives as sent. `[case9]` of `onReferenced.forApiGateway.test.ts` pins the
direct-invoke event.

## .where

`asLambdaEvent.fromApiGateway.ts`; `runLambdaEndpoint.onReferenced.ts`; `serde/asFramedPayload.ts`.

## .verdict

open — for the fulcrum council.
