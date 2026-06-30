import { LambdaClient } from '@aws-sdk/client-lambda';
import { given, then, when } from 'test-fns';

import { genLambdaSdk } from './genLambdaSdk';

describe('genLambdaSdk', () => {
  const originalRegion = process.env.AWS_REGION;

  afterEach(() => {
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
});
