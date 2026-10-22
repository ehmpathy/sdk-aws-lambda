import type middy from '@middy/core';

import { genErrorNameFromClass } from './genErrorNameFromClass';
import { warnErrorNameUnset } from './warnErrorNameUnset';

/**
 * .what = names a thrown error from its class, when the class left `.name` at the inherited 'Error'
 * .why = 🔴 the aws node runtime labels a throw that escapes a handler by `error.name`
 *        (`aws-lambda-nodejs-runtime-interface-client`, `src/Errors.js`, `toRapidResponse`), and
 *        `getParsedResponse` classifies by that label. a class that never sets `.name` — every
 *        helpful-errors class as of 1.7.3, this repo's pin — reaches the wire as `'Error'`, so a
 *        `ConstraintError` an sqs endpoint rethrows on purpose reads as a SERVER fault and is
 *        retried (sdk-aws-lambda#73). this names it before the throw escapes, so the class the
 *        thrower chose is the label the caller reads, on the cloud and the local locus alike
 *
 * .note = an own `.name` always wins, whatever its value. a class or thrower that set one declared
 *         its wire label (aws's own `CredentialsProviderError`, a subclass that opts into
 *         `'ConstraintError'`, a thrower that chose `'Error'`), so the guard fills only the name
 *         inherited from the prototype — never an own choice. this also keeps it off a
 *         non-configurable own `name`, which `defineProperty` would refuse with a throw
 * .note = a SUBCLASS is named after itself: `class QuoteStaleError extends ConstraintError {}`
 *         reaches the wire as `'QuoteStaleError'`, which `getParsedResponse` reads as a server
 *         fault, exactly as the aws runtime would once helpful-errors sets `.name`. to be read as a
 *         caller fault, a subclass declares `public override name = 'ConstraintError'`
 * .note = a frozen or sealed error cannot take the name, so it keeps `'Error'`, and where it
 *         escapes (sqs, a forAsk server fault) it reads as a server fault. the guard cannot repair
 *         that and must not replace the handler's fault with its own throw, so it warns
 *         `error.name.unset` with the class and the consequence (`warnErrorNameUnset`), via
 *         `log.warn` when it is a function, else `console.warn`
 * .note = it must run FIRST of every `onError`, so each family registers it LAST: middy runs
 *         `onError` hooks in reverse array order and aborts the chain when one throws, and
 *         `genInternalServiceErrorMiddleware({ asOutputAfter: false })` throws from its own. a guard
 *         that ran after that throw would never fire on a server fault. first-run also hands every
 *         later hook — the io logger, the error builders — the named error
 * .note = the name is a non-enumerable own property, as a native `Error`'s is, so `Object.keys` and
 *         a spread stay unchanged. `HelpfulError.toJSON` reads `getOwnPropertyNames`, so a logged
 *         helpful-error gains `name: '<Class>'` — the label it should have carried, and the same
 *         shape helpful-errors#45 produces once it sets `.name` itself
 */
export const genErrorNameMiddleware = (): {
  onError: middy.MiddlewareFn<any, any>;
} => {
  const onError: middy.MiddlewareFn<any, any> = async (request) => {
    /**
     * .note = the hook is TOTAL: it names the error or leaves it exactly as the handler threw
     *         it, and never aborts the chain with a throw of its own. a guard throw would
     *         replace the handler's fault before any later hook read it — the very class this
     *         guard exists to close. so its own throw is caught and reported loud on
     *         `console.error`, and the handler's fault flows on untouched
     */
    try {
      // name the throw from its class, when its class left the default
      const outcome = genErrorNameFromClass({ error: request.error });
      if (outcome.status !== 'unnameable') return;

      // warn when a nameable class could not take its name; a throw that escapes reads as a server fault
      warnErrorNameUnset({
        nameOfClass: outcome.nameOfClass,
        context: request.context,
      });
    } catch (cause) {
      // report the guard's own fault; the handler's fault must still reach the caller
      console.error('error.name.guard.malfunction', {
        cause,
        hint: 'the handler fault flows on unnamed; report this to sdk-aws-lambda',
      });
    }
  };
  return { onError };
};
