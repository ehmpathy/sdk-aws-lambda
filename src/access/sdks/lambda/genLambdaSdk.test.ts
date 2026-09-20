import { LambdaClient } from '@aws-sdk/client-lambda';
import { given, then, when } from 'test-fns';

import { delLambdaSdks, genLambdaSdk } from './genLambdaSdk';

describe('genLambdaSdk', () => {
  const originalRegion = process.env.AWS_REGION;

  // release the memo between cases, so each case observes a cold map
  beforeEach(() => delLambdaSdks());

  afterEach(() => {
    delLambdaSdks();
    if (originalRegion !== undefined) {
      process.env.AWS_REGION = originalRegion;
    } else {
      delete process.env.AWS_REGION;
    }
  });

  given('[case1] LambdaClient provided', () => {
    when('[t0] LambdaClient is injected', () => {
      then('returns the injected LambdaClient', () => {
        const injectedSdk = new LambdaClient({ region: 'eu-west-1' });
        const result = genLambdaSdk({ sdk: injectedSdk });
        expect(result).toBe(injectedSdk);
      });

      then('never memoizes the injected LambdaClient', () => {
        const injectedSdk = new LambdaClient({ region: 'eu-west-1' });
        genLambdaSdk({ sdk: injectedSdk });

        // an injected client is the caller's to own, so it must not leak into the memo
        const result = genLambdaSdk({ env: { region: 'eu-west-1' } });
        expect(result).not.toBe(injectedSdk);
      });
    });
  });

  given('[case2] no LambdaClient but region in env context', () => {
    when('[t0] region is provided', () => {
      then('creates LambdaClient with provided region', () => {
        const result = genLambdaSdk({
          env: { region: 'ap-south-1' },
        });
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });

  given('[case3] no region provided', () => {
    when('[t0] no explicit region', () => {
      then('creates LambdaClient and lets SDK infer region', () => {
        const result = genLambdaSdk({});
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });

  given('[case4] env object without region', () => {
    when('[t0] env.region is undefined', () => {
      then('creates LambdaClient and lets SDK infer region', () => {
        const result = genLambdaSdk({ env: {} });
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });

  /**
   * .what = the findsert clamp: `gen` must converge, not create
   * .why = a client per call is an agent per call, so its keep-alive pool is always empty.
   *        that cost prod a `Runtime.ExitError` via `getaddrinfo EBUSY`
   */
  given('[case5] no LambdaClient injected, called twice', () => {
    when('[t0] the same region is asked for twice', () => {
      then('returns the very same LambdaClient instance', () => {
        const sdkFirst = genLambdaSdk({ env: { region: 'us-east-1' } });
        const sdkSecond = genLambdaSdk({ env: { region: 'us-east-1' } });
        expect(sdkSecond).toBe(sdkFirst);
      });
    });

    when('[t1] no region is asked for twice', () => {
      then('returns the very same LambdaClient instance', () => {
        const sdkFirst = genLambdaSdk({});
        const sdkSecond = genLambdaSdk({ env: {} });
        expect(sdkSecond).toBe(sdkFirst);
      });
    });

    when('[t2] two different regions are asked for', () => {
      then('returns two different LambdaClient instances', () => {
        const sdkEast = genLambdaSdk({ env: { region: 'us-east-1' } });
        const sdkWest = genLambdaSdk({ env: { region: 'us-west-2' } });
        expect(sdkWest).not.toBe(sdkEast);
      });

      then('each carries its own region', async () => {
        const sdkEast = genLambdaSdk({ env: { region: 'us-east-1' } });
        const sdkWest = genLambdaSdk({ env: { region: 'us-west-2' } });
        expect(await sdkEast.config.region()).toEqual('us-east-1');
        expect(await sdkWest.config.region()).toEqual('us-west-2');
      });
    });

    when('[t3] an explicit region and an inferred region are asked for', () => {
      then('returns two different LambdaClient instances', () => {
        const sdkInferred = genLambdaSdk({});
        const sdkExplicit = genLambdaSdk({ env: { region: 'us-east-1' } });
        expect(sdkExplicit).not.toBe(sdkInferred);
      });
    });
  });

  given('[case6] LambdaClients were memoized', () => {
    when('[t0] delLambdaSdks is called', () => {
      then('the next gen returns a fresh instance', () => {
        const sdkBefore = genLambdaSdk({ env: { region: 'us-east-1' } });
        delLambdaSdks();
        const sdkAfter = genLambdaSdk({ env: { region: 'us-east-1' } });
        expect(sdkAfter).not.toBe(sdkBefore);
      });

      then('it is idempotent, so a second del is a no-op', () => {
        genLambdaSdk({ env: { region: 'us-east-1' } });
        delLambdaSdks();
        expect(() => delLambdaSdks()).not.toThrow();
      });
    });
  });
});
