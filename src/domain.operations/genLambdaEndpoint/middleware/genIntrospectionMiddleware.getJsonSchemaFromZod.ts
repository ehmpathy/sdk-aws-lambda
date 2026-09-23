import { MalfunctionError } from 'helpful-errors';
import { z } from 'zod';
import type { JSONSchema } from 'zod/v4/core/json-schema';

/**
 * .what = publish a zod schema as the json-schema document a caller is typed against
 * .why = this is the one door to `z.toJSONSchema` in src, so the wire face is a property of
 *        this function rather than a flag each caller must remember
 *
 * ✅ .the one-door claim is CLAMPED, never merely stated here —
 *    `genIntrospectionMiddleware.getJsonSchemaFromZod.integration.test.ts` reads the `src/` tree
 *    and grades both halves: exactly one prod call site (`[t1]`), and this face on it (`[t2]`).
 *    both rows were driven RED before the clamp was trusted — a throwaway second call site, and
 *    this flag flipped to `'output'`. so a second door added without the flag goes red in ci
 *    rather than reopens a service-wide crash silently
 *
 * .note = `{ io: 'input' }` is UNCONDITIONAL, at both borders. `io` names the SIDE of a
 *         contract (wire vs instance), never the BORDER of an endpoint (request vs response) —
 *         and the wire side is what crosses in both directions. on the response path
 *         `JSON.stringify` is the real encoder, and it emits the wire shape regardless of what
 *         output validation returns, so a published instance-face would describe a document no
 *         caller ever sends or receives
 *
 * ✅ .the DEPLOYED face is clamped too, byte-exact —
 *    `deployed.codegen.refs.acceptance.test.ts` `[case2]` calls `getOneLambdaContract` against
 *    the live `svc-trophy-prep-getTrophy` and pins every marker shape this function emits:
 *    `x-domain-object` on the trophy, plus `by: primary | unique | ref` beneath it. driven RED
 *    before it was trusted — this line swapped to `{ unrepresentable: 'any' }` (the `#33` shape)
 *    turned all three of its rows red while `returns the endpoint schema` stayed GREEN, which is
 *    the hazard exactly: the crash goes away and the pragmas are destroyed with no tell
 *    (rule.forbid.failhide). reverted to green
 *
 * .note = an ABSENT position publishes `{ not: {} }` rather than throws. `z.undefined()` and
 *         `z.void()` are the two shapes a handler that returns no value declares, and zod
 *         refuses to render either — so before this, such an endpoint could not introspect
 *         at all and its author reached for `z.unknown()`, which publishes `{}` and tells a
 *         caller every value is valid. `{ not: {} }` is the honest statement, and it reads
 *         correctly at both positions: at a root, the response carries no document; at a
 *         key, the key must be absent — which is exactly what `z.undefined()` accepts, so
 *         the key is dropped from `required` too. see `setAbsentPositionsRendered`
 *
 * .note = zod's default is `io: 'output'`, which asks what a parse hands BACK — a live class
 *         for any schema that coerces. that is not json, so the default throws
 *         `Transforms cannot be represented in JSON Schema` and takes down
 *         `getAllLambdaContracts` for the whole service. `X.contract()` always coerces, so
 *         every dobj position reaches that path
 *
 * ⚠️ .defect = LIVE, NOT FIXED — at the OUTPUT border this face DIVERGES from the document
 *              that crosses, for two shapes out of six measured
 *   .proof it is live = `[case5]` of the peer spec drives each shape through the real
 *                       `getValidatedOutput` and serializes it as the runtime does, then grades
 *                       the pair. the `.pipe()` and type-shift `.transform()` rows grade
 *                       `CONTRADICTS`, and that grade is COMPUTED from the measured pair. both
 *                       rows are GREEN, so the divergence is present
 *   .the class, measured = a coerced dobj AGREES exactly (the headline shape) · a plain schema
 *                          agrees · `.default()` and `.catch()` UNDER-declare, so the face is
 *                          weaker than the truth and never wrong · a `.pipe()` and a type-shift
 *                          `.transform()` CONTRADICT, so the face names a type the document does
 *                          not carry
 *   .why unrepaired = the only face that describes those two rows is `io: 'output'`, and it
 *                     THROWS for every `X.contract()` position — the crash above. a per-schema
 *                     choice between the faces is two code paths for one guarantee
 *                     (rule.forbid.parallel-codepaths) plus a silent fallback
 *                     (rule.forbid.failhide). so one face serves both borders, and the trade is
 *                     DECLARED here rather than met in a generated caller
 *   .the trade, stated plainly = the discarded default was RIGHT for a `.pipe()` at the output
 *                                border and could not serve a dobj at all. this one serves every
 *                                dobj and is wrong for a `.pipe()`. the dobj is the shape this
 *                                sdk exists to publish
 *   .both halves are MEASURED = `[case6]` of the peer spec drives the discarded face at a dobj
 *                               and clamps the throw; `[case7]` drives it at the `.pipe()` and
 *                               clamps that it does NOT throw and publishes `number`. so the
 *                               sentence above cites a run rather than a recollection
 *   .the fix-forward path = `.dream/v2026_09_18.fix.published-face-contradicts-the-wire-for-a-pipe.md`
 *                           carries the shape of the repair — the two faces reconcile only once
 *                           zod can render a transform's output side, or once this sdk owns its
 *                           own renderer. a per-schema choice is NOT that repair, and the dream
 *                           records why, so the next traveler meets the measurement before the
 *                           idea (rule.always.catch-dreams-for-followups)
 */
