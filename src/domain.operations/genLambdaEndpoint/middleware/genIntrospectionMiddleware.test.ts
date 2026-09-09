import { ConstraintError, getError } from 'helpful-errors';
import { given, then, useThen, when } from 'test-fns';
import { z } from 'zod';

import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { genIntrospectionMiddleware } from './genIntrospectionMiddleware';

describe('genIntrospectionMiddleware', () => {
  const inputSchema = z.object({ customerId: z.string() });
  const outputSchema = z.object({ name: z.string(), balance: z.number() });

  /**
   * .what = the two reader/writer pairs this middleware can be handed
   * .why = the middleware no longer knows which families exist — it reads `inputAfter` and
   *        renders `outputAfter` through whatever it is given. so this suite covers the two
   *        SHAPES, and deliberately does not claim to mirror the real call sites: that would
   *        put one guarantee in two places (rule.forbid.parallel-codepaths). each family's own
   *        suite proves its real chain end-to-end
   */
  const atEvent = {
    asInputAfter: (request: any) => request.event,
    asOutputAfter: (schema: LambdaEndpointSchema) => schema,
  };
  const atEventBody = {
    asInputAfter: (request: any) => request.event?.body,
    asOutputAfter: (schema: LambdaEndpointSchema) => ({
      statusCode: 200,
      body: JSON.stringify(schema),
      headers: { 'Content-Type': 'application/json' },
    }),
  };

  describe('forAskEndpoint (standard lambda)', () => {
    given('[case1] introspection request in prep env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prep' },
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        const request = useThen('middleware executes', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined as unknown,
          };
          await middleware.before(req as any);
          return req;
        });

        then('response contains schema', () => {
          expect(request.response).toBeDefined();
          const schema = request.response as {
            input: unknown;
            output: unknown;
          };
          expect(schema.input).toBeDefined();
          expect(schema.output).toBeDefined();
        });

        then('input schema has expected structure', () => {
          const schema = request.response as {
            input: { type: string; properties: Record<string, unknown> };
          };
          expect(schema.input.type).toBe('object');
          expect(schema.input.properties.customerId).toBeDefined();
        });

        then('output schema has expected structure', () => {
          const schema = request.response as {
            output: { type: string; properties: Record<string, unknown> };
          };
          expect(schema.output.type).toBe('object');
          expect(schema.output.properties.name).toBeDefined();
          expect(schema.output.properties.balance).toBeDefined();
        });
      });
    });

    given('[case2] introspection request in prod env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prod' },
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        then('throws ConstraintError', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined,
          };
          await expect(middleware.before(req as any)).rejects.toThrow(
            ConstraintError,
          );
        });

        then('error message mentions environment', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined,
          };
          try {
            await middleware.before(req as any);
          } catch (error) {
            expect((error as Error).message).toContain('prep');
            expect((error as Error).message).toContain('prod');
          }
        });
      });
    });

    given('[case3] introspection request in test env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'test' },
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        then('throws ConstraintError', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined,
          };
          await expect(middleware.before(req as any)).rejects.toThrow(
            ConstraintError,
          );
        });
      });
    });

    given('[case4] introspection request without env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        // no env provided
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        then('throws ConstraintError about env', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined,
          };
          await expect(middleware.before(req as any)).rejects.toThrow(
            ConstraintError,
          );
          try {
            await middleware.before(req as any);
          } catch (error) {
            expect((error as Error).message).toContain('env');
          }
        });
      });
    });

    given('[case5] normal request (not introspection)', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prep' },
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        then('passes through with response unset', async () => {
          const req = {
            event: { customerId: '123' },
            context: {},
            response: undefined,
          };
          await middleware.before(req as any);
          expect(req.response).toBeUndefined();
        });
      });
    });
  });

  describe('forApiGateway', () => {
    given('[case1] introspection request in prep env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prep' },
        ...atEventBody,
      });

      when('[t0] before middleware runs', () => {
        const request = useThen('middleware executes', async () => {
          const req = {
            event: { body: { introspect: 'schema' } },
            context: {},
            response: undefined as unknown,
          };
          await middleware.before(req as any);
          return req;
        });

        then('response is HTTP format with 200', () => {
          const response = request.response as {
            statusCode: number;
            body: string;
          };
          expect(response.statusCode).toBe(200);
        });

        then('body contains schema as JSON string', () => {
          const response = request.response as { body: string };
          const schema = JSON.parse(response.body);
          expect(schema.input).toBeDefined();
          expect(schema.output).toBeDefined();
        });
      });
    });

    given('[case2] introspection request in prod env', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prod' },
        ...atEventBody,
      });

      when('[t0] before middleware runs', () => {
        then('throws ConstraintError', async () => {
          const req = {
            event: { body: { introspect: 'schema' } },
            context: {},
            response: undefined as unknown,
          };
          const error = await getError(middleware.before(req as any));
          expect(error).toBeInstanceOf(ConstraintError);
        });

        then('error message mentions environment', async () => {
          const req = {
            event: { body: { introspect: 'schema' } },
            context: {},
            response: undefined as unknown,
          };
          const error = await getError(middleware.before(req as any));
          expect(error.message).toContain('prep');
        });
      });
    });

    given('[case3] normal request (not introspection)', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: { access: 'prep' },
        ...atEventBody,
      });

      when('[t0] before middleware runs', () => {
        then('passes through with response unset', async () => {
          const req = {
            event: { body: { orderId: '456' } },
            context: {},
            response: undefined,
          };
          await middleware.before(req as any);
          expect(req.response).toBeUndefined();
        });
      });
    });
  });

  describe('async env function', () => {
    given('[case1] env provided as async function', () => {
      const middleware = genIntrospectionMiddleware({
        schema: { input: inputSchema, output: outputSchema },
        env: async () => ({ access: 'prep' }),
        ...atEvent,
      });

      when('[t0] before middleware runs', () => {
        then('extracts env and returns schema', async () => {
          const req = {
            event: { introspect: 'schema' },
            context: {},
            response: undefined as unknown,
          };
          await middleware.before(req as any);
          expect(req.response).toBeDefined();
          const schema = req.response as { input: unknown; output: unknown };
          expect(schema.input).toBeDefined();
        });
      });
    });
  });
});
