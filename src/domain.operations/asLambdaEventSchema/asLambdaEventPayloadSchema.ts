import { type ZodType, z } from 'zod';

import { getParsedJson } from '../lambdaEndpointWire/serde/getParsedJson';

/**
 * .what = what `deserialize` means when a caller declares none
 * .why payload = json is the common case; a text stream opts out by value,
 *        `deserialize: { payload: false }` — the same key and default `forSqs` ships
 *
 * .why a third declaration, where `forSqs` and `forApiGateway` each hold one = to import a
 *        peer family's default would bind this family to it. the three coincide, yet each is
 *        free to diverge (`rule.prefer.wet-over-dry`)
 * .note = frozen, since every build shares this one reference
 */
export const DESERIALIZE_DEFAULT: Readonly<{ payload: boolean }> =
  Object.freeze({ payload: true });

/**
 * .what = the issue a message meets when the json step refuses it
 * .why = the common cause is a text stream wired with the json default, so the issue names
 *        that fix (`rule.require.errors-name-the-fix`)
 */
const ISSUE_NOT_JSON =
  'expected a json message; fix: for a text message (not json), set `deserialize: { payload: false }`';

/**
 * .what = parses a json string, or records a custom issue at the field
 * .why = a non-json message must be a refusal with a path, never a `JSON.parse` throw
 * .note = the parse itself is `getParsedJson`, which allowlists `SyntaxError` and rethrows
 *         every other class
 */
const asJsonParsed = (input: {
  value: string;
  ctx: z.core.$RefinementCtx<string>;
}): unknown => {
  const parsed = getParsedJson({ json: input.value });
  if (parsed.success) return parsed.data;
  input.ctx.addIssue({ code: 'custom', message: ISSUE_NOT_JSON });
  return z.NEVER;
};

/**
 * .what = the schema of one message slot: the wire string, decoded, then met by `payload`
 * .why = sns and kinesis differ only in how the wire string decodes to text (as-is vs base64),
 *        never in what happens after — so one transformer serves both
 *        (`rule.forbid.parallel-codepaths`)
 *
 * .note = the wire face (zod input) stays `string`, so introspection publishes the honest wire
 *         shape and `forAsk`'s handler accepts the aws-lambda type with no cast
 */
export const asLambdaEventPayloadSchema = (input: {
  /**
   * .note = input face `any`: zod's `.pipe()` demands the target accept the piped value, and the
   *         piped value is `string` (text) or `unknown` (parsed json), which no single declared
   *         input type covers. the payload schema itself judges the value at run time
   */
  payload: ZodType<unknown, any>;
  deserialize: { payload: boolean };
  decode: (input: { wire: string }) => string;
}): ZodType<unknown, string> => {
  // decode the wire string to text, as the source delivers it
  const text = z.string().transform((wire) => input.decode({ wire }));

  // a text payload meets the text as-is
  if (!input.deserialize.payload) return text.pipe(input.payload);

  // a json payload meets the parsed text
  return text
    .transform((value, ctx) => asJsonParsed({ value, ctx }))
    .pipe(input.payload);
};
