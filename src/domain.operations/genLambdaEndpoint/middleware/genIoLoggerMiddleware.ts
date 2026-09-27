import type middy from '@middy/core';

import type { TranslateLog } from '../TranslateLog';
import { asContextTrailed } from './asContextTrailed';

/**
 * .what = middleware that logs handler input and output
 * .why = enables debug observability with optional redaction via translate.log
 *
 * .defect = LIVE, NOT FIXED — on an error, the `request.response` branch of `onError` below
 *         never runs. both shipped chains log the `errorMessage` / `stackTrace` branch instead
 *
 *         .the cause = middy `unshift`s `after` and `onError` hooks
 *         (`@middy/core/index.js:79-100`), so registration order reverses at run time: a higher
 *         array index runs earlier on the error path. `onError` here reads `request.response`,
 *         which exists only once an error-builder has set it — so this middleware must sit at a
 *         lower index than `genConstraintErrorMiddleware` / `genInternalServiceErrorMiddleware`
 *         for its response branch to observe a value at all. it sits higher in both
 *
 *         .the repair, unapplied = move it below the error builders. left with the peer
 *         header-order defect because that reorder also moves the success-path `after` order for
 *         every handler — a blast radius this wish's bound does not cover. the peer and the
 *         shared reorder both wait on
 *         `.dream/v2026_09_22.fix.no-cors-or-owasp-headers-on-error-responses.md`
 *
 * .note = do not delete the response branch as dead code. it names a real intent — on an error,
 *         log what the caller actually received — and it goes live the moment the reorder lands
 *         (rule.require.retest-the-model-on-every-family: prune a slot, never a name)
 * .note = the same mechanism binds a custom chain: place this below your own error builders, or
 *         its error-path response branch is dead there too
 */
export const genIoLoggerMiddleware = (input?: {
  logTranslate?: TranslateLog;
}): {
  before: middy.MiddlewareFn<any, any>;
  after: middy.MiddlewareFn<any, any>;
  onError: middy.MiddlewareFn<any, any>;
} => {
  const translateInput = input?.logTranslate?.input ?? ((event) => event);
  const translateOutput =
    input?.logTranslate?.output ?? ((response) => response);

  const before: middy.MiddlewareFn<any, any> = async (request) => {
    const log = asContextTrailed({ context: request.context }).log;
    if (log) {
      log.debug('handler.input', { event: translateInput(request.event) });
    }
  };

  const after: middy.MiddlewareFn<any, any> = async (request) => {
    const log = asContextTrailed({ context: request.context }).log;
    if (log) {
      log.debug('handler.output', {
        response: translateOutput(request.response),
      });
    }
  };

  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    const log = asContextTrailed({ context: request.context }).log;
    if (log) {
      if (request.response) {
        log.debug('handler.output', {
          response: translateOutput(request.response),
        });
      } else if (request.error) {
        log.debug('handler.output', {
          errorMessage: request.error.message,
          stackTrace: request.error.stack,
        });
      }
    }
  };

  return { before, after, onError };
};
