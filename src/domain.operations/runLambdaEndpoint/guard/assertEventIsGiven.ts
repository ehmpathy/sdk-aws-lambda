import { ConstraintError } from 'helpful-errors';

/**
 * .what = refuses an absent event, with an error that names the fix
 * .why = both boundaries need this guard, and each needs it AHEAD of any
 *        delegation — so the two call sites stay, and only the TEXT is lifted.
 *
 *        ⇒ the placement rule and its cause: `serde/asWireFunctionErrorPayload.ts`,
 *          section *"what this DROPS"*. it is the canonical account; this file
 *          states only what it MEASURED.
 *
 * ## ✅ this guard's own probe — and the two loci fail DIFFERENTLY
 *
 * measured by a probe that disabled the serialized guard and left the referenced
 * twin in place, so the twin was the only guard that could have answered:
 *
 * | locus | with only the twin's guard |
 * |---|---|
 * | `'cloud'` | never reaches the twin — `JSON.stringify` DROPS an `undefined` key, and the fault surfaces **90s away, in aws** (case=9) |
 * | `'local'` | the message crossed, and `metadata.hint` came back **`""`** |
 *
 * ⇒ so the delegated guard would answer one locus late and the other locus
 *   stripped of the one field that names the fix.
 *
 * ## 🔴 why the EXTRACTION, given the two call sites are deliberate
 *
 * ⚠️ **the duplication that stays and the duplication that goes are different
 *    duplications, and a review that conflates them reaches the wrong verdict.**
 *
 *    | what is duplicated | verdict |
 *    |---|---|
 *    | the guard's **placement** — one per boundary, ahead of delegation | ✅ **deliberate**, and measured above. it stays |
 *    | the guard's **message and hint text**, byte-for-byte in two files | 🔴 a drift hazard. it goes |
 *
 *    ⇒ so this operation changes no control flow at all: each boundary refuses
 *      its own absent event, at the same line, before any `.catch` exists. what
 *      is shared is the one fact the two had in common — the words.
 *
 * ⇒ **so the third guard this family grows is correct on both boundaries by
 *   construction**: it states its text once here, and each boundary keeps its own
 *   placement. `guard/assertHandlerIsRunnable.ts` is the peer that follows the
 *   same shape.
 */
export const assertEventIsGiven = (input: {
  event: unknown;
  /**
   * .what = the boundary's own context fields, merged into the error's metadata
   * .why = the serialized boundary can name `which` and `at`; the referenced one
   *        has neither, and passes `null` rather than an absent key.
   *
   * .note = `| null` rather than optional, deliberately. `rule.forbid.undefined-inputs`
   *   grades an optional attribute on an INTERNAL contract a blocker, and scopes
   *   its exception to the boundary a human meets. F15 took that exception for the
   *   five optionals on this drive's PUBLIC surface; this operation is internal,
   *   reached only by the two callers below, so the rule's letter governs it.
   */
  metadata: Record<string, unknown> | null;
}): void => {
  // .note = no `return` prefix, unlike the call sites this was extracted from.
  //   `ConstraintError.throw` answers `never` and this operation answers `void`,
  //   so `return ConstraintError.throw(…)` trips `lint/correctness/noVoidTypeReturn`.
  if (input.event === undefined)
    ConstraintError.throw(
      'no event was given, so there is no payload to send the endpoint',
      {
        ...(input.metadata ?? {}),
        hint: 'pass `event: {}` if the endpoint genuinely takes no input — that is what the wire delivers for an empty invoke. an `undefined` here is usually a typo in the variable you meant to pass.',
      },
    );
};
