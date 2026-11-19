/**
 * .what = decodes kinesis `data` from base64 to utf8 text
 * .why = kinesis always delivers `data` base64-encoded, and both halves of the kinesis source read
 *        the text inside — `asLambdaEventSchema.fromKinesis` and `genLambdaEndpoint.forKinesis.*`.
 *        one decode, so the two halves cannot disagree on what a record's text is
 *        (`rule.forbid.parallel-codepaths`, `rule.prefer.most-common-denominator`)
 * .note = node's base64 decode never throws; bad base64 yields text the next step refuses
 */
export const asKinesisDataText = (input: { wire: string }): string =>
  Buffer.from(input.wire, 'base64').toString('utf8');
