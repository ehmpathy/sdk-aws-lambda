import { LambdaClient } from '@aws-sdk/client-lambda';
import { given, then, when } from 'test-fns';

import { genLambdaClient } from './genLambdaClient';

describe('genLambdaClient', () => {
  const originalRegion = process.env.AWS_REGION;

  afterEach(() => {
    if (originalRegion !== undefined) {
      process.env.AWS_REGION = originalRegion;
    } else {
      delete process.env.AWS_REGION;
    }
  });

  given('[case1] lambda client provided', () => {
    when('[t0] client is injected', () => {
      then('returns the injected client', () => {
        const injectedClient = new LambdaClient({ region: 'eu-west-1' });
        const result = genLambdaClient({ sdk: injectedClient });
        expect(result).toBe(injectedClient);
      });
    });
  });

  given('[case2] no client but region in env context', () => {
    when('[t0] region is provided', () => {
      then('creates client with provided region', () => {
        const result = genLambdaClient({
          env: { region: 'ap-south-1' },
        });
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });

  given('[case3] no region provided', () => {
    when('[t0] no explicit region', () => {
      then('creates client and lets SDK infer region', () => {
        const result = genLambdaClient({});
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });

  given('[case4] env object without region', () => {
    when('[t0] env.region is undefined', () => {
      then('creates client and lets SDK infer region', () => {
        const result = genLambdaClient({ env: {} });
        expect(result).toBeInstanceOf(LambdaClient);
      });
    });
  });
});
