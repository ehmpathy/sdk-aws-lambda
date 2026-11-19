import {
  BadRequestError,
  ConstraintError,
  MalfunctionError,
} from 'helpful-errors';
import { genContextLogTrail } from 'sdk-logs';
import { given, then, when } from 'test-fns';

import { LambdaEndpointRefusedError } from '../../../domain.objects/LambdaEndpointRefusedError';
import { asLogMethodOfFailure } from './asLogMethodOfFailure';

/**
 * .what = a real trail log, whose level methods are distinct functions
 * .why = the transformer returns one of them, so the pick is read by identity
 */
const LOG = genContextLogTrail({
  trail: { exid: 'exid:log-method-test', stack: [] },
  env: null,
}).log;

const TEST_CASES: Array<{
  description: string;
  given: { error: unknown };
  expect: { level: 'warn' | 'error' };
}> = [
  {
    description: 'a ConstraintError is a caller fault: warn',
    given: { error: new ConstraintError('payload.to is not an email') },
    expect: { level: 'warn' },
  },
  {
    description: 'a BadRequestError is a caller fault: warn',
    given: { error: new BadRequestError('payload.to is not an email') },
    expect: { level: 'warn' },
  },
  {
    description: 'a MalfunctionError is ours to fix: error',
    given: { error: new MalfunctionError('db unreachable') },
    expect: { level: 'error' },
  },
  {
    description: 'a peer refusal is ours to fix: error',
    given: {
      error: new LambdaEndpointRefusedError('svc refused the request', {}),
    },
    expect: { level: 'error' },
  },
  {
    description: 'a bare Error is ours to fix: error',
    given: { error: new Error('boom') },
    expect: { level: 'error' },
  },
  {
    description: 'a thrown non-error value is ours to fix: error',
    given: { error: 'a string' },
    expect: { level: 'error' },
  },
];

/**
 * .what = spies both failure levels of a sink, so a call can be read by level and by receiver
 * .why = the transformer returns a call, not a method; only a run of it shows which level it
 *        wrote and whether the method saw its own object as `this`
 */
const genSpiesOnSink = <TSink extends { warn: unknown; error: unknown }>(
  sink: TSink,
) => ({
  warn: jest
    .spyOn(sink as { warn: () => void }, 'warn')
    .mockImplementation(() => {}),
  error: jest
    .spyOn(sink as { error: () => void }, 'error')
    .mockImplementation(() => {}),
});

describe('asLogMethodOfFailure', () => {
  afterEach(() => jest.restoreAllMocks());

  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 1}] ${thisCase.description}`, () => {
      const levelOther = thisCase.expect.level === 'warn' ? 'error' : 'warn';

      when('[t0] the failure is written with a log', () => {
        then(
          'it writes to that log, at that level, with the log as receiver',
          () => {
            const spies = genSpiesOnSink(LOG);
            asLogMethodOfFailure({ error: thisCase.given.error, log: LOG })(
              'handler.output',
              { errorMessage: 'm' },
            );
            expect(spies[thisCase.expect.level]).toHaveBeenCalledWith(
              'handler.output',
              { errorMessage: 'm' },
            );
            expect(spies[thisCase.expect.level].mock.contexts[0]).toBe(LOG);
            expect(spies[levelOther]).not.toHaveBeenCalled();
          },
        );
      });

      when('[t1] the failure is written with no log', () => {
        then(
          'it writes to the console, at the same level, with console as receiver',
          () => {
            const spies = genSpiesOnSink(console);
            asLogMethodOfFailure({ error: thisCase.given.error, log: null })(
              'handler.output',
              { errorMessage: 'm' },
            );
            expect(spies[thisCase.expect.level]).toHaveBeenCalledWith(
              'handler.output',
              { errorMessage: 'm' },
            );
            expect(spies[thisCase.expect.level].mock.contexts[0]).toBe(console);
            expect(spies[levelOther]).not.toHaveBeenCalled();
          },
        );
      });
    }),
  );

  given(`[case${TEST_CASES.length + 1}] a real trail log, unspied`, () => {
    when('[t0] the method it was handed runs', () => {
      then('it does not throw', () => {
        // the receiver hazard bites only on the real implementation, so call it for real
        expect(() =>
          asLogMethodOfFailure({ error: new MalfunctionError('x'), log: LOG })(
            'handler.output',
            { errorMessage: 'x' },
          ),
        ).not.toThrow();
      });
    });
  });
});
