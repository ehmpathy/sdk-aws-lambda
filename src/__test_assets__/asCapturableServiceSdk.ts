import type { LambdaClient } from '@aws-sdk/client-lambda';

import { createCapturableHandlers } from './createCapturableHandlers';
import { createInProcessLambdaHarness } from './createInProcessLambdaHarness';

/**
 * .what = a LambdaClient that lists + invokes the capturable svc-jobs handlers
 *         in-process (getJob, getJobs; both surface Job via `Job.contract()`)
 * .why = a reusable seam so the orchestrator + acceptance tests exercise the full
 *        codegen without a deploy; ListFunctions is faked to a fixed set so
 *        discovery is deterministic
 */
export const asCapturableServiceSdk = (): LambdaClient => {
  const { mockSend } = createInProcessLambdaHarness({
    'svc-jobs': createCapturableHandlers(),
  });
  return {
    // fake only the transport: `send` fields ListFunctions from a fixed set + routes
    // all other commands to the in-process harness (which runs the REAL handlers).
    // .rule = rule.forbid.acceptance.mocks — transport-only fake; real fidelity is
    //         proven in blackbox/deployed.codegen.acceptance.test.ts
    send: jest.fn().mockImplementation(async (command) => {
      if (command.constructor.name === 'ListFunctionsCommand')
        return {
          Functions: [
            { FunctionName: 'svc-jobs-prep-getJob' },
            { FunctionName: 'svc-jobs-prep-getJobs' },
          ],
          NextMarker: undefined,
        };
      return mockSend(command);
    }),
    // cast at the aws-sdk boundary: we implement only the `send` surface the codegen
    // calls, not the full LambdaClient. removable if a typed fake sdk is adopted.
  } as unknown as LambdaClient;
};
