import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX } from '../../../domain.objects/LambdaEndpointErrorResponseBody';
import {
  asLambdaEndpointErrorEnvelopeAncient,
  asLambdaEndpointErrorEnvelopeContemp,
  isLambdaEndpointErrorEnvelopeAncient,
  isLambdaEndpointErrorEnvelopeContemp,
} from './isLambdaEndpointErrorEnvelope';
import type { LambdaEndpointRunOutput } from './LambdaEndpointRunOutput';

/**
 * .what = a run output on each dialect, typed as the union a real call returns
 * .why = the annotation is what a real call site gets for free from
 *        `onReferenced`'s return type, so the fixtures stand in for it here.
 *
 * 🔴 **the contemp fixture stamps the CODEC-VERSIONED tag — F22.** the type
 *   requires `…::contemp@$version` and the detector matches the prefix, so a
 *   value that carries the prefix IS a contemp envelope and one that does not is
 *   NOT. the dialect is fixed by WHICH narrow you call, never by a type argument.
 */
const ENVELOPE_CONTEMP: LambdaEndpointRunOutput<{ uuid: string }, 'contemp'> = {
  error: {
    _serde: `${LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}@1`,
    class: 'ConstraintError',
    message: 'the uuid names no known surfer',
  },
};

const ENVELOPE_ANCIENT: LambdaEndpointRunOutput<{ uuid: string }, 'ancient'> = {
  errorMessage: 'the uuid names no known surfer',
  errorType: 'BadRequestError',
};

/**
 * ⚠️ **`[caseN]` is a VISION-CASE reference here, never a local counter.**
 *   `[case2]` is *"a constraint error returns an envelope"* and `[case5]` is
 *   *"the frame flips the envelope"* — the two demos this narrow serves.
 */
