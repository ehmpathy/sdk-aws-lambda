import { given, then, when } from 'test-fns';

import type { WireDelivered } from '../dialect/LambdaEndpointRunOutput';
import { asWirePayload } from './asWirePayload';
import { asWireStripped } from './asWireStripped';

/**
 * .what = reads the payload back the way `getParsedResponse` reads it
 * .why = the assertions below are about what a CALLER receives, so each one
 *        decodes rather than inspects the bytes — which is the same step the
 *        wire hydration takes.
 */
const asDecoded = (payload: Uint8Array): unknown =>
  JSON.parse(new TextDecoder().decode(payload));

describe('asWirePayload', () => {
  given('[case1] a handler that answered with a value', () => {
    when('[t0] the answer is cast to the wire', () => {
      then('it decodes to an equal value', () => {
        const output = { found: true, nested: { n: 1 } };
        expect(asDecoded(asWirePayload(output))).toEqual(output);
      });
    });

    when('[t1] a wire-hostile value is cast', () => {
      then('a Date arrives as the iso string json sends', () => {
        expect(
          asDecoded(
            asWirePayload({ at: new Date('2026-09-08T00:00:00.000Z') }),
          ),
        ).toEqual({ at: '2026-09-08T00:00:00.000Z' });
      });
    });
  });

  /**
   * 🔴 the VOID DIVERGENCE, and it is the one line where the two loci differ.
   *
   * a void handler answers `undefined` on the REFERENCED boundary and `null`
   * here — because aws delivers `null` for a lambda that returns no value, so
   * `null` is what a real caller receives.
   *
   * ⚠️ **this is a real experience rather than an edge.** an sqs or sns consumer
   *    handler is exactly the void case, so a migrant who tests one handler on
   *    both boundaries meets it on their first pair of tests.
   *
   * ⇒ the pair below asserts the divergence DIRECTLY rather than only through a
   *   slow local-locus integration run, so a reader meets the two answers side
   *   by side rather than infers one of them from an absent assertion.
   */
  given('[case2] a handler that answered with no value', () => {
    when('[t0] undefined is cast to the wire', () => {
      then('it decodes to null — what aws delivers for a void lambda', () => {
        expect(asDecoded(asWirePayload(undefined))).toEqual(null);
      });

      then('the REFERENCED peer answers undefined on the same input', () => {
        // 🔴 the teeth: without this line the assertion above would read as a
        //    defensive default rather than as a boundary divergence. the two
        //    halves disagree on purpose, and each is right for its own side.
        expect(asWireStripped({ value: undefined, of: 'output' })).toEqual(
          undefined,
        );
      });
    });

    when('[t1] an explicit null is cast', () => {
      then('null survives as null — the two inputs converge here', () => {
        // `?? null` maps undefined ONTO null; it does not invent a value for a
        // handler that already answered null.
        expect(asDecoded(asWirePayload(null))).toEqual(null);
      });
    });
  });

  /**
   * 🔴 the void→null fact is declared TWICE, in two files, in two languages.
   *
   * | where | how it says `null` | clamped by |
   * |---|---|---|
   * | `LambdaEndpointRunOutput.ts:120` | `[T] extends [void] ? null : …` — the TYPE | `LambdaEndpointRunOutput.test.ts [case4]` |
   * | `asWirePayload.ts:33` | `JSON.stringify(output ?? null)` — the RUNTIME | `[case2]` above |
   *
   * ⚠️ **each half is clamped, and until this block their AGREEMENT was not.**
   *    the type test asserts the type; the runtime test asserts the runtime; and
   *    a drive that moved one without the other would leave both files green —
   *    two tests that each pass while the pair they describe has come apart.
   *
   * ⇒ so the crossing is the point, and it lives HERE rather than in either
   *   peer, because neither peer can see the other's half by construction.
   */
  given('[case4] the declared wire type and the runtime cast, together', () => {
    when('[t0] a void handler’s answer is read back', () => {
      then('the RUNTIME emits exactly what the TYPE declares', () => {
        // 🔴 the teeth, and they bite in both directions:
        //    · the annotation is checked at COMPILE time — move `WireDelivered`
        //      off `null` and this line stops to typecheck
        //    · the expect is checked at RUN time — move `?? null` off `null` and
        //      the assertion fails
        //    neither an as-cast nor a literal on both sides would do this; the
        //    value must be TYPED by one half and COMPARED against the other.
        const declared: WireDelivered<void> = null;

        expect(asDecoded(asWirePayload(undefined))).toEqual(declared);
      });

      then('a VALUED handler is not collapsed to null by either half', () => {
        // the other arm of the conditional. `[T] extends [void]` must answer
        // false here, or every non-void caller would be typed `null` too.
        const declared: WireDelivered<{ found: boolean }> = { found: true };

        expect(asDecoded(asWirePayload({ found: true }))).toEqual(declared);
      });
    });
  });

  given('[case3] a falsy value that is NOT absent', () => {
    when('[t0] a zero, an empty string, and false are cast', () => {
      then('each survives rather than collapses to null', () => {
        // 🟡 `?? null` rather than `|| null` is what makes this hold. a handler
        //    that legitimately answers `0` or `false` must not read as void.
        expect(asDecoded(asWirePayload(0))).toEqual(0);
        expect(asDecoded(asWirePayload(''))).toEqual('');
        expect(asDecoded(asWirePayload(false))).toEqual(false);
      });
    });
  });
});
