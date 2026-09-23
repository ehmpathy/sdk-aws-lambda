import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import util from 'util';

import { useKeyrack } from './src/__test_assets__/useKeyrack';

// eslint-disable-next-line no-undef
jest.setTimeout(90000); // tests call downstream apis

// set console.log to not truncate nested objects
util.inspect.defaultOptions.depth = 5;

/**
 * .what = verify that we're running from a valid project directory; otherwise, fail fast
 * .why = prevent confusion and hard-to-debug errors from running tests in the wrong directory
 */
if (!existsSync(join(process.cwd(), 'package.json')))
  throw new Error('no package.json found in cwd. are you @gitroot?');

/**
 * .what = refuse the ec2 instance role as a credential source
 * .why = with no AWS_PROFILE and no static keys, the aws sdk credential chain falls all the
 *        way through to `fromInstanceMetadata` and picks up whatever role this box carries
 *        (`@aws-sdk/credential-provider-node/dist-cjs/index.js` — `remoteProvider`, the last
 *        link before the throw). that role is a DIFFERENT account than the one these tests
 *        target, and it is adopted silently, so a test would run against the wrong account
 *        with no tell (`rule.forbid.failhide`)
 *
 * ⚠️ .this block is THE HOME for this evidence. the same one-line assignment sits at
 *    `jest.integration.env.ts` and `provision/aws.infra/account=demo/resources.ts`, and each
 *    of those carries only its OWN `.why` plus a cite of this block
 *
 * .why it is kept even though `useKeyrack` splices static creds = that splice is the PRIMARY
 *      repair and it is stronger, since the chain never reaches IMDS once `AWS_PROFILE` is
 *      dropped. this line is the BACKSTOP for the two paths where `useKeyrack` returns early
 *      — `process.env.CI`, and a repo with no `.agent/keyrack.yml` — where no splice happens
 *
 * .why the ASSIGNMENT is not extracted too = it must run before any aws client is
 *      constructed, so its correctness is a property of WHERE THE LINE SITS. a shared module
 *      reached by `import` makes that a property of the module graph instead, which is
 *      strictly harder to audit. one visible line at each boot file beats one hidden one
 *
 * .note = ⚠️ this disables IMDS, never "ambient" in general. the container check runs FIRST in
 *         `remoteProvider`, so `AWS_CONTAINER_CREDENTIALS_RELATIVE_URI` is still adopted on
 *         ecs/fargate. an account assertion is what would close that, and is not yet built
 * .note = ci is unaffected: github oidc is adopted at `fromEnv` / `fromTokenFile`, both ABOVE
 *         `remoteProvider` in that chain
 */
process.env.AWS_EC2_METADATA_DISABLED = 'true';

/**
 * .what = source credentials from keyrack for test env, via useKeyrack
 * .why =
 *   - auto-inject keys into process.env
 *   - fail fast with a helpful error if keyrack is locked or keys are absent
 *   - splice static creds + drop AWS_PROFILE, so the v3 sdk reaches the chained target
 *     account rather than the ambient grove EC2 instance's own credentials
 * .note
 *   - use lenient mode if aws credentials already present (e.g., ci oidc)
 *   - keyrack lists AWS_PROFILE but ci uses oidc which sets ACCESS_KEY_ID
 */
const hasAwsCredentials = !!(
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE
);
useKeyrack({
  env: 'test',
  mode: hasAwsCredentials ? 'lenient' : 'strict',
});

/**
 * .what = verify that the env has sufficient auth to run the tests if aws is used; otherwise, fail fast
 * .why =
 *   - prevent time wasted waiting on tests to fail due to lack of credentials
 *   - prevent time wasted debugging tests which are failing due to hard-to-read missed credential errors
 */
const declapractUsePath = join(process.cwd(), 'declapract.use.yml');
const requiresAwsAuth =
  existsSync(declapractUsePath) &&
  readFileSync(declapractUsePath, 'utf8').includes('awsAccountId');
if (
  requiresAwsAuth &&
  !(process.env.AWS_PROFILE || process.env.AWS_ACCESS_KEY_ID)
)
  throw new Error(
    'no aws credentials present. please authenticate with aws to run acceptance tests',
  );

/**
 * .what = verify that required api keys are present; otherwise, fail fast
 * .why =
 *   - prevent time wasted waiting on tests to fail due to missing api keys
 *   - prevent agents from giving up when they have access to credentials
 */
const apikeysConfigPath = join(
  process.cwd(),
  '.agent/repo=.this/role=any/skills/use.apikeys.json',
);
if (existsSync(apikeysConfigPath)) {
  // direct import via require (json resolves automatically)
  const config = require(apikeysConfigPath);
  const requiredKeys: string[] = config?.apikeys?.required ?? [];
  const keysAbsent = requiredKeys.filter((key) => !process.env[key]);

  if (keysAbsent.length > 0) {
    throw new Error(`
⛈️  apikeys required to run these acceptance tests were not supplied.

   absent keys: ${keysAbsent.join(', ')}

   you have access to these keys - you just forgot to source them.

   run:
     source .agent/repo=.this/role=any/skills/use.apikeys.sh && npm run test:acceptance

   you must run these tests with these api keys.
   you're forbidden to give up.
   if you don't have privs to run use.apikeys.sh, ask a human for support.
   chances are, you already have privs to do so though.
`);
  }
}
