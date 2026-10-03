import middy from '@middy/core';
import type { Context } from 'aws-lambda';
import type { ContextLogTrail } from 'sdk-logs';
import type { FrozenDeep } from 'type-fns';
import type { ZodSchema } from 'zod';

import type { ContextAwsLambdaServer } from '../../../domain.objects/ContextAwsLambdaServer';
import type { WrappedPayload } from '../../lambdaEndpointWire/frame/getIsWrappedPayload';
import { asContextLogTrail } from '../asContextLogTrail';
import { genConstraintErrorMiddleware } from '../middleware/genConstraintErrorMiddleware';
import { genInternalServiceErrorMiddleware } from '../middleware/genInternalServiceErrorMiddleware';
import { genIntrospectionMiddleware } from '../middleware/genIntrospectionMiddleware';
import { genIoLoggerMiddleware } from '../middleware/genIoLoggerMiddleware';
import { genTrailMiddleware } from '../middleware/genTrailMiddleware';
import { getValidatedOutput } from '../middleware/getValidatedOutput';
import { setEventFrozen } from '../setEventFrozen';
import type { TranslateLog } from '../TranslateLog';
import { genAskEventOnwireCaptureMiddleware } from './middleware/genAskEventOnwireCaptureMiddleware';
import { genZodEventValidationMiddleware } from './middleware/genZodEventValidationMiddleware';

/**
 * .what = wrapped payload format: event nested under `event` key with trail
 * .why = re-exported from its canonical owner (`lambdaEndpointWire/frame`), the common
 *        ancestor of the three contexts that touch the frame — askLambdaEndpoint and
 *        runLambdaEndpoint/serde emit it, getUnwrappedEventWithExid reads it. one
 *        declaration, never a structural twin (`rule.prefer.most-common-denominator`)
 */
export type { WrappedPayload };

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
 * .what = a direct invoke as it arrived on the wire — wrapped with a trail, or flat
 */
export type AskEventOnwire = LambdaHandlerInput<unknown>;

/**
 * .what = a direct invoke with its two arrival formats reconciled
 * .why = `askLambdaEndpoint` sends `{ event, trail }` and a manual invoke sends the value flat;
 *        a handler that reads either is format-locked. `Unified` names that reconciliation, as it
 *        names the v1/v2 one at api gateway. the raw arrival is at `_.raw`
 *
 * .note = the envelope's body slot is `payload`, as in every family, so `payload ===
 *         event.payload` holds here too (`domain.terms/payload.md`). the trail rides
 *         `context.log.trail`, never this envelope (`domain.terms/trail.md`)
 */
export interface AskEventUnified<TPayload> {
  /**
   * .what = the body — validated against `schema.input` by the time `invoke` runs
   */
  payload: TPayload;

  /**
   * .what = the ejection route — the invoke exactly as it arrived, trail wrapper included
   */
  _: { raw: AskEventOnwire };
}

/**
 * .what = endpoint operation signature type
 * .why = named type for the invoke function
 */
export type EndpointOperation<TInput, TOutput> = (
  input: {
    /**
     * .what = the body, parsed and validated — the value the handler was written to act on
     * .note = the same object as `event.payload`, never a copy
     */
    payload: FrozenDeep<TInput>;

    /**
     * .what = the whole object that arrived, reconciled (`domain.terms/event.md`)
     * .why frozen = every family freezes what it hands `invoke`
     *        (`rule.require.frozen-invoke-inputs`)
     */
    event: FrozenDeep<AskEventUnified<TInput>>;
  },
  context: ContextLogTrail,
) => Promise<TOutput>;

/**
 * .what = sdk contract type for genLambdaEndpoint input
 * .why = exported for consumer type inference
 *
 * ⚠️ .why `TInputBefore` exists = a zod schema is a CODEC, so it holds two faces, and they
 *         differ the moment a `.transform()` or an `X.contract()` sits in it. `ZodSchema<T>`
 *         is `ZodType<Output, Input>` with `Input` left at `unknown` — so one parameter named
 *         only the face the HANDLER sees, and the face the CALLER sends had no name at all
 *
 *   - `TInput`        = `inputAfter`  — what `invoke` receives. an `X.contract()` position
 *                                       yields `WithImmute<Surfer>` here
 *   - `TInputBefore`  = the WIRE face — what a caller puts on the wire. the same position
 *                                       yields the plain `Surfer` shape here
 *
 *   ⇒ this is the TYPE-side twin of the `{ io: 'input' }` publish repair: both say the wire
 *     face is what crosses the border, and both were wrong in the same direction before.
 *     measured — a `[case11]` payload of plain objects failed to compile against a schema
 *     with three `X.contract()` positions, because the handler's own parameter demanded the
 *     instance face it is the codec's job to PRODUCE
 *
 * .note = it defaults to `TInput`, so every schema with no codec in it binds both to one type
 *         and no extant consumer sees a change (rule.require.retest-the-model-on-every-family
 *         — the pair collapses per-consumer here, which that rule names as the legitimate case)
 *
 * .note = the names trace to this repo's extant position vocabulary — `inputBefore` /
 *         `inputAfter` (rule.prefer.names-by-position-over-claim)
 */
