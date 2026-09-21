/**
 * .what = the synthetic aws coordinates a no-cloud run stamps into arns
 * .why = a run that addresses no real account still has to emit well-formed
 *        arns — an event envelope carries them, and so does a lambda context.
 *        both need a region and an account, and neither may invent its own.
 *
 * 🔴 this file is the WHOLE-convention owner — the event factories, the local
 *    run identity, and the lambda context all read it. a duplicate of these two
 *    values is INERT until the edit that splits it, and no gate can catch the
 *    split: every copy is a valid arn on its own.
 *
 * ⚠️ the `_SYNTHETIC` suffix carries weight. this repo also reads a REAL region
 *    from `process.env.AWS_REGION` (`genLambdaSdk`), so a bare `AWS_REGION`
 *    names two things one import apart (`rule.forbid.ambiguous-labels`).
 *
 * .note = the account is `000000000000` deliberately — a fabricated-but-plausible
 *   id would invite a handler to parse it; twelve zeros read as synthetic.
 */
export const AWS_REGION_SYNTHETIC = 'us-east-1';
export const AWS_ACCOUNT_SYNTHETIC = '000000000000';
