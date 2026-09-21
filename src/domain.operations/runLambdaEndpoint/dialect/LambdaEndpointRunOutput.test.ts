import { given, then, when } from 'test-fns';

import type { LambdaEndpointDialect } from '../../../domain.objects/LambdaEndpointDialect';
import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP } from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import { asLambdaEndpointOutput } from './asLambdaEndpointOutput';
import type {
  LambdaEndpointErrorEnvelope,
  LambdaEndpointRunOutput,
  WireDelivered,
  WireStripped,
} from './LambdaEndpointRunOutput';

/**
 * .what = the TYPE-LEVEL clamp on the dialect conditional
 * .why = `LambdaEndpointErrorEnvelope` is a **distributive** conditional type, and
 *        that distribution carries weight for a consumer none of its own tests
 *        touch.
 *
 * 🔴 **this is the type the whole F9 guarantee rests on**, and only a type-level
 *    test reaches it — its runtime consumers cover the value, never the type.
 *
 * ⇒ **the property**: `TDialect extends 'ancient' ? A : C` distributes over a
 *   union, so `LambdaEndpointErrorEnvelope<LambdaEndpointDialect>` resolves to
 *   `A | C` rather than to `C` alone.
 *
 * ⇒ **why it matters**: `asLambdaEndpointOutput` subtracts exactly that type —
 *   `Exclude<TRun, LambdaEndpointErrorEnvelope<LambdaEndpointDialect>>`
 *   (`asLambdaEndpointOutput.ts:24-27`, `:88`). were the conditional written in the
 *   common non-distributive form — `[TDialect] extends ['ancient'] ? A : C` — it
 *   would yield `C` alone, `Exclude` would subtract only the contemp arm, and the
 *   ANCIENT envelope would survive into the success type. every field read on an
 *   ancient run would then fail the type gate.
 *
 * ⚠️ **a runtime test cannot see this.** `asLambdaEndpointOutput` still throws on
 *   an ancient envelope either way — the predicate is `isLambdaEndpointErrorEnvelope`
 *   and it reads the value, not the type. so the defect is a pure ERGONOMIC break,
 *   visible only at a consumer's own type gate. ⇒ the clamp lives in the types.
 */
