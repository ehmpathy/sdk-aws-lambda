import type middy from '@middy/core';
import type { ZodSchema } from 'zod';

import { getValidatedInput } from '../../middleware/getValidatedInput';
import type { UnifiedApiGatewayEvent } from '../UnifiedApiGatewayEvent';

/**
 * .what = validates event.body against zod schema for API Gateway
 * .why = API Gateway events have body as separate property, validate just the body
 *
 * .note = this family validates `event.body` rather than the whole event because
 *         `request.event` must stay http-shaped through the chain: `@middy/http-cors` reads
 *         `request.event.headers` and derives the http method from `request.event` in its
 *         `after` hook (`@middy/http-cors/index.js:38,83,106`). so the body cannot take the
 *         event's place, and this cannot yet collapse into `genZodEventValidationMiddleware`
 *
 * .note = the constraint is SHARPER than "http-shaped", and the precise form is what any
 *         future input translate must honor. cors picks its method extractor by
 *         `request.event.version ?? '1.0'` (`index.js:38,106`), and `UnifiedApiGatewayEvent`
 *         declares no `version` — so cors always falls to its **v1** extractor,
 *         `(event) => event.httpMethod`. that works only because the unified shape happens to
 *         expose `httpMethod` and `headers` at its top level under v1's own names. so the real
 *         requirement is: whatever occupies `request.event` when cors's `after` runs must keep
 *         `httpMethod` and `headers` readable at the top level, with v1 names. an arbitrary
 *         `TInput` cannot promise that, which is why the input translate has no home here yet
 */
export const genZodBodyValidationMiddleware = <TInput>(input: {
  schema: ZodSchema<TInput>;
}): {
  before: middy.MiddlewareFn<any, any>;
} => {
  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const event = request.event as UnifiedApiGatewayEvent;
    const inputAfter = getValidatedInput({
      schema: input.schema,
      value: event.body,
    });

    // replace body with parsed (transformed) result
    /**
     * .note = DELIBERATE MUTATION — `request` is middy's only channel to hand a value onward,
     *         and `event` is an ALIAS of `request.event`, so this writes through to the chain
     *
     * ⚠️ .note = this site escaped the first sweep of this class, because that grep anchored on
     *            `request.` and an alias hides the receiver. a mutation through a local alias is
     *            the same mutation — so the pattern must match the ALIAS too
     *            (`^\s*(event|response|payload)\.\w+\s*=`), which finds exactly this one
     *
     * .as = `UnifiedApiGatewayEvent.body` is the PRE-validation shape (a string, or a parsed
     *       json value), while `inputAfter` is `TInput` — the POST-validation domain shape.
     *       the two are unrelated by declaration, which is exactly right: this assignment IS
     *       the step that changes which of them lives in the slot
     * .removal = drops once the input-side translator lands and the chain carries `inputAfter`
     *            in its own slot rather than back in the event's `body` — the 🚧 F31 fulcrum
     */
    event.body = inputAfter as unknown as typeof event.body;
  };

  return { before };
};