/**
 * .what = the fix half of the message an engineer meets when the schema is not this zod's
 * .why = `rule.require.errors-name-the-fix`. measured on `zod@4.4.3`: a schema object whose
 *        `_zod` marker is absent or hollow reaches zod's dispatch and raises a bare
 *        `TypeError: Cannot read properties of undefined (reading 'def')` — loud, and it names
 *        neither zod, nor the schema, nor the two-copy cause. so the engineer's path is a stack
 *        trace into a vendor file, with no clue what to change
 *
 * .note = the likeliest single cause is a SPLIT INSTALL: `package.json` declares `zod` a plain
 *         dependency with no peer range, and this function does a value import of `z` then
 *         renders a schema the CONSUMER's zod built. two copies in one `node_modules` and the
 *         markers no longer match. that is tracked as `F03`, and this hint is what makes the
 *         failure diagnosable while the manifest question stays open
 */
const FOREIGN_SCHEMA_HINT =
  "the value handed to `getJsonSchemaFromZod` does not carry this zod install's marker — most often two copies of `zod` in one `node_modules`, so a schema built by one is rendered by the other. run `npm ls zod` (or `pnpm why zod`) and dedupe to a single version";

/**
 * .what = the zod node types that denote NO value at all
 * .why = `z.undefined()` and `z.void()` both accept a handler that returns no value, and
 *        zod refuses to render either one — so an endpoint that returns no value could not
 *        introspect, and its author was pushed to `z.unknown()`, which publishes `{}` and
 *        tells a caller that ANY value is valid. that is the rubber-stamp this sdk exists
 *        to retire, surviving one corner in
 *
 * .the rendering = `{ not: {} }` — "no json value is valid here". true at BOTH positions:
 *        at a root it says the response carries no document; at a key it says the key must
 *        be absent, which is exactly what `z.undefined()` accepts
 */
const TYPES_ABSENT = ['undefined', 'void'];

/**
 * .what = the zod node types whose EMPTY `{}` rendering is the truth rather than a silence
 * .why = `unrepresentable: 'any'` below renders every un-renderable node as `{}`, which is
 *        indistinguishable from the `{}` these two produce honestly. so the set is named,
 *        and every OTHER empty node is re-raised by `setAbsentPositionsRendered`
 */
const TYPES_OPEN = ['unknown', 'any'];

/**
 * .what = whether a zod node type denotes an absent value
 */
const getIsAbsentType = (type: string | undefined): boolean =>
  !!type && TYPES_ABSENT.includes(type);

/**
 * .what = read a zod node's type off a `toJSONSchema` override context
 * .why = the override hands the live schema object, and its type is the only signal that
 *        says WHICH position was rendered. one reader, so the shape of that reach is
 *        stated once rather than at each branch (rule.require.named-transformers)
 */
const getNodeType = (zodSchema: unknown): string | undefined =>
  (zodSchema as { _zod?: { def?: { type?: string } } })?._zod?.def?.type;

/**
 * .what = whether a zod node hands its render off to another node it wraps
 * .why = a wrapper's `{}` is INHERITED, never its own — so it must not be re-raised. measured:
 *        `asApiGatewayResponseSchema` writes `body: input.body.optional()`, so a perfectly
 *        legal `z.any()` body reaches the override as an `optional` node that renders `{}`,
 *        and a naive emptiness test refused it. that is a FALSE REFUSAL of the one shape the
 *        re-raise exists to permit
 *   .measured = `[case17][t2]` of `genLambdaEndpoint.forApiGateway.test.ts` went 200 -> 500 on
 *               the first draft of this branch, and is the clamp that holds it
 *
 * .note = the test is the PRESENCE OF AN INNER, never a list of wrapper names. a name list is
 *         a guess that goes stale the moment zod adds a wrapper; this reads the property the
 *         render actually depends on. the three shapes zod uses, measured on `4.4.3` against
 *         `json-schema-processors.cjs`: `def.innerType` (optional, nullable, default, prefault,
 *         nonoptional, readonly, catch, success), `def.in` / `def.out` (pipe, line 529), and
 *         `_zod.innerType` (lazy, line 558)
 *
 * ⚠️ .why it matters beyond the one false refusal = it makes the re-raise ORDER-INDEPENDENT.
 *    zod runs the override over `[...ctx.seen.entries()].reverse()`, which is deepest-first
 *    (`to-json-schema.cjs:302`) — but `flattenRef` recurses into a parent at line 279, so a
 *    wrapper CAN be overridden before its inner. with this test the verdict is the same either
 *    way, since the wrapper never carries a verdict of its own. the leaf always gets its own
 *    call, because every node `process` touches lands in `ctx.seen`
 */