describe('LambdaEndpointRunOutput', () => {
  given('[case1] the dialect conditional, given the whole union', () => {
    when('[t0] each envelope arm is assigned to the distributed type', () => {
      then('the ANCIENT arm is assignable', () => {
        // 🔴 this line is the clamp. under a non-distributive conditional the
        //    type resolves to the contemp envelope alone, and this assignment
        //    fails the type gate — which is exactly the break it guards.
        const envelope: LambdaEndpointErrorEnvelope<LambdaEndpointDialect> = {
          errorMessage: 'the uuid names no known surfer',
          errorType: 'BadRequestError',
        };

        expect(envelope).toBeDefined();
      });

      then('the CONTEMP arm is assignable too — both, never one', () => {
        const envelope: LambdaEndpointErrorEnvelope<LambdaEndpointDialect> = {
          error: {
            _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP,
            class: 'ConstraintError',
            message: 'the uuid names no known surfer',
          },
        };

        expect(envelope).toBeDefined();
      });
    });

    when('[t1] a single dialect is named', () => {
      then('the conditional picks that arm and no other', () => {
        // 🟡 the shape is bound FIRST, on purpose. `@ts-expect-error` suppresses
        //    the line directly beneath it, and an inline literal puts the error on
        //    the offending PROPERTY three lines down — so the directive reports
        //    "unused" and the gate fails for the wrong reason. probed.
        const contempShape = {
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'ConstraintError',
            message: 'x',
          },
        };

        // @ts-expect-error the contemp shape is not the ancient envelope
        const wrong: LambdaEndpointErrorEnvelope<'ancient'> = contempShape;

        expect(wrong).toBeDefined();
      });
    });
  });

  given('[case2] the success narrow, which consumes the distribution', () => {
    when('[t0] a run output is narrowed on each dialect', () => {
      /**
       * 🔴 **the fixture is a CALL, and `out` carries no annotation.** both are
       * the clamp — probed, and each alternative stays green on the defect:
       *
       * | the form | why it cannot bite |
       * |---|---|
       * | `const out: { found: boolean } = asLambda…(res)` | an annotation is a CONTEXTUAL type, so `TRun` infers as `{ found }` rather than from the union — the annotation answers the question |
       * | `const res: Union = { found: true }` | control-flow analysis narrows a literal-bound `const` to the literal's own type, so the union never reaches the call site |
       *
       * ⇒ a call expression has no CFA narrow and no contextual type, so `TRun`
       *   infers as the declared union and the `.found` read below proves the
       *   envelope arm was subtracted.
       *
       * 🟡 **a type-level test is only as strong as its fixture's declared type
       *   survives to the call.** an annotation and a literal each replace that
       *   type with the answer.
       */
      const genRunAncient = (): LambdaEndpointRunOutput<
        { found: boolean },
        'ancient'
      > => ({ found: true });

      const genRunContemp = (): LambdaEndpointRunOutput<
        { found: boolean },
        'contemp'
      > => ({ found: true });

      then('the ancient run yields a readable output field', () => {
        const out = asLambdaEndpointOutput(genRunAncient());

        expect(out.found).toEqual(true);
      });

      then('the contemp run does too', () => {
        const out = asLambdaEndpointOutput(genRunContemp());

        expect(out.found).toEqual(true);
      });
    });
  });

  /**
   * 🔴 the clamp on F13. a run output typed `TOutput` as the HANDLER declares it
   * lies, because the util JSON-strips what it returns — so `{ scheduledAt: Date }`
   * compiles and `.toISOString()` throws. `WireStripped<T>` closes it.
   *
   * ⚠️ no RUNTIME test can see this: the value is `string` either way, and only
   *    the TYPE moves. a whole-object `toEqual` takes `unknown`, so a wrong
   *    field type is invisible to the rest of the suite by construction.
   */
  given('[case3] WireStripped, the outbound-strip map', () => {
    when('[t0] a Date sits at the top level', () => {
      then('it is typed as its iso string', () => {
        // 🔴 the clamp. under the un-repaired type this annotation reads `Date`
        //    and the string literal fails the gate — which is the break it guards.
        const stripped: WireStripped<{ scheduledAt: Date }> = {
          scheduledAt: '2026-09-03T14:00:00.000Z',
        };

        expect(stripped.scheduledAt).toEqual('2026-09-03T14:00:00.000Z');
      });

      then('and a live Date is REFUSED, which is the half that bites', () => {
        // 🟡 bound first, for the reason `[case2][t1]` states: an inline literal
        //    puts the error on the property rather than on the annotated line, so
        //    the directive reports "unused" and the gate fails for a wrong reason.
        const live = { scheduledAt: new Date() };

        // @ts-expect-error a Date does not survive the wire — WireStripped says so
        const stripped: WireStripped<{ scheduledAt: Date }> = live;

        expect(stripped).toBeDefined();
      });
    });

    when('[t1] the Date is nested, or in an array', () => {
      then('the map recurses through both', () => {
        const stripped: WireStripped<{
          lesson: { bookedAt: Date };
          slots: { at: Date }[];
        }> = {
          lesson: { bookedAt: '2026-09-03T14:00:00.000Z' },
          slots: [{ at: '2026-09-03T15:00:00.000Z' }],
        };

        expect(stripped.slots[0]!.at).toEqual('2026-09-03T15:00:00.000Z');
      });
    });

    when('[t2] a shape carries no Date at all', () => {
      then('every primitive passes through untouched', () => {
        const stripped: WireStripped<{ found: boolean; count: number }> = {
          found: true,
          count: 2,
        };

        expect(stripped).toEqual({ found: true, count: 2 });
      });
    });

    /**
     * ⚠️ **the BOUND, clamped rather than merely documented.** `WireStripped` is
     * fit to the case that ships — `Date` — and does NOT model the two rarer
     * things json does: it drops a required key valued `undefined`, and it drops
     * a function value. both need a key-remap that turns the type into an
     * intersection, and an intersection renders in every consumer's error
     * messages (`rule.prefer.wet-over-dry`).
     *
     * ⇒ so this asserts what the type DOES, never what a reader might hope. the
     *   day the bound moves, this line fails and the docblock on
     *   `LambdaEndpointRunOutput.ts` is caught stale with it.
     */
    when('[t3] a key is valued undefined — the unmodeled case', () => {
      then('the key stays REQUIRED, which json would have dropped', () => {
        const stripped: WireStripped<{ note: undefined; found: boolean }> = {
          note: undefined,
          found: true,
        };

        expect('note' in stripped).toEqual(true);
      });
    });
  });

  /**
   * 🔴 the clamp on the SERIALIZED half of F13 — the defect is not confined to
   * `Date`.
   *
   * ⚠️ the two boundaries genuinely disagree, and both are right.
   *    `onReferenced` is HOST-faithful, so a void handler answers `undefined`;
   *    `onSerialized` is WIRE-faithful, and aws delivers `null` for a lambda
   *    that returns no value. one type cannot serve both, which is why
   *    `WireDelivered` sits BESIDE `WireStripped` rather than in place of it.
   *
   * 🟡 this is the sqs/sns consumer shape, never an edge case — a migrant who
   *    tests one handler on both boundaries meets it on their first pair.
   */
  given('[case4] WireDelivered, the serialized boundary map', () => {
    when('[t0] the handler returns no value', () => {
      then('the wire delivers null, and the type says so', () => {
        // 🔴 the clamp. under a bare `TOutput` this annotation reads `void` and
        //    the `null` literal fails the gate — which is the break it guards.
        const delivered: WireDelivered<void> = null;

        expect(delivered).toEqual(null);
      });

      then('undefined maps to null too — the wire has no undefined', () => {
        const delivered: WireDelivered<undefined> = null;

        expect(delivered).toEqual(null);
      });
    });

    when('[t1] the handler returns a value', () => {
      then('it inherits the wire strip — a Date is its iso string', () => {
        const delivered: WireDelivered<{ scheduledAt: Date }> = {
          scheduledAt: '2026-09-03T14:00:00.000Z',
        };

        expect(delivered.scheduledAt).toEqual('2026-09-03T14:00:00.000Z');
      });
    });

    /**
     * 🟡 the NON-DISTRIBUTION clamp, and it is the half a runtime test cannot see.
     *
     * a bare `T extends void` DISTRIBUTES over a union, so
     * `void | { found: boolean }` would map arm-by-arm to `null | { found }` —
     * a type that admits `null` for an output the boundary never delivers as
     * `null`. `[T] extends [void]` asks the question of the whole type, which is
     * what the boundary actually does, and yields `void | { found }`.
     *
     * 🔴 **the assertion must be NEGATIVE.** a POSITIVE one is a placebo:
     *
     *      const delivered: WireDelivered<void | { found }> = { found: true };
     *
     *    ⇒ distribution makes the type WIDER, never narrower, so a valid arm
     *      stays assignable under BOTH forms. probed: swapped in the distributed
     *      conditional and the whole gate stayed green.
     *
     *    ⇒ so the clamp reaches for the value the two forms DISAGREE about.
     *      `null` is admitted by the distributed form and refused by the tuple
     *      form, so `@ts-expect-error` reports "unused" the moment the tuple is
     *      dropped.
     */
    when('[t2] the declared output is a union', () => {
      then('the map does NOT distribute over its arms', () => {
        // 🟡 bound first, for the reason `[case2][t1]` states — an inline literal
        //    puts the error on a property rather than on the annotated line.
        const nothing = null;

        // @ts-expect-error a union output is not void, so the wire delivers no null
        const delivered: WireDelivered<void | { found: boolean }> = nothing;

        expect(delivered).toEqual(null);
      });
    });
  });
});
