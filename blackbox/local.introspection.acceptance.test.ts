/**
 * .what = acceptance tests for runtime schema introspection
 * .why = verifies end-to-end introspection behavior via public contract
 */
import type { Context } from 'aws-lambda';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { LambdaClient } from '@aws-sdk/client-lambda';

import { getError } from 'test-fns';

const { log } = genContextLogTrail({ trail: null, env: null });

import {
  forApiGateway,
  genIntrospectionMiddleware,
  genLambdaEndpoint,
  getAllLambdaContracts,
  getAllLambdaFunctionsByPrefix,
  getOneLambdaContract,
  LambdaIntrospectionBlockedError,
  LambdaIntrospectionNotSupportedError,
  LambdaFunctionNotFoundError,
  type LambdaEndpointSchema,
} from '../src/index';
import { createInProcessLambdaHarness } from '../src/__test_assets__/createInProcessLambdaHarness';
import { invokeHandlerForTest } from '../src/__test_assets__/invokeHandlerForTest';

/**
 * .mock = in-process lambda transport (createInProcessLambdaHarness)
 *   .rule = rule.forbid.acceptance.mocks
 *   .scope = the caller-contract cases below (getOneLambdaContract /
 *            getAllLambdaContracts via harness)
 * .why = these cases verify caller-side introspection orchestration against the
 *        aws lambda runtime error surface; the harness runs the REAL
 *        genLambdaEndpoint handlers and only fakes the sdk transport (send), so
 *        behavior is exercised end-to-end without a deploy per case. a real
 *        lambda per permutation would make this fast contract suite slow and
 *        flaky.
 * .real = the positive round-trip and error contracts are verified against real
 *        deployed lambdas in blackbox/deployed.introspection.acceptance.test.ts
 *        and against real aws in
 *        src/domain.operations/getOneLambdaContract/getOneLambdaContract.integration.test.ts
 *        and getAllLambdaContracts/getAllLambdaContracts.integration.test.ts
 */

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

