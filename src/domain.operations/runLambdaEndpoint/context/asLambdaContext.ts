import type { Context } from 'aws-lambda';
import { ConstraintError } from 'helpful-errors';

import {
  AWS_ACCOUNT_SYNTHETIC,
  AWS_REGION_SYNTHETIC,
} from '../../../domain.objects/AwsIdentitySynthetic';

/**
 * .what = the legacy callback signals, each a LOUD refusal
 * .why = 🔴 **a no-op stub here is a failhide.** `context.fail(error)` is how a
 *        callback-style handler reports a fault, so `fail: () => {}` swallows
 *        that fault and the run answers `undefined` as though the handler had
 *        succeeded (`rule.forbid.failhide`). `done(error)` swallows the same
 *        way, and `succeed(result)` drops the handler's whole output.
 *
 * .note = this util takes handlers that return a promise, and only those — the
 *   contract F8 declares, on measured evidence that every handler in the
 *   population is middy-wrapped and so returns one.
 *
 *   🔴 **F8 named its own weak spot, and this closes it.** an `any`-typed
 *      callback handler was to get a promise that never settles — a hang to test
 *      timeout, which teaches the author naught. now the first legacy signal it
 *      sends throws with the fix in the message.
 *
 *   ⇒ `rule.prefer.prevent-over-correct`, rung 3 rather than rung 4: caught at
 *     the boundary, before harm, by an error that names the fix.
 *
 * .note = a consumer who genuinely wants the no-op keeps it — `overrides` spread
 *   last, so `asLambdaContext({ fail: () => {} })` restores the old shape.
 */
const refuseTheLegacyCallbackApi = (): never =>
  ConstraintError.throw(
    'the handler signalled through the legacy callback api, which runLambdaEndpoint does not support',
    {
      hint: 'return a promise from the handler instead. a middy-wrapped handler already does; a raw `(event, context, callback) => …` handler must be converted first.',
    },
  );

/**
 * .what = casts a partial aws lambda context into a whole one, with defaults
 * .why = a handler receives a `Context` from the runtime. off the runtime, one
 *        must be supplied, and every field the author does not care about is
 *        noise in their test.
 *
 * 🔴 .jest-free, deliberately
 *
 * this is the shipped twin of `__test_assets__/createTestContext`. that file's
 * peer export `createMockLog` calls `jest.fn()`, and `jest` is a devDependency
 * (`package.json`), so a shipped module that reached it would break a consumer's
 * install while this repo's own suite stayed green — the defect is invisible
 * from here.
 *
 * ⇒ so the pure half ships and the jest-bound half stays private. this file
 *   imports no test runner, and none of its transitive imports may either.
 *
 * ✅ **the root-barrel export is DELIBERATE public surface, not a leak** (F6 —
 *    *"the lambda `Context` is overridable, and partial"*). an author who wants a
 *    bare `Context` without a full `onReferenced` run reaches for this directly;
 *    the `Partial<Context>` override is the whole point of the export.
 */
export const asLambdaContext = (overrides?: Partial<Context>): Context => ({
  callbackWaitsForEmptyEventLoop: true,
  functionName: 'run-lambda-endpoint',
  functionVersion: '1',
  invokedFunctionArn: `arn:aws:lambda:${AWS_REGION_SYNTHETIC}:${AWS_ACCOUNT_SYNTHETIC}:function:run-lambda-endpoint`,
  memoryLimitInMB: '128',
  awsRequestId: '00000000-0000-4000-8000-000000000000',
  logGroupName: '/aws/lambda/run-lambda-endpoint',
  logStreamName: 'run-lambda-endpoint',
  getRemainingTimeInMillis: () => 30_000,
  done: refuseTheLegacyCallbackApi,
  fail: refuseTheLegacyCallbackApi,
  succeed: refuseTheLegacyCallbackApi,
  ...overrides,
});
