import type { Context } from 'aws-lambda';

import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from '../../../domain.objects/AwsIdentitySynthetic';
import type { LambdaEndpoint } from '../../../domain.objects/LambdaEndpoint';

/**
 * .what = casts an endpoint into the runtime identity aws would have supplied
 * .why = the local locus must answer the same `context.functionName` the cloud
 *        locus does, or a handler that branches on it takes the wrong branch in
 *        every ci pipeline
 *
 * 🔴 **the identity is DERIVED from the endpoint, never defaulted.**
 *
 *  `context.functionName` is, per `define.lambda-endpoint-ubiqlang`, the
 *  endpoint's **slug** — so aws delivers `svc-x-test-getY` at `at: 'cloud'`.
 *  supply no identity at the local locus and `asLambdaContext()` falls back to
 *  its own placeholder, so one call answers two identities:
 *
 *  | locus | `context.functionName` the handler would see |
 *  |---|---|
 *  | `'cloud'` | `svc-x-test-getY` — the slug |
 *  | `'local'` | `run-lambda-endpoint` — a default |
 *
 *  ⇒ and F6 names `functionName` *"the one field a handler can legitimately
 *    branch on"*, on measured evidence. so a handler that branches would take the
 *    WRONG branch on the locus that runs in every ci pipeline, and the right one
 *    only against real aws — the most expensive place to learn it.
 *
 * 🔴 **and it is a DERIVATION, never a knob.** a `context?: Partial<Context>`
 *    passthrough on `onSerialized` is declined, and the reason is the boundary's
 *    own contract:
 *
 *    - `at: 'cloud'` CANNOT honor a context override — aws builds it
 *    - ⇒ so the parameter would be a knob one locus silently ignores
 *      (`rule.forbid.unexpected-defaults`), on the one operation whose stated
 *      guarantee is that *"the locus changes where, never what"*
 *
 *    and the override is not needed, because the identity is not the caller's to
 *    supply: they already named it in `which` (`rule.require.solve-at-cause`). an
 *    author who genuinely wants to forge a context holds the referenced boundary,
 *    where the override lives and where no wire can contradict it.
 *
 * .note = the account id is a placeholder, deliberately, and it is the ONE
 *   placeholder — `domain.objects/AwsIdentitySynthetic` owns it. a local copy of
 *   the region default or of the account here makes this file another
 *   independent speaker of one convention.
 */
export const asLocalRunIdentity = (input: {
  endpoint: LambdaEndpoint;
  region: string | undefined;
}): Partial<Context> => {
  const region = input.region ?? AWS_REGION_SYNTHETIC;

  return {
    functionName: input.endpoint.slug,
    invokedFunctionArn: `arn:aws:lambda:${region}:${AWS_ACCOUNT_SYNTHETIC}:function:${input.endpoint.slug}`,
    logGroupName: `/aws/lambda/${input.endpoint.slug}`,
    logStreamName: input.endpoint.slug,
  };
};
