/**
 * .what = casts a handler's in-process answer into the byte payload aws puts on
 *         the wire
 * .why = the local locus must hand `getParsedResponse` what the CLOUD locus
 *        hands it, or the two loci hydrate different things and `at` changes the
 *        contract it exists to hold constant.
 *
 * ⚠️ **`?? null` is a BOUNDARY DIVERGENCE, never a defensive default.** a void
 *    handler answers `undefined` on the referenced boundary
 *    (`asWireStripped.ts:18` returns it rather than throws) and **`null`** here —
 *    because aws delivers `null` for a lambda that returns no value, so `null` is
 *    what a real caller receives.
 *
 *    ⇒ the two boundaries genuinely disagree about a void handler's value, and
 *      each is right for its own side. it is the same asymmetry the error stance
 *      has, one level down: the referenced boundary is HOST-faithful, the
 *      serialized boundary is WIRE-faithful.
 *
 *    🟡 an sqs or sns consumer handler is exactly the void case, so this is a real
 *      experience rather than an edge — see `case=11`'s actor, and
 *      `define.lambda-endpoint-run-boundary` for the boundary table it belongs to.
 *
 * .note = named rather than inline, so the `onSerialized` orchestrator reads as
 *   narrative rather than as a stringify-with-a-fallback plus a utf-8 encode
 *   (rule.forbid.inline-decode-friction). the divergence above is the whole
 *   reason it earns a name: it is the one line where the two loci differ.
 *
 * .note = the `?? null` is clamped in `asWirePayload.test.ts` on three axes, and
 *   each exists because a plausible edit breaks exactly one: `[case2]` the void
 *   divergence against its referenced peer, `[case3]` that `0` / `''` / `false`
 *   are NOT void, and `[case4]` that `WireDelivered`'s declared `null` and this
 *   runtime `null` remain one fact rather than two that drifted.
 */
export const asWirePayload = (output: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(output ?? null));
