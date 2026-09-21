import { given, then, when } from 'test-fns';

import { isErrorLike } from './isErrorLike';

/**
 * .what = clamps the one predicate three sites used to own separately
 * .why = 🔴 the risk this predicate prices is a FOURTH site:
 *
 *        > *"cross-realm boundaries are endemic to this local-locus/jest
 *        > architecture, so a 4th is likely … [and] has no canonical pattern to
 *        > reach for and will probably write a 4th slightly-different variant."*
 *
 *        ⇒ so the value of the extraction is only realized if the predicate has
 *          a stated contract. an un-tested shared helper is three copies with
 *          one name.
 *
 * 🟡 **the cross-realm case is what the whole thing exists for, and it is the one
 *    case a same-realm test cannot reach.** `[t2]` fabricates it instead — an
 *    object with the right shape and the wrong prototype is exactly what a
 *    foreign realm's `Error` looks like to `instanceof`.
 */
describe('isErrorLike', () => {
  given('[case1] a value caught from a throw', () => {
    when('[t0] it is a real Error', () => {
      then('a plain Error passes', () => {
        expect(isErrorLike(new Error('wipeout'))).toEqual(true);
      });

      then('a subclass passes', () => {
        class RipCurlError extends Error {}
        expect(isErrorLike(new RipCurlError('caught inside'))).toEqual(true);
      });
    });

    when('[t1] it is not error-shaped', () => {
      // each of these must reach the caller's fallback rather than the narrow
      then('a string does not pass', () => {
        expect(isErrorLike('wipeout')).toEqual(false);
      });

      then('null does not pass', () => {
        expect(isErrorLike(null)).toEqual(false);
      });

      then('undefined does not pass', () => {
        expect(isErrorLike(undefined)).toEqual(false);
      });

      then('a bare object does not pass', () => {
        expect(isErrorLike({ code: 'ENOENT' })).toEqual(false);
      });

      then('a non-string message does not pass', () => {
        // the tell a `String(error)` fallback must catch — the key is present
        // and its value is not usable as a message
        expect(isErrorLike({ message: 404 })).toEqual(false);
      });
    });

    when('[t2] it crossed a realm boundary', () => {
      // 🔴 the case this predicate exists for. `instanceof Error` returns FALSE
      //    here and does not throw, so any site that reached for it degrades
      //    silently to `String(error)` — which loses the constructor name and
      //    the stack.
      const asForeignRealmError = (message: string): unknown =>
        Object.assign(Object.create(null), {
          message,
          stack: `Error: ${message}\n    at foreign.js:1:1`,
        });

      then('instanceof is what fails, silently', () => {
        expect(asForeignRealmError('cross-realm') instanceof Error).toEqual(
          false,
        );
      });

      then('the duck-type holds where instanceof does not', () => {
        expect(isErrorLike(asForeignRealmError('cross-realm'))).toEqual(true);
      });
    });

    when('[t3] the shape tested is `.message`, deliberately', () => {
      // ⚠️ the two near-misses the docblock names. a looser predicate on `.name`
      //    or `.stack` would admit the first and refuse the second.
      then(
        'a `{ name }` bag is refused — `.name` would have admitted it',
        () => {
          expect(isErrorLike({ name: 'TypeError' })).toEqual(false);
        },
      );

      then('an Error with no stack is admitted', () => {
        const stackless = new Error('no stack here');
        delete (stackless as { stack?: unknown }).stack;
        expect(isErrorLike(stackless)).toEqual(true);
      });
    });
  });
});
