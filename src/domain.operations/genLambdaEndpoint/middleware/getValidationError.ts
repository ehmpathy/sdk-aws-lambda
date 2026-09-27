import { ConstraintError } from 'helpful-errors';
import type { ZodError } from 'zod';

import {
  asZodIssuesMessage,
  getZodIssuesSummary,
  type ZodIssueSummary,
} from './getZodIssuesSummary';

export interface ValidationErrorMetadata {
  issues: ZodIssueSummary[];
  hint: string;
}

/**
 * .what = the FIX half of the message a caller meets when their input is refused
 * .why = `rule.require.errors-name-the-fix` asks an error for three parts — what, why, and the
 *        concrete next move. the zod summary supplies the first two (`(root): expected object,
 *        received string` names the path and the mismatch) and says NOT ONE WORD about what to
 *        do, so the caller is left to infer it
 *
 * ⚠️ .why it names no MECHANISM = two mechanisms were considered and each is false somewhere:
 *   - *"introspect the schema with `{ introspect: 'schema' }`"* — `genIntrospectionMiddleware`
 *     gates on `env.access === 'prep'` (`genIntrospectionMiddleware.ts:63`), so the hint would
 *     be a dead end in prod
 *   - *"check the `deserialize` option"* — meaningless at the ask-endpoint border, which shares
 *     this builder
 *   ⇒ so the hint names the ACT, which is true at both borders and in every env. a hint that is
 *     false in one env is worse than none, since a caller spends the trip before they learn it
 */
/**
 * ⚠️ .why DOUBLE quotes, where this repo's formatter prefers single = the possessive. biome
 *         picks the delimiter that needs fewer escapes, so a string that carries `'` takes `"`
 *
 * .note = this string is emitted verbatim into unit AND acceptance snapshots, in the same
 *         escaped JSON-in-string form. to reword it: `sedreplace` the old text across every
 *         snapshot, then run unit with NO `--resnap` — green proves the hand edit matches the
 *         emit byte for byte, which covers the acceptance snaps that share the form
 */
const VALIDATION_HINT_GENERIC =
  "send a value that satisfies the endpoint's declared input schema — correct each path named in `issues`";

/**
 * .what = the hint a caller meets when EVERY issue already names its own fix
 * .why = the generic hint above makes a CLAIM — *"the value you sent does not satisfy the
 *        schema"* — and on the constructor-reject path that claim is FALSE. `X.contract()`
 *        coerces, so the schema ACCEPTED the payload and the class constructor refused it
 *        afterward. the caller did exactly what the generic hint asks, and has no move at all
 *        ⇒ so the two hints fork on OBSERVED DATA — the issue set — never on handed config,
 *          which is the fork `rule.forbid.parallel-codepaths` permits
 */
const VALIDATION_HINT_SELF_NAMED =
  'each entry in `issues` names its own fix — apply the one at the path named there. ⚠️ where a message says the schema ACCEPTED the value, the fix belongs to the endpoint author, never to the caller';

/**
 * .what = the marker that says an issue carries its own fix, so a generic one would displace it
 * .why = ⚠️ `code === 'custom'` was proposed as the discriminator and is MEASURED over-broad. a
 *        constructor reject and a plain `.refine()` emit byte-identical issue shapes —
 *        `{ code: 'custom', path, message }`, with no field that separates them — and a
 *        `.refine()` IS part of the declared schema, so the generic hint is CORRECT there. to
 *        suppress on `custom` would strip right guidance from a real caller fault
 *        (probe: `.agent/.notes/probe.issue-discriminators.ts`, q1 vs q2)
 *
 * .why a MESSAGE check is acceptable where a dependency's message is normally not a contract =
 *        it degrades to today's behavior. `domain-objects` documents this convention outright —
 *        *"the message names the fix"* (`node_modules/domain-objects/readme.md:675`) — and our
 *        own `rule.require.errors-name-the-fix` mandates the same token. if upstream rewords it,
 *        the generic hint is appended exactly as it is today, so no new failure mode opens
 */
const FIX_NAMED_MARKER = 'fix:';

/**
 * .what = detects the one validation failure whose cause is the author's schema rather than
 *         the caller's request — a `.strict()` (or `z.strictObject`) header bag
 * .why = the sdk parses the whole wire header bag against `schema.input`, and api gateway
 *        injects keys no author declares (`host`, `x-forwarded-for`, `x-amzn-trace-id`, and
 *        cloudfront's own set). so a strict header schema refuses every real request — a total
 *        outage from an idiomatic zod instinct
 * .note = scoped to the `headers` path deliberately. `.strict()` on `payload` is correct and
 *         safe: the body is wholly the handler's, so an undeclared key there really is a
 *         caller fault. the axis is who else writes into the bag
 *         (`rule.require.read-the-slot-a-dependency-reads`)
 */
const getIsStrictHeaderRefusal = (input: {
  issues: ZodIssueSummary[];
}): boolean =>
  input.issues.some(
    (issue) => issue.code === 'unrecognized_keys' && issue.path === 'headers',
  );

/**
 * .what = the fix, named at the one moment an author is certain to read it
 * .why = zod's own message names the SYMPTOM precisely (`Unrecognized keys: "host", …`) and
 *        the CURE not at all, so an author reads it as a question about api gateway rather
 *        than about their own schema (`rule.require.errors-name-the-fix`)
 */
const HINT_STRICT_HEADERS =
  ' — a `headers` schema must NOT be `.strict()`: this sdk parses the WHOLE wire bag, and api' +
  ' gateway injects keys you did not declare, so a strict bag refuses every real request. drop' +
  ' `.strict()` — zod strips undeclared keys by default, and the sdk merges your validated keys' +
  ' back over the wire bag, so no key is lost. (`.strict()` on `payload` stays safe.)';

/**
 * .what = transforms zod validation error into ConstraintError
 * .why = callers need friendly error messages for invalid input
 *
 * .why the hint ships on the wire, though it addresses the author and not the caller = a strict
 *        header bag refuses 100% of traffic, so this message can only ever be read in a broken
 *        deployment — the author's own first request is the first to meet it. there is no
 *        author-only channel here in any case: `getErrorResponseBody` already forwards this
 *        error's metadata as `details`
 *
 * .why not refused at gen time, which would be one rung higher = a `toJSONSchema` probe of
 *        `schema.input` could read `additionalProperties: false` and throw at construction. it
 *        is refused on two counts: the failure here is already loud and total — never silent —
 *        and the ladder in `rule.prefer.prevent-over-correct` exists to close silent failures;
 *        and the probe throws on schemas it cannot represent, so the guard would need a
 *        swallowed error to stay safe, which trades a documented footgun for an undocumented
 *        failure mode (`rule.forbid.failhide`)
 */
export const getValidationError = (input: {
  error: ZodError;
}): ConstraintError<ValidationErrorMetadata> => {
  const issues = getZodIssuesSummary({ issues: input.error.issues });
  const issuesMessage = asZodIssuesMessage({ issues });

  // every issue names its own fix -> a generic one would name a DIFFERENT fix beside it
  const hint = issues.every((issue) => issue.message.includes(FIX_NAMED_MARKER))
    ? VALIDATION_HINT_SELF_NAMED
    : VALIDATION_HINT_GENERIC;

  // a strict header bag is the one refusal whose cure is the author's, so it rides the title
  const hintStrictHeaders = getIsStrictHeaderRefusal({ issues })
    ? HINT_STRICT_HEADERS
    : '';

  return new ConstraintError<ValidationErrorMetadata>(
    `validation failed: ${issuesMessage}${hintStrictHeaders}`,
    { issues, hint },
  );
};
