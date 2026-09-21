import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';

/**
 * .what = casts an event into the payload frame a given dialect sends
 * .why = the endpoint reads the FRAME to decide the dialect — `getIsWrappedPayload`
 *        checks for exactly `{ event, trail }` — so the frame IS the declaration.
 *
 * | dialect | the frame emitted | getIsWrappedPayload |
 * |---------|-------------------|---------------------|
 * | contemp | `{ event, trail }` | true  → contemp envelope |
 * | ancient | the event, untouched | false → ancient envelope |
 *
 * 🔴 .the one knob
 *
 * F9 names an open bound in the vision: the frame is driven by `trail:` and the
 * dialect is declared by `struct.payload` — **two knobs, one fact**, so they can
 * be set to disagree, and that design admits a contemp envelope under an ancient
 * return type.
 *
 * this closes it by DERIVATION: `struct.payload` is the only declaration, and the
 * frame follows from it. `trail` supplies the exid and never the dialect. so the
 * disagreement is unrepresentable rather than policed
 * (rule.prefer.prevent-over-correct, rung 1).
 *
 * 🔴 .ancient drops the trail, exactly as the wire does
 *
 * `askLambdaEndpoint.ts:74-77` sends `input.event` and nothing else on the ancient
 * dialect — the trail does not travel. this matches it verbatim.
 *
 * ⚠️ ancient never merges `{ ...event, trail }` for a caller that carries an exid
 *    — a shape `invariant.payload-format-compat` does describe, and that **no
 *    caller in this sdk ever sends**. that merge is backcompat nobody asked for,
 *    it makes the referenced boundary disagree with the wire, and it costs two
 *    defensive branches.
 */
export const asFramedPayload = (input: {
  event: unknown;
  trail: { exid?: string } | null;
  dialect: LambdaEndpointDialect;
}): unknown => {
  // contemp: the wrapper IS the declaration. an absent exid is legal —
  // genTrailMiddleware generates one, exactly as it does for askLambdaEndpoint.
  //
  // .note = the wrapper carries the exid and NO other trail field, which is what
  //   getLambdaPayload does for the wire (`serde/getLambdaPayload.ts:9-12`). the
  //   two are not merged because that one demands an exid where this one may not
  //   have it — but they must agree on the shape they emit, and they do. forward
  //   the whole trail here and a `stack` survives at this boundary, then gets
  //   dropped by the wire.
  //
  // 🔴 the agreement is CLAMPED, not held by this comment alone:
  //   `lambdaEndpointWire/frame/contempFrameEmittersAgree.test.ts` asserts both
  //   emitters produce the identical frame for an exid-bearing input, so a future
  //   divergence (a new field on one and not the other) goes red.
  if (input.dialect === 'contemp')
    return {
      event: input.event,
      trail: input.trail?.exid ? { exid: input.trail.exid } : {},
    };

  // ancient: the event crosses untouched. no wrapper, so getIsWrappedPayload stays
  // false and the endpoint answers in the dialect the caller declared.
  return input.event;
};
