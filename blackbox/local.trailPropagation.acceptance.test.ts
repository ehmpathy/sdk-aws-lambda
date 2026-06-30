import type { Context } from 'aws-lambda';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { genLambdaEndpoint } from '../src/index';

describe('trail threading', () => {
  given('[case1] caller invokes with exid', () => {
    const schema = {
      input: z.object({
        value: z.string(),
      }),
      output: z.object({ receivedExid: z.string().nullable() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => {
        // extract exid from log.trail context
        const exid =
          log.trail?.exid ?? null;
        return { receivedExid: exid };
      },
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-123',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] invoked with trail.exid', () => {
      then('handler receives caller exid via trail context', async () => {
        // use wrapped format { event, trail } for trail propagation
        const result = await handler(
          { event: { value: 'test' }, trail: { exid: 'exid:caller-provided' } },
          mockContext,
        );
        expect(result.receivedExid).toBe('exid:caller-provided');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] caller invokes without context', () => {
    const schema = {
      input: z.object({ value: z.string() }),
      output: z.object({ hasExid: z.boolean() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => {
        const exid = log.trail
          ?.exid;
        return { hasExid: !!exid };
      },
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-456',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] invoked without trail', () => {
      then('handler auto-generates exid', async () => {
        const result = await handler({ value: 'test' }, mockContext);
        expect(result.hasExid).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case3] trail passes through handler chain', () => {
    const innerSchema = {
      input: z.object({
        value: z.string(),
      }),
      output: z.object({
        processed: z.boolean(),
        receivedExid: z.string().nullable(),
      }),
    };

    const innerHandler = genLambdaEndpoint({
      schema: innerSchema,
      invoke: async ({ event }, { log }) => {
        const innerExid =
          log.trail?.exid ?? null;
        return { processed: true, receivedExid: innerExid };
      },
    });

    const outerSchema = {
      input: z.object({
        value: z.string(),
      }),
      output: z.object({
        outerExid: z.string().nullable(),
        innerExid: z.string().nullable(),
      }),
    };

    const outerHandler = genLambdaEndpoint({
      schema: outerSchema,
      invoke: async ({ event }, { log }) => {
        const outerExid =
          log.trail?.exid ?? null;

        // invoke inner handler with same trail via wrapped format
        const innerResult = await innerHandler(
          {
            event: { value: event.value },
            trail: outerExid ? { exid: outerExid } : {},
          },
          {} as Context,
        );

        return { outerExid, innerExid: innerResult.receivedExid };
      },
    });

    const mockContext = {
      functionName: 'outer',
      awsRequestId: 'req-789',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:outer',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/outer',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] outer handler invokes inner', () => {
      then('exid propagates through chain', async () => {
        // use wrapped format { event, trail } for trail propagation
        const result = await outerHandler(
          {
            event: { value: 'chain-test' },
            trail: { exid: 'exid:chain-root' },
          },
          mockContext,
        );
        expect(result.outerExid).toBe('exid:chain-root');
        expect(result.innerExid).toBe('exid:chain-root');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case4] trail context has log methods', () => {
    const schema = {
      input: z.object({ value: z.string() }),
      output: z.object({
        hasDebug: z.boolean(),
        hasInfo: z.boolean(),
        hasWarn: z.boolean(),
        hasError: z.boolean(),
      }),
    };

    const handler = genLambdaEndpoint({
      schema,
      invoke: async ({ event }, { log }) => {
        return {
          hasDebug: typeof log.debug === 'function',
          hasInfo: typeof log.info === 'function',
          hasWarn: typeof log.warn === 'function',
          hasError: typeof log.error === 'function',
        };
      },
    });

    const mockContext = {
      functionName: 'test',
      awsRequestId: 'req-log',
      functionVersion: '1',
      invokedFunctionArn: 'arn:aws:lambda:us-east-1:123:function:test',
      memoryLimitInMB: '128',
      logGroupName: '/aws/lambda/test',
      logStreamName: 'stream',
      getRemainingTimeInMillis: () => 30000,
      done: () => {},
      fail: () => {},
      succeed: () => {},
      callbackWaitsForEmptyEventLoop: true,
    } as Context;

    when('[t0] handler receives log context', () => {
      then('log has all standard methods', async () => {
        const result = await handler({ value: 'test' }, mockContext);
        expect(result.hasDebug).toBe(true);
        expect(result.hasInfo).toBe(true);
        expect(result.hasWarn).toBe(true);
        expect(result.hasError).toBe(true);
        expect(result).toMatchSnapshot();
      });
    });
  });
});
