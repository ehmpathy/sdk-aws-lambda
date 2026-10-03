import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';
import { asFrozenDeep } from 'type-fns';

import { getIsConstraintError } from './getIsConstraintError';
import { getIsFrozenMutatorRefusal } from './getIsFrozenMutatorRefusal';

/**
 * .what = the clamps on the freeze-refusal detector, and on the classifier that consults it
 * .why = the refusal wears `ConstraintError`, which this sdk reads as a caller fault. these cases
 *        pin both halves: the real refusal is recognized (so a handler defect is a server fault),
 *        and a handler's own `ConstraintError` is not (so a real caller fault stays one)
 */
describe('getIsFrozenMutatorRefusal', () => {
  /**
   * .what = observes the error a frozen value's mutator throws
   * .why = the subject is the real type-fns refusal, never a hand-built lookalike, so a type-fns
   *        release that reshapes it turns these cases red rather than leave the detector blind
   */
  const asRefusal = (input: { mutate: () => void }): Error => {
    try {
      input.mutate();
    } catch (error) {
      return error as Error;
    }
    throw new Error('the mutator call did not throw');
  };

  given('[case1] the refusal a frozen value raises', () => {
    const refusals = {
      Date: asRefusal({
        mutate: () => asFrozenDeep(new Date(0)).setFullYear(1999),
      }),
      Map: asRefusal({
        mutate: () =>
          (asFrozenDeep(new Map<string, number>()) as Map<string, number>).set(
            'a',
            1,
          ),
      }),
      Set: asRefusal({
        mutate: () => (asFrozenDeep(new Set<string>()) as Set<string>).add('a'),
      }),
    };

    when('[t0] the detector reads it', () => {
      then('each kind is recognized', () => {
        expect(getIsFrozenMutatorRefusal({ error: refusals.Date })).toBe(true);
        expect(getIsFrozenMutatorRefusal({ error: refusals.Map })).toBe(true);
        expect(getIsFrozenMutatorRefusal({ error: refusals.Set })).toBe(true);
      });
    });

    when('[t1] the classifier reads it', () => {
      then(
        'it is never a caller fault, though it wears ConstraintError',
        () => {
          // the positive control: the class IS the one the caller-fault arm keys on
          expect(refusals.Date.constructor.name).toEqual('ConstraintError');
          expect(getIsConstraintError({ error: refusals.Date })).toBe(false);
          expect(getIsConstraintError({ error: refusals.Map })).toBe(false);
          expect(getIsConstraintError({ error: refusals.Set })).toBe(false);
        },
      );
    });
  });

  given('[case2] a handler throws its own ConstraintError', () => {
    when('[t0] it carries no freeze metadata', () => {
      then('it stays a caller fault', () => {
        const error = new ConstraintError('unknown surf spot', {
          spot: 'x',
        });
        expect(getIsFrozenMutatorRefusal({ error })).toBe(false);
        expect(getIsConstraintError({ error })).toBe(true);
      });
    });

    when('[t1] it carries a coincident `kind` and `mutator`', () => {
      then(
        'it stays a caller fault, since its message names no refusal',
        () => {
          const error = new ConstraintError('a lesson kind is required', {
            kind: 'Lesson',
            mutator: 'book',
          });
          expect(getIsFrozenMutatorRefusal({ error })).toBe(false);
          expect(getIsConstraintError({ error })).toBe(true);
        },
      );
    });
  });

  given('[case3] a value that is not an error', () => {
    when('[t0] the detector reads it', () => {
      then('it returns false rather than throw', () => {
        expect(getIsFrozenMutatorRefusal({ error: null })).toBe(false);
        expect(getIsFrozenMutatorRefusal({ error: 'a frozen Date' })).toBe(
          false,
        );
      });
    });
  });
});
