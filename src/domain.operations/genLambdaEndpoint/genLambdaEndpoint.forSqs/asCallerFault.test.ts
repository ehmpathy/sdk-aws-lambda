import {
  BadRequestError,
  ConstraintError,
  MalfunctionError,
} from 'helpful-errors';

import { setEventFrozen } from '../setEventFrozen';
import { asCallerFault } from './asCallerFault';

class OrderWithdrawnError extends ConstraintError {}

/**
 * .what = the ConstraintError the invoke freeze raises when a handler mutates its frozen input
 * .why = it wears the caller-fault class, yet the fault is the handler's own, so it must redrive
 */
const genFrozenMutatorRefusal = (): unknown => {
  const frozen = setEventFrozen({ event: { at: new Date(0) } });
  try {
    frozen.at.setTime(1);
  } catch (error) {
    return error;
  }
  throw new Error(
    'the freeze did not refuse the mutator — the premise of this case',
  );
};

// the one answer both sqs variants decide delete-vs-redrive on
const TEST_CASES: {
  description: string;
  given: { error: unknown };
  expect: { isCallerFault: boolean };
}[] = [
  {
    description: 'a ConstraintError is a caller fault',
    given: { error: new ConstraintError('order withdrawn') },
    expect: { isCallerFault: true },
  },
  {
    description: 'a subclass of ConstraintError is a caller fault',
    given: { error: new OrderWithdrawnError('order withdrawn') },
    expect: { isCallerFault: true },
  },
  {
    description: 'a BadRequestError, the ancient peer class, is a caller fault',
    given: { error: new BadRequestError('order withdrawn') },
    expect: { isCallerFault: true },
  },
  {
    description: 'a MalfunctionError is not',
    given: { error: new MalfunctionError('upstream down') },
    expect: { isCallerFault: false },
  },
  {
    description: 'a raw Error is not',
    given: { error: new Error('the refine callback broke') },
    expect: { isCallerFault: false },
  },
  {
    description:
      'a plain object named ConstraintError is not — a claim is no class',
    given: { error: { name: 'ConstraintError', message: 'order withdrawn' } },
    expect: { isCallerFault: false },
  },
  {
    description:
      'a real Error named ConstraintError is — detection reads the in-process .name too',
    given: {
      error: Object.assign(new Error('order withdrawn'), {
        name: 'ConstraintError',
      }),
    },
    expect: { isCallerFault: true },
  },
  {
    description:
      'the invoke freeze refusal is not — it wears the class, but the fault is the handler',
    given: { error: genFrozenMutatorRefusal() },
    expect: { isCallerFault: false },
  },
  {
    description: 'a thrown string is not',
    given: { error: 'order withdrawn' },
    expect: { isCallerFault: false },
  },
];

describe('asCallerFault', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const callerFault = asCallerFault(thisCase.given);
      expect(callerFault !== null).toEqual(thisCase.expect.isCallerFault);
      if (thisCase.expect.isCallerFault)
        expect(callerFault).toBe(thisCase.given.error); // the same value, narrowed
    }),
  );
});
