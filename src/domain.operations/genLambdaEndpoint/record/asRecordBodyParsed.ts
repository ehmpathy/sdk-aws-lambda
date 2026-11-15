import { getParsedJson } from '../../lambdaEndpointWire/serde/getParsedJson';

/**
 * .what = what `deserialize` means when a record-source caller declares none — one declaration,
 *         read by every record decoder and every record-source variant's config
 *         (`rule.forbid.parallel-codepaths`)
 * .why payload = json is the common case, and a caller who wants the raw string opts out by
 *        value: `deserialize: { payload: false }`
 *
 * .why a declaration of its own, where the api-gateway family and the schema face each hold one =
 *        to import a peer family's default would bind this family to it. they agree today and none
 *        owes the others that agreement forever (`rule.prefer.wet-over-dry`)
 */
export const DESERIALIZE_DEFAULT: { payload: boolean } = { payload: true };

/**
 * .what = parses a json record body into an object
 * .why = sqs, sns, and kinesis each hand the body over as text; most handlers want the object
 *
 * .note = a body that is not json is returned as the string rather than refused — a plain-text or
 *         csv producer is a legitimate sender, and its own schema (or `z.any()`) is where that shape
 *         gets judged. the same call the api-gateway twin makes, for the same reason
 * .note = the text is already decoded: a source whose wire carries an encoded body (kinesis's
 *         base64 `data`) decodes it before this, so the parse is one step for every source
 *
 * .why this is not shared with the api-gateway twin's parser = that one owns a base64 arm keyed on
 *         `isBase64Encoded`, a flag no record source carries. an abstraction that takes an
 *         always-false flag from three of its four callers is a worse shape than the duplicate
 *         (`rule.prefer.wet-over-dry`)
 */
export const asRecordBodyParsed = (input: { body: string | null }): unknown => {
  if (!input.body) return null;

  /**
   * .note = the parse is `getParsedJson`, the one the schema face uses too. it allowlists
   *         `SyntaxError` and rethrows every other class, so a real defect is never read as text
   *         (`rule.forbid.failhide`)
   * .note = the two faces differ only in what follows a refusal: the schema face records an issue,
   *         and this face hands the text on, so a refusal of it names the `deserialize` fix
   *         (`getRecordInputValidated`)
   */
  const parsed = getParsedJson({ json: input.body });
  return parsed.success ? parsed.data : input.body;
};
