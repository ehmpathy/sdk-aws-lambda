import type middy from '@middy/core';

import { getOneLambdaEventSchemaSource } from '../../../lambdaEndpointWire/frame/getOneLambdaEventSchemaSource';
import { asCallerFault } from '../../middleware/asCallerFault';
import { asContextTrailed } from '../../middleware/asContextTrailed';
import { logLambdaEventRefused } from './logLambdaEventRefused';

/**
 * .what = the key under which the unwrapped event rides in middy's `request.internal`
 * .why = one name, shared by the writer (`before`) and the reader (`onError`), so the two
 *        cannot drift
 */
const KEY_OF_ASK_EVENT_REFUSABLE = 'askEventRefusable';

/**
 * .what = logs `lambda.event.refused` at warn when an event-source endpoint answers a caller
 *         fault — a refusal by its `asLambdaEventSchema.*` schema, or one its handler throws
 * .why = `forAsk` answers every caller fault as a success, so aws drops the event: sns does not
 *        retry a success, and kinesis advances the shard, outside a tumble window. the warn line is the event's only
 *        trace, whichever step refused it
 *
 * .where = after `genTrailMiddleware`, so the log exists when `before` runs; ahead of the
 *          validator, so `before` keeps the unwrapped event the validator is about to replace
 *          with its envelope. its `onError` reads the log and the event back from there
 * .note = an endpoint whose input schema declares no source gets no step (null; middy refuses an
 *         empty one), so every other `forAsk` caller keeps its chain and its debug-only log
 *         exactly (F9). a direct caller reads the refusal in its own response
 * .note = it decides with `asCallerFault`, the same predicate `genConstraintErrorMiddleware`
 *         answers on, so no fault that drops the event can miss its line, and no fault aws
 *         retries gets one
 * .note = it sets no response: `genConstraintErrorMiddleware` still answers the fault. the line is
 *         a side effect beside that answer, never a replacement for it
 * .note = a throw from the log sink itself is a server fault, and it surfaces as one: aws then
 *         retries the event, so it is not lost (F15)
 */
export const genLambdaEventRefusedLogMiddleware = (input: {
  schema: unknown;
}): middy.MiddlewareObj<any, any> | null => {
  // an `asLambdaEventSchema.*` schema declares its source; any other schema declares none
  const source = getOneLambdaEventSchemaSource({ schema: input.schema });
  if (!source) return null;

  const before: middy.MiddlewareFn<any, any> = async (request) => {
    // keep the unwrapped event, for the ids an operator needs
    // .note = deliberate mutation — `request` is middy's only channel to hand a value onward
    request.internal = {
      ...request.internal,
      [KEY_OF_ASK_EVENT_REFUSABLE]: request.event,
    };
  };

  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    // only a caller fault drops the event; a server fault is retried, so it owes no line
    const error = asCallerFault({ error: request.error });
    if (!error) return;

    // a chain with no log (trail never ran) has no sink to write to
    const { log } = asContextTrailed({ context: request.context });
    if (!log) return;

    logLambdaEventRefused(
      {
        event: request.internal?.[KEY_OF_ASK_EVENT_REFUSABLE] ?? null,
        error,
        source,
      },
      { log },
    );
  };

  return { before, onError };
};
