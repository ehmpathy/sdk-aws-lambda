import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIntrospectionMiddleware } from '../middleware/genIntrospectionMiddleware';
import type { IoLogTranslate } from '../middleware/genIoLoggerMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import { genZodEventValidationMiddleware } from './middleware/genZodEventValidationMiddleware';

/**
 * .what = wrapped payload format: event nested under `event` key with trail
 * .why = askLambdaEndpoint sends this format for trail propagation
 */
export type WrappedPayload<TInput> = {
  event: TInput;
  trail: { exid?: string };
};

/**
 * .what = flat payload format: trail mixed into input
 * .why = direct invocation or legacy callers may send this format
 */
export type FlatPayload<TInput> = TInput & { trail?: { exid?: string } | null };

/**
 * .what = union of all valid lambda handler input formats
 * .why = handler accepts both wrapped and flat formats at runtime
 */
export type LambdaHandlerInput<TInput> =
  | FlatPayload<TInput>
  | WrappedPayload<TInput>;

/**
 * .what = endpoint operation signature type
 * .why = named type for invoke function (replaces HandlerLogic from simple-lambda-handlers)
 */
export type EndpointOperation<TInput, TOutput> = (
  input: { event: TInput },
  context: ContextLogTrail,
) => Promise<TOutput>;

/**
 * .what = sdk contract type for genLambdaEndpoint input
 * .why = exported for consumer type inference
 */
export type GenLambdaEndpointInput<TInput, TOutput> = {
  schema: {
    input: ZodSchema<TInput>;
    output: ZodSchema<TOutput>;
  };
  invoke: EndpointOperation<TInput, TOutput>;
  logTranslate?: IoLogTranslate;
};

/**
 * .what = sdk contract type for genLambdaEndpoint context
 * .why = exported for consumer type inference; the shared handler-side context
 *        ({ env?: EnvConfig; log? }) reused by genLambdaEndpoint + forApiGateway
 */
export type GenLambdaEndpointContext = ContextAwsLambdaServer;

/**
 * .what = generates a lambda handler with validation and trail context
 * .why = standardizes handler creation with schema validation and observability
 *
 * follows simple-lambda-handlers createStandardHandler pattern:
 * - uses middy middleware chain
 * - badRequestError middleware returns error object instead of throw
 * - internalServiceError middleware logs errors loudly
 * - ioLogger middleware logs input/output for debug
 * - validation middleware validates input against schema
 *
 * additions for sdk-aws-lambda:
 * - trail middleware injects log with trail context
 * - output validation via zod schema
 */
export const genLambdaEndpoint = <TInput, TOutput>(
  input: {
    schema: {
      input: ZodSchema<TInput>;
      output: ZodSchema<TOutput>;
    };
    invoke: EndpointOperation<TInput, TOutput>;
    logTranslate?: IoLogTranslate;
  },
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<
  LambdaHandlerInput<TInput>,
  TOutput,
  Error,
  Context
> => {
  // build logic that invokes user handler and validates output
  const logic = async (
    event: TInput,
    lambdaContext: Context,
  ): Promise<TOutput> => {
    // get log from lambda context (injected by trail middleware)
    const log = (lambdaContext as unknown as ContextLogTrail).log;

    // invoke user handler
    const response = await input.invoke({ event }, { log });

    // validate output and return typed result
    return getValidatedOutput({ response, schema: input.schema.output });
  };

  // middleware order matters:
  // 1. error handlers (onError) - must be first to catch errors from all other middleware
  // 2. trail (onBefore) - injects trail context (must be early so isContempCaller is set for error handlers)
  // 3. io logger - logs input/output for debug
  // 4. introspection (onBefore) - intercepts introspect requests, returns schema
  // 5. validation (onBefore) - validates event against schema
  const middlewares = [
    genConstraintErrorMiddleware(),
    genInternalServiceErrorMiddleware(),
    genTrailMiddleware(),
    genIoLoggerMiddleware({ logTranslate: input.logTranslate }),
    genIntrospectionMiddleware({ schema: input.schema, env: context?.env }),
    genZodEventValidationMiddleware({ schema: input.schema.input }),
  ];

  /**
   * .as = assertion needed because middleware transforms LambdaHandlerInput<TInput> to TInput
   *       before logic runs, but typescript cannot track this transformation through middy
   * .removal = if middy gains typed middleware inference, remove cast
   */
  return middy(
    logic as (
      event: LambdaHandlerInput<TInput>,
      context: Context,
    ) => Promise<TOutput>,
  ).use(middlewares);
};
