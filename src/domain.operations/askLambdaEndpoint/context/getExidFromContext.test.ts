import { given, then, when } from 'test-fns';

import { getExidFromContext } from './getExidFromContext';

describe('getExidFromContext', () => {
  given('[case1] log with trail exid', () => {
    when('[t0] exid exists in log.trail', () => {
      then('it should return the exid with source extracted', () => {
        const result = getExidFromContext({
          log: { trail: { exid: 'exid:abc123' } },
        });
        expect(result).toEqual({ exid: 'exid:abc123', source: 'extracted' });
      });
    });
  });

  given('[case2] log without trail', () => {
    when('[t0] trail is null', () => {
      then('it should generate new exid with source generated', () => {
        const result = getExidFromContext({ log: { trail: null } });
        expect(result.exid).toMatch(/^exid:[0-9a-f-]+$/);
        expect(result.source).toBe('generated');
      });
    });
  });

  given('[case3] no log provided', () => {
    when('[t0] log is null', () => {
      then('it should generate new exid with source generated', () => {
        const result = getExidFromContext({ log: null });
        expect(result.exid).toMatch(/^exid:[0-9a-f-]+$/);
        expect(result.source).toBe('generated');
      });
    });
  });

  given('[case4] trail with null exid', () => {
    when('[t0] trail.exid is null', () => {
      then('it should generate new exid with source generated', () => {
        const result = getExidFromContext({
          log: { trail: { exid: null } },
        });
        expect(result.exid).toMatch(/^exid:[0-9a-f-]+$/);
        expect(result.source).toBe('generated');
      });
    });
  });
});
