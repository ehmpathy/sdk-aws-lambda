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
 *   - *"check the `deserialize` option"* — refuted in a prior round: it is meaningless at the
 *     ask-endpoint border, which shares this builder
 *   ⇒ so the hint names the ACT, which is true at both borders and in every env. a hint that is
 *     false in one env is worse than none, since a caller spends the trip before they learn it
 */
/**
 * ⚠️ .why DOUBLE quotes, where this repo's formatter prefers single = the possessive. biome
 *         picks the delimiter that needs fewer escapes, so a string that carries `'` takes `"`
 *
 * .the history, since the possessive was deferred for three rounds = "the endpoint declared
 *      input schema" shipped first, and three reviewers read it as a defect. the answer each
 *      round was a deferral: the string is emitted verbatim by four ACCEPTANCE snapshots whose
 *      suite cannot run here, so a source edit would leave four snapshots stale with no run to
 *      prove they moved right — the CLEAN half of `rule.always.fix-forward-under-scouts-honor`
 *
 *      ⇒ the deferral rested on an absence nobody had measured. a grep of the SUBJECT found
 *        22 byte-identical hits across 8 files, and SEVEN of them are UNIT snapshots — among
 *        them `genLambdaEndpoint.forApiGateway.test.ts.snap`, which carries the fully-escaped
 *        JSON-in-string form the acceptance hits have. so a unit run proves the identical
 *        transformation on the identical shape (rule.require.positive-control-before-absence-claims)
 *      ⇒ the repair is one `sedreplace` over all 8 files, then a unit run with NO `--resnap`.
 *        green means the hand-applied edit equals what the code emits, byte for byte
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
 * .what = transforms zod validation error into ConstraintError
 * .why = callers need friendly error messages for invalid input
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

  return new ConstraintError<ValidationErrorMetadata>(
    `validation failed: ${issuesMessage}`,
    { issues, hint },
  );
};
