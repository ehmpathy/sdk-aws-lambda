import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidatedInput } from '../../middleware/getValidatedInput';
import { KEY_OF_ASK_EVENT_ONWIRE } from './genAskEventOnwireCaptureMiddleware';

/**
 * .what = validates the body against a zod schema, then writes the reconciled envelope
 *         `{ payload, _: { raw } }` into `request.event`
 * .why = the ask-endpoint family reaches this step with the unwrapped body AT `request.event`,
 *        so the body is what the schema describes. the envelope is built here, after the parse,
 *        so its `payload` slot holds the VALIDATED value — the projection `payload ===
 *        event.payload` rests on it (`domain.terms/payload.md`)
 *
 * .why not shared with its api-gateway peer = `genZodInputValidationMiddleware` differs on two
 *        axes, and each alone would be enough:
 *          - the home — that chain must keep `request.event` http-shaped for
 *            `@middy/http-cors`, so its body rides at `event.payload` of an envelope it did
 *            not build. this one builds its own envelope
 *          - the shape — its schema describes a pair (`{ headers?, payload }`) and it writes
 *            back into two envelope slots. this one describes a single value
 */
export const genZodEventValidationMiddleware = <TInput>(input: {
  schema: ZodSchema<TInput>;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const inputAfter = getValidatedInput({
      schema: input.schema,
      value: request.event,
    });

    // write the envelope, with the parsed (transformed) body in its payload slot
    // .note = deliberate mutation — `request` is middy's only channel to hand a value onward
    request.event = {
      payload: inputAfter,
      _: { raw: request.internal?.[KEY_OF_ASK_EVENT_ONWIRE] },
    };
  };

  return { before };
};
