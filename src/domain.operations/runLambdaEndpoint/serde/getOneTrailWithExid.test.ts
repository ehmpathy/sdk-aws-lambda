import { getOneTrailWithExid } from './getOneTrailWithExid';

describe('getOneTrailWithExid', () => {
  test('keeps the caller exid when the trail holds one', () => {
    expect(getOneTrailWithExid({ trail: { exid: 'exid:caller' } })).toEqual({
      exid: 'exid:caller',
    });
  });

  const MINTED_CASES = [
    { description: 'a null trail', trail: null },
    { description: 'an undefined trail', trail: undefined },
    { description: 'a trail with no exid', trail: {} },
    { description: 'a trail with an empty exid', trail: { exid: '' } },
    { description: 'a trail with a null exid', trail: { exid: null } },
  ];

  MINTED_CASES.map((thisCase) =>
    test(`mints an exid for ${thisCase.description}`, () => {
      const result = getOneTrailWithExid({ trail: thisCase.trail });
      expect(result.exid).toMatch(/^exid:[0-9a-f-]{36}$/);
    }),
  );

  test('mints a distinct exid on each call', () => {
    const first = getOneTrailWithExid({ trail: null });
    const second = getOneTrailWithExid({ trail: null });
    expect(first.exid).not.toEqual(second.exid);
  });
});
