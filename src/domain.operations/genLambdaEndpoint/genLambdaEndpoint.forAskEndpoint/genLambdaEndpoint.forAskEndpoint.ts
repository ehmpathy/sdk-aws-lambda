import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import { asContextLogTrail } from '../asContextLogTrail';
import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIntrospectionMiddleware } from '../middleware/genIntrospectionMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import type { TranslateLog } from '../TranslateLog';
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
  logTranslate?: TranslateLog;
};

/**
 * .what = sdk contract type for genLambdaEndpoint context
 * .why = exported for consumer type inference; the shared handler-side context
 *        ({ env?: EnvConfig; log? }) reused by genLambdaEndpoint + forApiGateway
 */
export type GenLambdaEndpointContext = ContextAwsLambdaServer;

/**
 * .what = generates a lambda handler with validation and trail context
 * .why = standardizes handler creation with schema validation and observability. the chain:
 *        constraint error (a caller fault becomes a response object, never a throw), internal
 *        service error (logs loudly), io logger, trail, input + output validation
 */
export const genLambdaEndpoint = <TInput, TOutput>(
  // typed by the EXPORTED contract rather than an inline restatement — the two were hand-synced
  // before, and a rename that reached only one of them would have compiled
  input: GenLambdaEndpointInput<TInput, TOutput>,
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
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

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
    /**
     * .note = this family's response IS its payload, so a caller fault renders as the body
     *         itself — and a SERVER fault is declined (`false`), which lets the invocation FAIL
     *         so cloudwatch records it and the caller may retry
     */
    genConstraintErrorMiddleware({ asOutputAfter: (body) => body }),
    genInternalServiceErrorMiddleware({ asOutputAfter: false }),
    genTrailMiddleware(),
    genIoLoggerMiddleware({ logTranslate: input.logTranslate }),
    genIntrospectionMiddleware({
      schema: input.schema,
      env: context?.env,
      // this family carries `inputAfter` at `event` itself, and its response IS its payload
      asInputAfter: (request) => request.event,
      asOutputAfter: (schema) => schema,
    }),
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