export type GenLambdaEndpointInput<TInput, TOutput, TInputBefore = TInput> = {
  schema: {
    input: ZodSchema<TInput, TInputBefore>;
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
 * .what = generates a lambda handler with validation and trail context, for a DIRECT invoke
 * .why = standardizes handler creation with schema validation and observability. the chain:
 *        constraint error (a caller fault becomes a response object, never a throw), internal
 *        service error (logs loudly), io logger, trail, input + output validation
 *
 * .note = this is a leaf of the `genLambdaEndpoint` family, and it is exported under its own
 *         variant name only. it is never re-exported bare from `src/index.ts` — a caller
 *         reaches it as `genLambdaEndpoint.forAsk` (`rule.forbid.unqualified-variant-exports`)
 */
export const forAsk = <TInput, TOutput, TInputBefore = TInput>(
  // typed by the exported contract rather than an inline restatement, so the two cannot drift
  input: GenLambdaEndpointInput<TInput, TOutput, TInputBefore>,
  context?: ContextAwsLambdaServer,
): middy.MiddyfiedHandler<
  // the returned handler takes the WIRE face — that is what a caller puts on the wire, and
  // what aws hands us. `invoke` takes `TInput`; the codec between them is the whole point
  LambdaHandlerInput<TInputBefore>,
  TOutput,
  Error,
  Context
> => {
  // build logic that invokes user handler and validates output
  const logic = async (
    event: AskEventUnified<TInput>,
    lambdaContext: Context,
  ): Promise<TOutput> => {
    // read the trail log `genTrailMiddleware` wrote; the cast lives in the shared reader
    const { log } = asContextLogTrail({ context: lambdaContext });

    /**
     * .what = seals the envelope before the handler's turn
     * .where = after the validator, which has already written the envelope into `request.event`,
     *          so what freezes IS what the handler reads
     * .why = every family freezes, through this one shared helper
     *        (`rule.require.frozen-invoke-inputs`)
     */
    const eventFrozen = setEventFrozen({ event });

    // invoke user handler; `payload` is the envelope's own slot, so the two stay one object
    const response = await input.invoke(
      { payload: eventFrozen.payload, event: eventFrozen },
      { log },
    );

    // validate output and return typed result
    return getValidatedOutput({ response, schema: input.schema.output });
  };

  // middleware order matters:
  // 1. error handlers (onError) - must be first to catch errors from all other middleware
  // 2. onwire capture (onBefore) - keeps the raw invoke, before trail unwraps it
  // 3. trail (onBefore) - injects trail context (must be early so isContempCaller is set for error handlers)
  // 4. io logger - logs input/output for debug
  // 5. introspection (onBefore) - intercepts introspect requests, returns schema
  // 6. validation (onBefore) - validates the body, then writes the envelope into `request.event`
  const middlewares = [
    /**
     * .note = this family's response IS its payload, so a caller fault renders as the body
     *         itself — and a SERVER fault is declined (`false`), which lets the invocation FAIL
     *         so cloudwatch records it and the caller may retry
     */
    genConstraintErrorMiddleware({ asOutputAfter: (body) => body }),
    genInternalServiceErrorMiddleware({ asOutputAfter: false }),
    genAskEventOnwireCaptureMiddleware(),
    genTrailMiddleware(),
    genIoLoggerMiddleware({ logTranslate: input.logTranslate }),
    genIntrospectionMiddleware({
      schema: input.schema,
      env: context?.env,
      // introspection runs before validation, so `request.event` still holds the bare body here
      asInputAfter: (request) => request.event,
      asOutputAfter: (schema) => schema,
    }),
    genZodEventValidationMiddleware({ schema: input.schema.input }),
  ];

  /**
   * .as = assertion needed because middleware transforms LambdaHandlerInput<TInputBefore> into
   *       AskEventUnified<TInput> before logic runs — it unwraps the frame, runs the codec, and
   *       builds the envelope — but typescript cannot track that through middy
   * .removal = if middy gains typed middleware inference, remove cast
   */
  return middy(
    logic as unknown as (
      event: LambdaHandlerInput<TInputBefore>,
      context: Context,
    ) => Promise<TOutput>,
  ).use(middlewares);
};
