import { MalfunctionError, UnexpectedCodePathError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { getIsConstraintError } from '../../genLambdaEndpoint/middleware/getIsConstraintError';
import { asLambdaEndpointRefusal } from './asLambdaEndpointRefusal';

const TEST_CASES_HONORED: Array<{
  description: string;
  given: { declared: unknown };
  expect: { as: 'ConstraintError' | 'LambdaEndpointRefusedError' };
}> = [
  {
    description: 'absent is the default: the asker composed the request',
    given: { declared: undefined },
    expect: { as: 'LambdaEndpointRefusedError' },
  },
  {
    description: 'null is the default too',
    given: { declared: null },
    expect: { as: 'LambdaEndpointRefusedError' },
  },
  {
    description: 'the default named explicitly is honored',
    given: { declared: { as: 'LambdaEndpointRefusedError' } },
    expect: { as: 'LambdaEndpointRefusedError' },
  },
  {
    description: 'pass-through is honored',
    given: { declared: { as: 'ConstraintError' } },
    expect: { as: 'ConstraintError' },
  },
];

const TEST_CASES_REFUSED: Array<{
  description: string;
  given: { declared: unknown };
}> = [
  {
    description: 'a miscased class name',
    given: { declared: { as: 'constraintError' } },
  },
  {
    description: 'an unknown class name',
    given: { declared: { as: 'Error' } },
  },
  { description: 'an object with no `as`', given: { declared: {} } },
  { description: 'a bare string', given: { declared: 'ConstraintError' } },
  { description: 'a boolean', given: { declared: true } },
];

describe('asLambdaEndpointRefusal', () => {
  given('[case1] an opt this sdk can honor', () => {
    TEST_CASES_HONORED.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.description}`, () => {
        then('the opt is honored', () => {
          expect(asLambdaEndpointRefusal(thisCase.given)).toEqual(
            thisCase.expect,
          );
        });
      }),
    );
  });

  given('[case2] an opt this sdk cannot honor', () => {
    TEST_CASES_REFUSED.map((thisCase, index) =>
      when(`[t${index}] ${thisCase.description}`, () => {
        then('the opt is refused as a defect of the asker', async () => {
          const error = await getError(async () =>
            asLambdaEndpointRefusal(thisCase.given),
          );
          // the asker's own defect: never a class its chain answers as its caller's fault
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(error).toBeInstanceOf(UnexpectedCodePathError);
          expect(getIsConstraintError({ error })).toEqual(false);
          // the header a human reads names its class behind its glyph
          expect(error.message).toMatch(
            /^💥 MalfunctionError: the refusal opt given/,
          );
          expect(error).toMatchObject({
            metadata: { declared: thisCase.given.declared },
          });
        });
      }),
    );

    when(`[t${TEST_CASES_REFUSED.length}] the refusal is read`, () => {
      then('it names both options and the fix', async () => {
        const error = await getError(async () =>
          asLambdaEndpointRefusal({ declared: { as: 'constraintError' } }),
        );
        expect(error).toMatchSnapshot();
      });
    });
  });
});