describe('isLambdaEndpointErrorEnvelope', () => {
  given('[case2] the CONTEMP envelope arm of the union', () => {
    when('[t0] a contemp envelope is checked', () => {
      then('it is recognized by its codec-versioned serde tag', () => {
        expect(isLambdaEndpointErrorEnvelopeContemp(ENVELOPE_CONTEMP)).toEqual(
          true,
        );
      });

      then('the narrow makes the nested field readable', () => {
        // 🔴 the whole point. without the narrow this line is a TS2339 —
        // `error` does not exist on `TOutput | Envelope`, so an author's only
        // way through was an `as` cast (rule.forbid.as-cast).
        const envelope = asLambdaEndpointErrorEnvelopeContemp(ENVELOPE_CONTEMP);
        expect(envelope.error.class).toEqual('ConstraintError');
      });
    });

    when('[t1] a plain handler output is checked', () => {
      then('it is NOT a contemp envelope', () => {
        expect(
          isLambdaEndpointErrorEnvelopeContemp({ uuid: 'abc', seenAt: 'now' }),
        ).toEqual(false);
      });

      then('the assure THROWS rather than hand back a bad narrow', () => {
        // rule.require.failfast — a silent `undefined` read would teach the
        // author naught. the caller asserted an envelope where the endpoint
        // answered with an output, so the fault is theirs (ConstraintError).
        const thrown = getError(() =>
          asLambdaEndpointErrorEnvelopeContemp({ uuid: 'abc' }),
        );
        expect(thrown).toBeInstanceOf(ConstraintError);
      });

      then('the message names what to do instead', () => {
        const thrown = getError(() =>
          asLambdaEndpointErrorEnvelopeContemp({ uuid: 'abc' }),
        );
        const hint = String(
          (thrown as unknown as { metadata?: { hint?: unknown } }).metadata
            ?.hint ?? '',
        );

        // the fix, not merely the symptom (rule.require.errors-name-the-fix)
        expect(hint).toContain('assert on the output shape');
        expect(hint).toContain('send an event the schema refuses');

        // the whole refusal, pinned once for this arm — the `toBeInstanceOf`
        // in the then above cannot report a reshape of the class or the hint
        expect({
          class: thrown.constructor.name,
          hintNamesAssertOnOutput: hint.includes('assert on the output shape'),
          hintNamesSendARefusedEvent: hint.includes(
            'send an event the schema refuses',
          ),
        }).toMatchSnapshot();
      });
    });

    when('[t2] a handler output carries a plain `error` field', () => {
      then(
        'it is NOT a contemp envelope — the serde tag is what settles it',
        () => {
          // an endpoint whose OUTPUT schema has an `error` string is legal, and
          // a shape-only check would misread it as a rejection. the tag exists
          // precisely so this cannot collide.
          expect(
            isLambdaEndpointErrorEnvelopeContemp({
              error: 'a field of my own',
            }),
          ).toEqual(false);
        },
      );
    });

    when('[t3] null is checked', () => {
      then('it is NOT an envelope, and no deref throws', () => {
        // `typeof null === 'object'`, so the null guard carries real weight
        // rather than caution — without it this line is a TypeError.
        expect(isLambdaEndpointErrorEnvelopeContemp(null)).toEqual(false);
        expect(isLambdaEndpointErrorEnvelopeAncient(null)).toEqual(false);
      });
    });

    when('[t4] a string is checked', () => {
      then('it is NOT an envelope', () => {
        expect(isLambdaEndpointErrorEnvelopeContemp('nope')).toEqual(false);
        expect(isLambdaEndpointErrorEnvelopeAncient('nope')).toEqual(false);
      });
    });

    /**
     * 🔴 **F22 — the codec version is DATA, not a gate.** the detector matches
     *   the prefix, so an envelope from ANY version is recognized, and a legacy
     *   envelope with the BARE prefix (no `@version`) is too. an equality check
     *   would have broken the wire on every release — silently, per the tag's
     *   own docblock. these are the clamps on that, bite-provable: tighten
     *   `getIsContempErrorTagged` to an equality and every row here goes red.
     */
    when('[t5] a contemp envelope carries a DIFFERENT codec version', () => {
      then('it is still recognized — the version is data, not a gate', () => {
        const future = {
          error: {
            _serde: `${LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}@2`,
            class: 'ConstraintError',
            message: 'x',
          },
        };
        expect(isLambdaEndpointErrorEnvelopeContemp(future)).toEqual(true);
      });
    });

    when(
      '[t6] a LEGACY contemp envelope carries the bare, unversioned tag',
      () => {
        then('it is still recognized — the rollout guard', () => {
          const legacy = {
            error: {
              _serde: LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX,
              class: 'ConstraintError',
              message: 'x',
            },
          };
          expect(isLambdaEndpointErrorEnvelopeContemp(legacy)).toEqual(true);
        });
      },
    );

    when('[t7] a value carries a LOOK-ALIKE prefix', () => {
      then('a peer codec name is NOT matched — the `@` boundary holds', () => {
        const lookalike = {
          error: {
            _serde: `${LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}FOO`,
            x: 1,
          },
        };
        expect(isLambdaEndpointErrorEnvelopeContemp(lookalike)).toEqual(false);
      });
    });
  });

  given('[case5] the ANCIENT envelope arm of the union', () => {
    when('[t0] it is checked', () => {
      then('it is recognized by its flat pair', () => {
        // the ancient dialect carries no tag, so the two string fields ARE the
        // signal — the same absence that makes contemp the exact one.
        expect(isLambdaEndpointErrorEnvelopeAncient(ENVELOPE_ANCIENT)).toEqual(
          true,
        );
      });

      then('the narrow makes the flat field readable', () => {
        const envelope = asLambdaEndpointErrorEnvelopeAncient(ENVELOPE_ANCIENT);
        expect(envelope.errorType).toEqual('BadRequestError');
      });
    });

    when('[t1] the flat pair is present but not both strings', () => {
      then('it is NOT an ancient envelope', () => {
        expect(
          isLambdaEndpointErrorEnvelopeAncient({
            errorMessage: 'x',
            errorType: 7,
          }),
        ).toEqual(false);
      });
    });

    /**
     * 🔴 **F9 holds by FUNCTION CHOICE, never by a type argument.** the caller
     *   picks the dialect by which narrow they call, so a cross-dialect field
     *   read is a compile error — the `@ts-expect-error` IS the assertion, and
     *   tsc emits `TS2578` the moment the field becomes readable on the wrong
     *   narrow.
     */
    when('[t2] a cross-dialect read is attempted', () => {
      then('the contemp field does not exist on an ancient narrow', () => {
        const narrowed = asLambdaEndpointErrorEnvelopeAncient(ENVELOPE_ANCIENT);
        // @ts-expect-error `error` is the contemp field; this is an ancient narrow
        const readAcrossDialects = narrowed.error;
        expect(readAcrossDialects).toBeUndefined();
      });

      then('the ancient field does not exist on a contemp narrow', () => {
        const narrowed = asLambdaEndpointErrorEnvelopeContemp(ENVELOPE_CONTEMP);
        // @ts-expect-error `errorType` is the ancient field; this is a contemp narrow
        const readAcrossDialects = narrowed.errorType;
        expect(readAcrossDialects).toBeUndefined();
      });
    });
  });

  /**
   * 🔴 **the F22 win — the erasure failhide is CLOSED.** a SINGLE generic erases
   *   `TDialect`, so `asLambdaEndpointErrorEnvelope<'contemp'>(ancientValue)` runs
   *   the ancient shape check, matches, and hands back a value typed contemp whose
   *   `.error.message` reads `undefined` with NO throw — `rule.forbid.failhide`
   *   (F19 branch B).
   *
   *   the dialect-fixed pair cannot do that: a contemp assert reads the TAG alone,
   *   an ancient value has no tag, so it THROWS a ConstraintError that names the
   *   fix. bite-provable: swap the split back to the shape-fallback generic and
   *   `[t0]` below goes green-without-throw.
   */
  given('[case16] a value whose dialect does NOT match the narrow', () => {
    when('[t0] a contemp assert meets an ancient value', () => {
      then('it THROWS loudly — the failhide the split closes', () => {
        // the ancient value carries no `_serde` tag, so the contemp narrow says
        // no, and the assure throws rather than hand back a silent `undefined`.
        expect(isLambdaEndpointErrorEnvelopeContemp(ENVELOPE_ANCIENT)).toEqual(
          false,
        );

        const thrown = getError(() =>
          asLambdaEndpointErrorEnvelopeContemp(ENVELOPE_ANCIENT),
        );
        expect(thrown).toBeInstanceOf(ConstraintError);

        expect({
          class: thrown.constructor.name,
        }).toMatchSnapshot();
      });
    });

    when('[t1] a contemp assert meets a HYBRID value', () => {
      then('the plain `error` field does not fool the tag check', () => {
        // the hybrid carries a plain `error` string AND the ancient flat pair, so
        // a SHAPE fallback reads it as contemp. the tag check is not fooled — the
        // tag is absent.
        const hybrid = {
          error: 'a field of my own',
          errorMessage: 'the uuid names no known surfer',
          errorType: 'BadRequestError',
        };

        expect(isLambdaEndpointErrorEnvelopeContemp(hybrid)).toEqual(false);

        const thrown = getError(() =>
          asLambdaEndpointErrorEnvelopeContemp(hybrid),
        );
        expect(thrown).toBeInstanceOf(ConstraintError);

        // 🔴 the F22 claim, pinned: ONE value, and the two dialect guards
        //    disagree about it on purpose. `[t2]` pins the other half, so a
        //    reader sees the contrast in the `.snap` rather than across two
        //    `toEqual` lines forty lines apart.
        expect({
          contempSaysEnvelope: isLambdaEndpointErrorEnvelopeContemp(hybrid),
          ancientSaysEnvelope: isLambdaEndpointErrorEnvelopeAncient(hybrid),
          contempAssertClass: thrown.constructor.name,
        }).toMatchSnapshot();
      });
    });

    when('[t2] an ancient assert meets the same hybrid value', () => {
      then(
        'it matches by the flat pair — the wire ambiguity that STAYS (F19)',
        () => {
          // 🟡 the ancient dialect carries no tag, so a success output shaped
          //    `{ errorMessage: string, errorType: string }` is indistinguishable
          //    from a rejection — inherent to the ancient wire, not to this code.
          //    F22 makes CONTEMP exact; it cannot reach the ancient half, because
          //    that wire has no discriminator to stamp. clamped here as KNOWN.
          const hybrid = {
            error: 'a field of my own',
            errorMessage: 'the uuid names no known surfer',
            errorType: 'BadRequestError',
          };
          expect(isLambdaEndpointErrorEnvelopeAncient(hybrid)).toEqual(true);

          // 🔴 a KNOWN limit must be pinned, never merely asserted. `true` here
          //    is the ambiguity F19 records — so if a later round ever makes the
          //    ancient half exact, this snapshot goes red and sends the author
          //    to F19 to retire it, rather than admit a quiet `toEqual` flip.
          expect({
            ancientMatchesByFlatPair:
              isLambdaEndpointErrorEnvelopeAncient(hybrid),
            knownLimit: 'F19 — the ancient wire carries no tag to read',
          }).toMatchSnapshot();
        },
      );
    });
  });
});
