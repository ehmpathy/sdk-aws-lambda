import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import util from 'util';

import { keyrack } from 'rhachet/keyrack';

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
 * .what = source credentials from keyrack for test env
 * .why =
 *   - auto-inject keys into process.env
 *   - fail fast with helpful error if keyrack locked or keys absent
 * .note
 *   - use lenient mode if aws credentials already present (e.g., ci oidc)
 *   - keyrack lists AWS_PROFILE but ci uses oidc which sets ACCESS_KEY_ID
 */
const keyrackYmlPath = join(process.cwd(), '.agent/keyrack.yml');
const hasAwsCredentials = !!(
  process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE
);
if (existsSync(keyrackYmlPath))
  keyrack.source({
    env: 'test',
    owner: 'ehmpath',
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