describe('introspection', () => {
  given('[case1] contract discovery exports', () => {
    when('[t0] imports evaluated', () => {
      then('genIntrospectionMiddleware should be callable', () => {
        expect(typeof genIntrospectionMiddleware).toBe('function');
      });

      then('getAllLambdaContracts should be callable', () => {
        expect(typeof getAllLambdaContracts).toBe('function');
      });

      then('getAllLambdaFunctionsByPrefix should be callable', () => {
        expect(typeof getAllLambdaFunctionsByPrefix).toBe('function');
      });

      then('getOneLambdaContract should be callable', () => {
        expect(typeof getOneLambdaContract).toBe('function');
      });
    });
  });

  given('[case2] genLambdaEndpoint with introspection in prep env', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async ({ event }) => ({
          salute: `Hello, ${event.name}!`,
        }),
      },
      { env: { access: 'prep' } },
    );

    when('[t0] invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () =>
        invokeHandlerForTest(handler, {
          event: { introspect: 'schema' } as any,
        }),
      ) as unknown as LambdaEndpointSchema;

      then('returns input schema', () => {
        expect(result.input).toBeDefined();
        expect(result.input.type).toBe('object');
        expect(result.input.properties).toHaveProperty('name');
      });

      then('returns output schema', () => {
        expect(result.output).toBeDefined();
        expect(result.output.type).toBe('object');
        expect(result.output.properties).toHaveProperty('salute');
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result.input).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });

    when('[t1] invoked with normal payload', () => {
      const result = useThen('handler processes request', async () =>
        invokeHandlerForTest(handler, { event: { name: 'World' } }),
      );

      then('returns salute', () => {
        expect(result.salute).toBe('Hello, World!');
      });
    });
  });

  given('[case3] genLambdaEndpoint with introspection in prod env (ancient caller)', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async ({ event }) => ({
          salute: `Hello, ${event.name}!`,
        }),
      },
      { env: { access: 'prod' } },
    );

    when('[t0] invoked with introspect payload (flat/ancient format)', () => {
      // note: ConstraintError is returned as response, not thrown
      //       per invariant.badrequesterror-not-lambda-error
      // note: ancient callers receive BadRequestError for backwards compat
      const result = useThen('handler returns error response', async () =>
        handler({ introspect: 'schema' } as any, mockContext),
      );

      then('response contains constraint error message', () => {
        expect(result).toHaveProperty('errorMessage');
        expect((result as any).errorMessage).toContain(
          'introspection is only available in prep environment',
        );
      });

      then('response has BadRequestError for ancient caller compat', () => {
        expect((result as any).errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result).toHaveProperty('errorMessage');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case3b] genLambdaEndpoint with introspection in prod env (contemp caller)', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async ({ event }) => ({
          salute: `Hello, ${event.name}!`,
        }),
      },
      { env: { access: 'prod' } },
    );

    when('[t0] invoked with introspect payload (wrapped/contemp format)', () => {
      // contemp callers send { event, trail } wrapper
      // they should receive ConstraintError (not BadRequestError)
      const result = useThen('handler returns error response', async () =>
        handler(
          { event: { introspect: 'schema' }, trail: { exid: 'test-exid' } } as any,
          mockContext,
        ),
      );

      then('response contains constraint error message', () => {
        expect(result).toHaveProperty('error');
        expect((result as any).error.message).toContain(
          'introspection is only available in prep environment',
        );
      });

      then('response has ConstraintError for contemp caller', () => {
        expect((result as any).error.class).toBe('ConstraintError');
      });

      then('result matches snapshot', () => {
        expect(result).toHaveProperty('error');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case4] genLambdaEndpoint without env config (ancient caller)', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      // no env config
      invoke: async ({ event }) => ({
        salute: `Hello, ${event.name}!`,
      }),
    });

    when('[t0] invoked with introspect payload (flat/ancient format)', () => {
      // note: ConstraintError is returned as response, not thrown
      //       per invariant.badrequesterror-not-lambda-error
      // note: ancient callers receive BadRequestError for backwards compat
      const result = useThen('handler returns error response', async () =>
        handler({ introspect: 'schema' } as any, mockContext),
      );

      then('response contains env not provided message', () => {
        expect(result).toHaveProperty('errorMessage');
        expect((result as any).errorMessage).toContain('env was not provided');
      });

      then('response has BadRequestError for ancient caller compat', () => {
        expect((result as any).errorType).toBe('BadRequestError');
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result).toHaveProperty('errorMessage');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case4b] genLambdaEndpoint without env config (contemp caller)', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint({
      schema,
      // no env config
      invoke: async ({ event }) => ({
        salute: `Hello, ${event.name}!`,
      }),
    });

    when('[t0] invoked with introspect payload (wrapped/contemp format)', () => {
      // contemp callers send { event, trail } wrapper
      // they should receive ConstraintError (not BadRequestError)
      const result = useThen('handler returns error response', async () =>
        handler(
          { event: { introspect: 'schema' }, trail: { exid: 'test-exid' } } as any,
          mockContext,
        ),
      );

      then('response contains env not provided message', () => {
        expect(result).toHaveProperty('error');
        expect((result as any).error.message).toContain('env was not provided');
      });

      then('response has ConstraintError for contemp caller', () => {
        expect((result as any).error.class).toBe('ConstraintError');
      });

      then('result matches snapshot', () => {
        expect(result).toHaveProperty('error');
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case5] forApiGateway with introspection in prep env', () => {
    const schema = {
      input: z.object({ data: z.string() }),
      output: z.object({ success: z.boolean() }),
    };

    const handler = forApiGateway(
      {
        schema,
        invoke: async () => ({ success: true }),
      },
      { env: { access: 'prep' } },
    );

    when('[t0] invoked with introspect payload', () => {
      const mockEvent = {
        httpMethod: 'POST',
        path: '/test',
        body: JSON.stringify({ introspect: 'schema' }),
        headers: { 'Content-Type': 'application/json' },
        queryStringParameters: null,
        pathParameters: null,
        requestContext: { requestId: 'req-123' },
      };

      const result = useThen('handler returns API Gateway response', async () =>
        handler(mockEvent as any, mockContext),
      );

      then('returns 200 status', () => {
        expect(result.statusCode).toBe(200);
      });

      then('body contains schema', () => {
        const body = JSON.parse(result.body);
        expect(body.input).toBeDefined();
        expect(body.output).toBeDefined();
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result.statusCode).toBe(200);
        expect(JSON.parse(result.body).input).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case6] introspection with complex schema', () => {
    const schema = {
      input: z.object({
        user: z.object({
          id: z.string().uuid(),
          email: z.string().email(),
          roles: z.array(z.enum(['admin', 'user', 'guest'])),
        }),
        options: z
          .object({
            verbose: z.boolean().optional(),
            limit: z.number().int().min(1).max(100).default(10),
          })
          .optional(),
      }),
      output: z.object({
        result: z.discriminatedUnion('status', [
          z.object({
            status: z.literal('success'),
            data: z.array(z.string()),
          }),
          z.object({
            status: z.literal('error'),
            message: z.string(),
          }),
        ]),
      }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async () => ({
          result: { status: 'success' as const, data: ['item1'] },
        }),
      },
      { env: { access: 'prep' } },
    );

    when('[t0] invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () =>
        invokeHandlerForTest(handler, {
          event: { introspect: 'schema' } as any,
        }),
      ) as unknown as LambdaEndpointSchema;

      then('input schema captures nested structure', () => {
        const input = result.input as any;
        expect(input.properties.user).toBeDefined();
        expect(input.properties.user.properties.email).toBeDefined();
        expect(input.properties.user.properties.roles).toBeDefined();
      });

      then('output schema captures discriminated union', () => {
        const output = result.output as any;
        expect(output.properties.result).toBeDefined();
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result.input).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case7] introspection with async env config', () => {
    const schema = {
      input: z.object({ name: z.string() }),
      output: z.object({ salute: z.string() }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async ({ event }) => ({
          salute: `Hello, ${event.name}!`,
        }),
      },
      { env: async () => ({ access: 'prep' as const }) },
    );

    when('[t0] invoked with introspect payload', () => {
      const result = useThen('handler returns schema', async () =>
        invokeHandlerForTest(handler, {
          event: { introspect: 'schema' } as any,
        }),
      ) as unknown as LambdaEndpointSchema;

      then('returns input schema', () => {
        expect(result.input).toBeDefined();
      });

      then('returns output schema', () => {
        expect(result.output).toBeDefined();
      });

      then('result matches snapshot', () => {
        // explicit assertion ensures shape check before snapshot
        expect(result.input).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case8] getOneLambdaContract via in-process harness', () => {
    // note: harness parses function name as {service}-{access}-{function}
    //       service follows svc-$noun pattern: svc-user-prep-getUser
    const schema = {
      input: z.object({
        userId: z.string().uuid(),
        include: z.array(z.enum(['profile', 'settings'])).optional(),
      }),
      output: z.object({
        user: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().email(),
        }),
        metadata: z.object({
          fetchedAt: z.string(),
        }),
      }),
    };

    const handler = genLambdaEndpoint(
      {
        schema,
        invoke: async ({ event }) => ({
          user: {
            id: event.userId,
            name: 'Test User',
            email: 'test@example.com',
          },
          metadata: { fetchedAt: '2026-06-24T12:00:00.000Z' },
        }),
      },
      { env: { access: 'prep' } },
    );

    // harness routes function calls to registered handlers
    // key format: service -> function (harness parses {service}-{access}-{function})
    const { mockSend } = createInProcessLambdaHarness({
      'svc-user': { getUser: handler },
    });

    // create mock lambda sdk that uses harness
    const mockSdkLambda = { send: mockSend } as unknown as LambdaClient;

    when('[t0] getOneLambdaContract is called', () => {
      const result = useThen('returns schema', async () =>
        getOneLambdaContract(
          { which: { service: 'svc-user', function: 'getUser' } },
          {
            log,
            env: { access: 'prep' },
            aws: { lambda: { sdk: mockSdkLambda } },
          },
        ),
      );

      then('input schema has expected structure', () => {
        expect(result.input).toBeDefined();
        expect((result.input as any).properties).toHaveProperty('userId');
        expect((result.input as any).properties).toHaveProperty('include');
      });

      then('output schema has expected structure', () => {
        expect(result.output).toBeDefined();
        expect((result.output as any).properties).toHaveProperty('user');
        expect((result.output as any).properties).toHaveProperty('metadata');
      });

      then('result matches snapshot', () => {
        // explicit assertions before snapshot
        expect(result.input).toBeDefined();
        expect(result.output).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case9] getOneLambdaContract when introspection blocked in prod env', () => {
    // handler in prod env blocks introspection
    const handler = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ name: z.string() }),
          output: z.object({ salute: z.string() }),
        },
        invoke: async ({ event }) => ({
          salute: `Hello, ${event.name}!`,
        }),
      },
      { env: { access: 'prod' } },
    );

    // note: harness parses function name as {service}-{access}-{function}
    //       service follows svc-$noun pattern: svc-salute-prod-sayHello
    const { mockSend } = createInProcessLambdaHarness({
      'svc-salute': { sayHello: handler },
    });

    const mockSdkLambda = { send: mockSend } as unknown as LambdaClient;

    when('[t0] getOneLambdaContract is called', () => {
      // note: useThen stores a shallow copy of its result (enumerable own props
      //       only), so capture a plain summary instead of the Error instance —
      //       otherwise instanceof and .message are lost across then blocks
      const caught = useThen('throws LambdaIntrospectionBlockedError', async () => {
        const error = await getError(
          getOneLambdaContract(
            { which: { service: 'svc-salute', function: 'sayHello' } },
            {
              log,
              env: { access: 'prod' },
              aws: { lambda: { sdk: mockSdkLambda } },
            },
          ),
        );
        return {
          isExpectedType: error instanceof LambdaIntrospectionBlockedError,
          message: error instanceof Error ? error.message : String(error),
        };
      });

      then('error is LambdaIntrospectionBlockedError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error message indicates prod access', () => {
        expect(caught.message).toContain('prod');
      });
    });
  });

  given('[case10] getOneLambdaContract when function not found', () => {
    // note: harness parses function name as {service}-{access}-{function}
    //       service follows svc-$noun pattern
    const { mockSend } = createInProcessLambdaHarness({});

    const mockSdkLambda = { send: mockSend } as unknown as LambdaClient;

    when('[t0] getOneLambdaContract is called for absent function', () => {
      // note: capture a plain summary (see case9 note on useThen shallow copy)
      const caught = useThen('throws LambdaFunctionNotFoundError', async () => {
        const error = await getError(
          getOneLambdaContract(
            { which: { service: 'svc-missed', function: 'noSuchFunction' } },
            {
              log,
              env: { access: 'prep' },
              aws: { lambda: { sdk: mockSdkLambda } },
            },
          ),
        );
        return {
          isExpectedType: error instanceof LambdaFunctionNotFoundError,
          message: error instanceof Error ? error.message : String(error),
        };
      });

      then('error is LambdaFunctionNotFoundError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error message names the function', () => {
        expect(caught.message).toContain('svc-missed-prep-noSuchFunction');
      });
    });
  });

  given('[case11] getAllLambdaContracts via in-process harness', () => {
    const userSchema = {
      input: z.object({ userId: z.string() }),
      output: z.object({ name: z.string(), email: z.string() }),
    };

    const settingsSchema = {
      input: z.object({ userId: z.string() }),
      output: z.object({ theme: z.enum(['light', 'dark']), language: z.string() }),
    };

    const getUserHandler = genLambdaEndpoint(
      {
        schema: userSchema,
        invoke: async () => ({ name: 'Test', email: 'test@example.com' }),
      },
      { env: { access: 'prep' } },
    );

    const getSettingsHandler = genLambdaEndpoint(
      {
        schema: settingsSchema,
        invoke: async () => ({ theme: 'dark' as const, language: 'en' }),
      },
      { env: { access: 'prep' } },
    );

    // note: harness parses function name as {service}-{access}-{function}
    //       service follows svc-$noun pattern: svc-user-prep-getUser
    const { mockSend } = createInProcessLambdaHarness({
      'svc-user': {
        getUser: getUserHandler,
        getSettings: getSettingsHandler,
      },
    });

    /**
     * .mock = ListFunctionsCommand response
     *   .rule = rule.forbid.acceptance.mocks
     * .why = getAllLambdaContracts calls ListFunctions to discover lambdas;
     *        real AWS would return these function names; the fake returns a fixed
     *        set so the bare-name keying can be verified deterministically in-process
     * .real = verified against real deployed lambdas in
     *        blackbox/deployed.introspection.acceptance.test.ts
     */
    const mockSdkLambda = {
      send: jest.fn().mockImplementation(async (command) => {
        // handle ListFunctionsCommand
        if (command.constructor.name === 'ListFunctionsCommand') {
          return {
            Functions: [
              { FunctionName: 'svc-user-prep-getUser' },
              { FunctionName: 'svc-user-prep-getSettings' },
            ],
            NextMarker: undefined,
          };
        }
        // delegate invoke to harness
        return mockSend(command);
      }),
    } as unknown as LambdaClient;

    when('[t0] getAllLambdaContracts is called', () => {
      const result = useThen('returns contracts', async () =>
        getAllLambdaContracts(
          { which: { service: 'svc-user' } },
          {
            log,
            env: { access: 'prep' },
            aws: { lambda: { sdk: mockSdkLambda } },
          },
        ),
      );

      then('result is a record', () => {
        expect(typeof result).toBe('object');
        expect(result).not.toBeNull();
      });

      then('keys are bare function names (not full names)', () => {
        const keys = Object.keys(result);
        // vision: keys should be 'getUser', 'getSettings' not 'svc-user-prep-getUser'
        expect(keys).toContain('getUser');
        expect(keys).toContain('getSettings');
        // full names should not appear
        expect(keys).not.toContain('svc-user-prep-getUser');
      });

      then('contracts have expected schema structure', () => {
        const getUserContract = result['getUser'];
        expect(getUserContract).toBeDefined();
        expect(getUserContract?.input).toBeDefined();
        expect(getUserContract?.output).toBeDefined();
        expect((getUserContract?.input as any).properties).toHaveProperty(
          'userId',
        );
      });

      then('result matches snapshot', () => {
        // explicit assertions before snapshot
        expect(Object.keys(result).length).toBe(2);
        expect(result['getUser']).toBeDefined();
        expect(result['getSettings']).toBeDefined();
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case12] getAllLambdaContracts is all-or-none', () => {
    // a service where one function does not support introspection: the whole
    // batch must fail loud rather than return a partial contract set
    const getUserHandler = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ userId: z.string() }),
          output: z.object({ name: z.string() }),
        },
        invoke: async () => ({ name: 'Test' }),
      },
      { env: { access: 'prep' } },
    );

    // handler gated to prod: not introspectable when queried in prep
    const prodOnlyHandler = genLambdaEndpoint(
      {
        schema: {
          input: z.object({ x: z.number() }),
          output: z.object({ y: z.number() }),
        },
        invoke: async () => ({ y: 42 }),
      },
      { env: { access: 'prod' } },
    );

    const { mockSend } = createInProcessLambdaHarness({
      'svc-user': {
        getUser: getUserHandler,
        prodOnly: prodOnlyHandler,
      },
    });

    /**
     * .mock = ListFunctionsCommand response
     *   .rule = rule.forbid.acceptance.mocks
     * .why = discovery of the service's functions; the fake lists both so the
     *        all-or-none failure can be verified deterministically in-process
     * .real = verified against real deployed lambdas in
     *        blackbox/deployed.introspection.acceptance.test.ts
     */
    const mockSdkLambda = {
      send: jest.fn().mockImplementation(async (command) => {
        if (command.constructor.name === 'ListFunctionsCommand') {
          return {
            Functions: [
              { FunctionName: 'svc-user-prep-getUser' },
              { FunctionName: 'svc-user-prep-prodOnly' },
            ],
            NextMarker: undefined,
          };
        }
        return mockSend(command);
      }),
    } as unknown as LambdaClient;

    when('[t0] one function does not support introspection', () => {
      // capture a plain summary (useThen stores enumerable own props only)
      const caught = useThen(
        'throws LambdaIntrospectionNotSupportedError',
        async () => {
          const error = await getError(
            getAllLambdaContracts(
              { which: { service: 'svc-user' } },
              {
                log,
                env: { access: 'prep' },
                aws: { lambda: { sdk: mockSdkLambda } },
              },
            ),
          );
          return {
            isExpectedType:
              error instanceof LambdaIntrospectionNotSupportedError,
            message: error instanceof Error ? error.message : String(error),
          };
        },
      );

      then('error is LambdaIntrospectionNotSupportedError', () => {
        expect(caught.isExpectedType).toBe(true);
      });

      then('error names the offending function', () => {
        expect(caught.message).toContain('svc-user-prep-prodOnly');
      });
    });
  });
});

