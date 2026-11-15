import { given, then, when } from 'test-fns';

import { asRecordBodyParsed } from './asRecordBodyParsed';

describe('asRecordBodyParsed', () => {
  given('[case1] bodies the parse answers without a throw', () => {
    const cases = [
      { description: 'a json object', body: '{"a":1}', expected: { a: 1 } },
      { description: 'a json array', body: '[1,2]', expected: [1, 2] },
      {
        description: 'text that is not json',
        body: 'plain, text',
        expected: 'plain, text',
      },
      { description: 'an empty string', body: '', expected: null },
      { description: 'a null body', body: null, expected: null },
    ];

    cases.map((thisCase, index) =>
      when(`[t${index}] parsed — ${thisCase.description}`, () => {
        then('it answers the expected value', () => {
          expect(asRecordBodyParsed({ body: thisCase.body })).toEqual(
            thisCase.expected,
          );
        });
      }),
    );
  });

  given('[case2] a parse that throws aught but a SyntaxError', () => {
    when('[t0] parsed', () => {
      /**
       * .what = the clamp on the allowlist
       * .why = only a SyntaxError means "not json". any other throw is a defect, and a swallow
       *        would hand it to the handler as plain text (`rule.forbid.failhide`)
       * .note = the real `JSON.parse` throws here, never a mock: it calls `ToString` on its
       *         argument, and a body whose `toString` throws makes the parse throw a `TypeError`.
       *         `Reflect.apply` hands that body past the `string` type with no `as` cast
       */
      then('the throw escapes, unchanged', () => {
        const bodyThatFaults = {
          toString: () => {
            throw new TypeError('a defect, not a syntax fault');
          },
        };
        expect(() =>
          Reflect.apply(asRecordBodyParsed, null, [{ body: bodyThatFaults }]),
        ).toThrow('a defect, not a syntax fault');
      });
    });
  });
});
