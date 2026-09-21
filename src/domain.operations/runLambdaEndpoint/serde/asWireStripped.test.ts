import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { asWireStripped } from './asWireStripped';

describe('asWireStripped', () => {
  given('[case1] a value the wire could never deliver', () => {
    when('[t0] a Date is stripped', () => {
      then('it becomes the iso string json would send', () => {
        expect(
          asWireStripped({
            value: { at: new Date('2026-09-08T00:00:00.000Z') },
            of: 'event',
          }),
        ).toEqual({ at: '2026-09-08T00:00:00.000Z' });
      });
    });

    when('[t1] a class instance is stripped', () => {
      then('it becomes a plain object', () => {
        // the guard's whole purpose: a referenced-boundary test must not pass on
        // a shape the serialized boundary would flatten.
        class Surfer {
          constructor(public name: string) {}
          public shout(): string {
            return 'cowabunga';
          }
        }
        const result = asWireStripped({
          value: new Surfer('kai'),
          of: 'event',
        });
        expect(result).toEqual({ name: 'kai' });
        expect(result instanceof Surfer).toBe(false);
      });
    });

    when('[t2] an undefined property is stripped', () => {
      then('the key is dropped, as an absent value on the wire', () => {
        expect(
          asWireStripped({
            value: { slug: 'abc', extra: undefined },
            of: 'event',
          }),
        ).toEqual({
          slug: 'abc',
        });
      });
    });
  });

  given('[case2] undefined itself', () => {
    when('[t0] the whole input is undefined', () => {
      then('undefined is returned rather than a JSON.parse throw', () => {
        // JSON.stringify(undefined) yields undefined, which JSON.parse rejects.
        // the early return is what keeps a void handler output from a throw.
        expect(asWireStripped({ value: undefined, of: 'output' })).toEqual(
          undefined,
        );
      });
    });
  });

  given('[case3] a value the wire delivers unchanged', () => {
    when('[t0] a plain nested object is stripped', () => {
      then('it round-trips to an equal value', () => {
        const event = { slug: 'abc', nested: { n: 1, list: [1, 2, 3] } };
        expect(asWireStripped({ value: event, of: 'event' })).toEqual(event);
      });
    });

    when('[t1] null is stripped', () => {
      then('null survives, unlike undefined', () => {
        // null has a json representation; undefined does not. the pair is the
        // whole distinction the guard exists to preserve.
        expect(asWireStripped({ value: { trail: null }, of: 'event' })).toEqual(
          { trail: null },
        );
      });
    });
  });

  // ⚠️ the marker convention is one `[caseN]` per given, `[tN]` per when, reset
  //    per given (howto.write-bdd) — so a `[tN]` never sits on a `given`, and no
  //    two givens share a number.
  given('[case4] a value JSON.stringify itself refuses', () => {
    // the vision names the repair outright: "the repair is a wrap, not a
    // redesign — a wrap around the strip, with a message that names the
    // wire-fidelity reason". the throw is CORRECT (aws would refuse the same
    // payload); a bare TypeError is not.
    when('[t0] the EVENT holds a circular reference', () => {
      then('it throws a ConstraintError, never a bare TypeError', () => {
        const circular: Record<string, unknown> = { slug: 'abc' };
        circular.self = circular;

        const thrown = getError(() =>
          asWireStripped({ value: circular, of: 'event' }),
        );
        expect(thrown).toBeInstanceOf(ConstraintError);
        expect(thrown).not.toBeInstanceOf(TypeError);
      });

      then('the message names the wire, so the author reads it right', () => {
        const circular: Record<string, unknown> = { slug: 'abc' };
        circular.self = circular;

        // rule.require.errors-name-the-fix — v8's own message names neither the
        // strip nor why it exists, so an author reads it as a defect in this
        // util rather than a wire-fidelity guard that just did its job.
        // ⚠️ `toContain('wire')` alone is a fragment the wrong message also
        //    satisfies, so this checks the two claims its own name makes: that
        //    the message names the WIRE, and that the hint names the FIX rather
        //    than the symptom.
        const thrown = getError(() =>
          asWireStripped({ value: circular, of: 'event' }),
        );
        const hint = String(
          (thrown as unknown as { metadata?: { hint?: unknown } }).metadata
            ?.hint ?? '',
        );

        expect(thrown.message).toContain('cross the wire');
        expect(hint).toContain('aws would refuse');
      });
    });

    when('[t1] the event holds a bigint', () => {
      then('it throws a ConstraintError too — one guard, both refusals', () => {
        const thrown = getError(() =>
          asWireStripped({ value: { amount: 10n }, of: 'event' }),
        );
        expect(thrown).toBeInstanceOf(ConstraintError);
      });
    });

    /**
     * 🔴 the DIRECTION clamp.
     *
     * this strip runs on the event AND on the handler's output, so half its
     * throws come from a return value. a message that reads *"the **event**
     * cannot cross the wire"* sends the author of a circular OUTPUT to re-read
     * the input they passed.
     *
     * ⇒ and the message clamp above asserts `toContain('wire')`, which the wrong
     *   message satisfies too — so that defect can be live and covered at once.
     *   **a clamp on a fragment is a clamp on that fragment, never on the claim.**
     *
     * ⚠️ **the OPPOSITE clamp — *"the message blames no single direction"*, *"the
     *    hint names BOTH sides"* — is a faithful clamp on a compromise this
     *    operation no longer has to make.** `of` is required, so each side names
     *    itself AND its own fault owner.
     *
     * ⇒ **a clamp is only ever as true as the design it guards.** assertions are
     *   re-pointed rather than deleted (rule.require.review-test-changes) — and
     *   the replacement is strictly stronger, since it asserts the two directions
     *   DIVERGE rather than that one message covers both.
     */
    when('[t2] the value that fails came from the handler OUTPUT', () => {
      const genCircular = (): Record<string, unknown> => {
        const circular: Record<string, unknown> = { found: true };
        circular.self = circular;
        return circular;
      };

      then('it throws a MalfunctionError — the SERVER owns this fault', () => {
        const thrown = getError(() =>
          asWireStripped({ value: genCircular(), of: 'output' }),
        );
        expect(thrown).toBeInstanceOf(MalfunctionError);
        expect(thrown).not.toBeInstanceOf(ConstraintError);
      });

      then('the message blames the handler rather than the event', () => {
        const thrown = getError(() =>
          asWireStripped({ value: genCircular(), of: 'output' }),
        );
        expect(thrown.message).toContain('the handler returned');
        expect(thrown.message).not.toContain('the event given');
      });

      then('the two directions disagree on BOTH class and message', () => {
        // 🔴 the teeth of the repair, in one assertion. without `of` both calls
        //    produce the same MalfunctionError with the same two-way hint, and
        //    this test cannot be written at all.
        const onEvent = getError(() =>
          asWireStripped({ value: genCircular(), of: 'event' }),
        );
        const onOutput = getError(() =>
          asWireStripped({ value: genCircular(), of: 'output' }),
        );

        expect(onEvent.constructor.name).not.toEqual(onOutput.constructor.name);
        expect(onEvent.message).not.toEqual(onOutput.message);
      });
    });
  });

  given('[case5] the strip is a copy, never a mutation', () => {
    when('[t0] the output is compared to the input', () => {
      then('they are equal in value and distinct in identity', () => {
        const event = { slug: 'abc' };
        const result = asWireStripped({ value: event, of: 'event' });
        expect(result).toEqual(event);
        expect(result).not.toBe(event);
      });
    });
  });
});