const getIsNodeWithInner = (zodSchema: unknown): boolean => {
  const node = zodSchema as {
    _zod?: { innerType?: unknown; def?: { innerType?: unknown; in?: unknown } };
  };
  return !!(
    node?._zod?.def?.innerType ??
    node?._zod?.def?.in ??
    node?._zod?.innerType
  );
};

/**
 * .what = rewrite one rendered node so an ABSENT position publishes honestly, and so no
 *         OTHER un-renderable position is silenced by the blanket flag that makes this
 *         rewrite reachable
 * .why = `unrepresentable: 'any'` is what stops zod's throw, and on its own it is a
 *        failhide at scale — measured on `zod@4.4.3`, it renders `date`, `bigint`,
 *        `symbol`, `map`, and `custom` each as `{}`, the same rubber-stamp. so the flag
 *        disarms the refusal globally and this re-arms it precisely (rule.forbid.failhide)
 *
 * ⚠️ .why it is NOT the `#33` hazard = that hazard is `unrepresentable: 'any'` used INSTEAD
 *        of `{ io: 'input' }`, which renders every coerced dobj as `{}` and destroys the
 *        `x-domain-object` pragma with no tell. here the flag rides BESIDE `io: 'input'`,
 *        which already resolves every transform — measured byte-identical for a dobj schema
 *        with and without the flag
 */
const setAbsentPositionsRendered = (ctx: {
  zodSchema: unknown;
  jsonSchema: Record<string, unknown>;
}): void => {
  const type = getNodeType(ctx.zodSchema);

  // an absent position publishes `{ not: {} }` — no json value is valid here
  //
  // ⚠️ .why the parent's `required` is left ALONE = a first draft stripped an absent key
  //    out of `required`, on the reasoning that the position accepts the key being
  //    omitted. MEASURED FALSE: `z.object({ b: z.undefined() }).safeParse({})` returns
  //    `success: false` on `zod@4.4.3` — zod demands the key be PRESENT and hold
  //    `undefined`. so the strip would have published a face that accepts a document the
  //    parse then rejects. left in place, `required: ['b']` beside `b: { not: {} }` is
  //    unsatisfiable by any json document, which is the truth exactly
  //    (`[case11][t2]` clamps both halves)
  if (getIsAbsentType(type)) {
    for (const key of Object.keys(ctx.jsonSchema)) delete ctx.jsonSchema[key];
    ctx.jsonSchema.not = {};
    return;
  }

  // any OTHER position the blanket flag emptied is re-raised, and by NAME — zod's own
  // message names the kind and never the field, so an engineer met a stack trace into a
  // vendor file with no clue which position to change (rule.require.errors-name-the-fix)
  //
  // .why a node WITH AN INNER is skipped = its `{}` came from the node it wraps, and that
  //      node gets its own call. to re-raise here would name `optional` where the real
  //      culprit is `date`, and would refuse a legal `z.any().optional()` outright
  if (
    Object.keys(ctx.jsonSchema).length === 0 &&
    !TYPES_OPEN.includes(type ?? '') &&
    !getIsNodeWithInner(ctx.zodSchema)
  )
    throw new MalfunctionError(
      `introspection cannot render this schema: a '${type}' position has no json representation`,
      {
        type,
        hint: `replace the \`${type}\` position with a json-representable one (for a value that is genuinely open, \`z.unknown()\`; for one that is absent, \`z.undefined()\`)`,
      },
    );
};

export const getJsonSchemaFromZod = <T extends z.ZodType>(
  schema: T,
): JSONSchema => {
  /**
   * .what = refuse a schema this zod install cannot recognize, by NAME rather than by TypeError
   * .why = the throw already happened one frame deeper, inside the vendor, with a message that
   *        names a property and not a cause (`[case8][t0]`, `[t1]`). this changes no path that
   *        succeeds today — it fires on exactly the set that already crashed, and hands that set
   *        an error an engineer can act on (rule.require.failloud)
   *
   * .note = it does NOT compare versions. two copies at the SAME version still carry distinct
   *         markers, and a version check would pass while the render fails — so the test is the
   *         marker itself, which is the property the render actually needs
   */
  const marker = (schema as { _zod?: { def?: { type?: unknown } } })?._zod;
  if (!marker?.def?.type)
    throw new MalfunctionError(
      'introspection cannot render this schema: it carries no recognizable zod marker',
      { hint: FOREIGN_SCHEMA_HINT },
    );

  return z.toJSONSchema(schema, {
    io: 'input',
    // .why the blanket + the override = zod refuses an un-renderable position by THROW,
    //      which took `z.undefined()` / `z.void()` off the table for every endpoint that
    //      introspects. the flag disarms that throw for every kind at once, and
    //      `setAbsentPositionsRendered` re-arms it for every kind but the two that have an
    //      honest rendering. neither half is safe alone: the flag alone is a failhide,
    //      the override alone never runs (zod throws before it returns)
    unrepresentable: 'any',
    override: setAbsentPositionsRendered,
  }) as JSONSchema;
};
