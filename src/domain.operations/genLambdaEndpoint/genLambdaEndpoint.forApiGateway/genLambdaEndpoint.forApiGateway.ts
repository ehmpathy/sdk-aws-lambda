import middy from '@middy/core';
import httpCors from '@middy/http-cors';
import httpResponseSerializer from '@middy/http-response-serializer';
import httpSecurityHeaders from '@middy/http-security-headers';
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Context,
} from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import type { IoLogTranslate } from '../middleware/genIoLoggerMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import {
  genApiGatewayEventNormalizationMiddleware,
  type UnifiedApiGatewayEvent,
} from './middleware/genApiGatewayEventNormalizationMiddleware';
import { genZodBodyValidationMiddleware } from './middleware/genZodBodyValidationMiddleware';

export interface CorsConfig {
  /**
   * .what = origins to accept for CORS
   * .why = sets Access-Control-Allow-Origin header
   *
   * special:
   * - '*' = accept all origins (browser will be told server expects requests from all origins)
   * - string[] = accept only listed origins (dynamic match against request origin)
   */
  origins: '*' | string[];

  /**
   * .what = whether to allow credentials (cookies) in cross-origin requests
   * .why = sets Access-Control-Allow-Credentials header
   *
   * note: if origins is '*' and credentials is true, the actual request origin
   * will be echoed (browsers don't allow '*' with credentials)
   */
  credentials: boolean;

  /**
   * .what = headers allowed in CORS requests
   * .why = sets Access-Control-Allow-Headers header
   *
   * defaults to 'content-type,authorization'
   */
  headers?: string;
}

/**
 * .what = input type for forApiGateway
 * .why = sdk contract type, exported for consumer type inference
 */
export type ForApiGatewayInput<TInput, TOutput> = {
  schema: {
    input: ZodSchema<TInput>;
    output: ZodSchema<TOutput>;
  };
  invoke: (
    input: { event: TInput; rawEvent: UnifiedApiGatewayEvent },
    context: ContextLogTrail,
  ) => Promise<TOutput>;
  logTranslate?: IoLogTranslate;
  cors?: CorsConfig;
  deserialize?: {
    /**
     * .what = whether to deserialize JSON body
     * .why = converts JSON string body to object when content-type is application/json
     *
     * defaults to true; set to false for raw string input
     */
    body: boolean;
  };
};

/**
 * .what = converts cors config to @middy/http-cors format
 * .why = simple-lambda-handlers pattern for cors configuration
 */
const corsInputToCorsConfig = (cors: CorsConfig) => {
  return {
    origin: cors.origins === '*' ? '*' : undefined,
    origins: Array.isArray(cors.origins) ? cors.origins : undefined,
    credentials: cors.credentials,
    headers: cors.headers ?? 'content-type,authorization',
    maxAge: undefined,
    cacheControl: undefined,
  };
};

const serializers = [
  {
    regex: /^application\/json$/,
    serializer: ({ body }: { body: unknown }) => JSON.stringify(body),
  },
];

/**
 * .what = generates API Gateway lambda handler with HTTP features
 * .why = adds CORS, security headers, error handler, body serialization, and validation
 *
 * follows simple-lambda-handlers createApiGatewayHandler pattern:
 * - uses middy middleware chain
 * - uses @middy/http-cors for dynamic origin match
 * - uses @middy/http-security-headers for OWASP security headers
 * - uses @middy/http-json-body-parser for JSON body parse
 * - uses @middy/http-response-serializer for response serialization
 */
export const forApiGateway = <TInput, TOutput>(config: {
  schema: {
    input: ZodSchema<TInput>;
    output: ZodSchema<TOutput>;
  };
  invoke: (
    input: { event: TInput; rawEvent: UnifiedApiGatewayEvent },
    context: ContextLogTrail,
  ) => Promise<TOutput>;
  logTranslate?: IoLogTranslate;
  cors?: CorsConfig;
  deserialize?: { body: boolean };
}): middy.MiddyfiedHandler<
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Error,
  Context
> => {
  const deserialize = config.deserialize ?? { body: true };

  // build logic wrapper that validates output and invokes user handler
  const logic = async (
    event: UnifiedApiGatewayEvent,
    context: Context,
  ): Promise<{
    statusCode: number;
    body?: TOutput;
  }> => {
    // get log from context (injected by trail middleware)
    const log = (context as unknown as ContextLogTrail).log;

    // invoke user handler with validated body and raw event
    const response = await config.invoke(
      { event: event.body as TInput, rawEvent: event },
      { log },
    );

    // validate output and return typed result
    const validatedOutput = getValidatedOutput({
      response,
      schema: config.schema.output,
    });

    return {
      statusCode: 200,
      body: validatedOutput,
    };
  };

  // middleware order matters:
  // 1. error handlers (onError) - must be first to catch errors from all other middleware
  // 2. io logger - logs input/output for debug
  // 3. response serializer (onAfter) - serializes response body to JSON
  // 4. cors (onAfter) - adds cors headers to response
  // 5. security headers (onAfter) - adds security headers to response
  // 6. event normalization (onBefore) - normalizes v1/v2 API Gateway events
  // 7. trail (onBefore) - injects trail context
  // 8. body validation (onBefore) - validates event.body against schema
  const middlewares = [
    genConstraintErrorMiddleware({ apiGateway: true }),
    genInternalServiceErrorMiddleware({ apiGateway: true }),
    genIoLoggerMiddleware({ logTranslate: config.logTranslate }),
    httpResponseSerializer({
      serializers,
      defaultContentType: 'application/json',
    }),
    ...(config.cors ? [httpCors(corsInputToCorsConfig(config.cors))] : []),
    httpSecurityHeaders({
      frameOptions: { action: 'DENY' },
    }),
    genApiGatewayEventNormalizationMiddleware({ parseBody: deserialize.body }),
    genTrailMiddleware(),
    genZodBodyValidationMiddleware({ schema: config.schema.input }),
  ];

  // note: type assertion needed because middleware transforms:
  // - input: APIGatewayProxyEvent -> UnifiedApiGatewayEvent (before logic)
  // - output: { statusCode, body } -> APIGatewayProxyResult (after logic)
  // TypeScript can't track these transformations through the middleware chain
  return middy(
    logic as unknown as (
      event: APIGatewayProxyEvent,
      context: Context,
    ) => Promise<APIGatewayProxyResult>,
  ).use(middlewares);
};
