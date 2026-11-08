import { ConstraintError } from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { getError, given, then, when } from 'test-fns';

import { onSerialized } from './runLambdaEndpoint.onSerialized';

/**
 * .what = the credential-free reject, through the REAL aws-sdk v3 credential chain
 * .why = `[case17]` of `runLambdaEndpoint.onSerialized.integration.test.ts` and
 *        `throwIfCredentialsError.test.ts` prove the detector against a hand-built
 *        `CredentialsProviderError`. only a real chain proves the detector reads the
 *        shape aws actually throws, so a drift in that shape goes red here
 *
 * .note = its own file on purpose: jest gives each test file its own copy of
 *   `process.env`, so the scrub below cannot reach a peer test that needs credentials
 */
const AWS_ENV_KEPT = new Set(['AWS_REGION', 'AWS_DEFAULT_REGION']);

/**
 * .what = strips every source the v3 default chain reads, so it finds no credential
 * .why = env keys, profile files, sso, container and instance metadata are each a
 *        provider; one left in place would hand the chain a credential
 */
const setAwsCredentialsAbsent = (): void => {
  Object.keys(process.env)
    .filter((key) => key.startsWith('AWS_') && !AWS_ENV_KEPT.has(key))
    .map((key) => delete process.env[key]);
  process.env.AWS_SHARED_CREDENTIALS_FILE = '/nonexistent/aws/credentials';
  process.env.AWS_CONFIG_FILE = '/nonexistent/aws/config';
  process.env.AWS_EC2_METADATA_DISABLED = 'true';
  process.env.AWS_REGION = process.env.AWS_REGION ?? 'us-east-1';
};

describe('runLambdaEndpoint.onSerialized, with no aws credentials on the host', () => {
  beforeAll(() => setAwsCredentialsAbsent());

  given('[case1] a developer runs a cloud invoke with no credentials', () => {
    when('[t0] the real credential chain finds none', () => {
      then(
        'it rejects with LambdaCredentialsAbsentError, whose hint names the fix and the env',
        async () => {
          const error = await getError(
            onSerialized(
              {
                which: { service: 'svc-example', function: 'getServiceBySlug' },
                event: { slug: 'surf-lesson' },
                at: 'cloud',
              },
              {
                // pinned, so the whole-error snapshot below holds no generated exid
                ...genContextLogTrail({
                  trail: { exid: 'exid:credentials-absent', stack: [] },
                  env: null,
                }),
                env: { access: 'test' as const },
              },
            ),
          );

          // caller-must-fix: at this boundary the caller is a developer at a terminal
          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.constructor.name).toEqual(
            'LambdaCredentialsAbsentError',
          );

          // the hint is the whole claim: aws's own text names no env and no command
          const metadata = (error as ConstraintError).metadata as Record<
            string,
            unknown
          >;
          expect(String(metadata.hint)).toContain(
            'rhx keyrack unlock --owner ehmpath --env test',
          );

          // the real aws fault is kept at the root of the cause chain
          const getAllErrorNames = (from: unknown): string[] => {
            if (!(from instanceof Error)) return [];
            const cause =
              (from as { cause?: unknown }).cause ??
              (from as { metadata?: { cause?: unknown } }).metadata?.cause;
            const label =
              from.name === 'Error' ? from.constructor.name : from.name;
            return [label, ...getAllErrorNames(cause)];
          };
          const names = getAllErrorNames(error);
          expect(names[0]).toEqual('LambdaCredentialsAbsentError');
          expect(names[names.length - 1]).toMatch(/credential/i);
          expect(names).toEqual([
            'LambdaCredentialsAbsentError',
            'LambdaEndpointError',
            'CredentialsProviderError',
          ]);

          // the whole error a developer reads: message and every metadata key
          expect(error).toMatchSnapshot();
        },
      );
    });
  });
});
