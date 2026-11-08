import { given, then, when } from 'test-fns';

import { asLogLineMasked } from './asLogLineMasked';

describe('asLogLineMasked', () => {
  given('[case1] a failure line with every volatile field', () => {
    const line = {
      level: 'error',
      timestamp: '2026-11-07T17:00:00.000Z',
      message: 'handler.output',
      metadata: JSON.stringify({
        errorMessage:
          '💥 MalfunctionError: http://127.0.0.1:41234/notify answered, exid:8c1f0f3e-2d4b-4a6e-9f1a-3b2c1d0e9f8a',
        stackTrace:
          'MalfunctionError: the wave feed is down\n    at invoke (/home/kai/repo/src/a.ts:93:19)\n    at run (/home/kai/repo/src/b.ts:12:3)',
        headers: { date: 'Sat, 07 Nov 2026 17:00:00 GMT' },
      }),
      trail: { exid: '8c1f0f3e-2d4b-4a6e-9f1a-3b2c1d0e9f8a', stack: [] },
    };

    when('[t0] it is masked', () => {
      const masked = asLogLineMasked({ line });

      then('each volatile field is masked', () => {
        expect(masked).toEqual({
          level: 'error',
          timestamp: '<timestamp>',
          message: 'handler.output',
          metadata: {
            errorMessage:
              '💥 MalfunctionError: http://127.0.0.1:[port]/notify answered, exid:[masked]',
            stackTrace: 'MalfunctionError: the wave feed is down\n    at [frames]',
            headers: { date: '[date]' },
          },
          trail: { exid: '[uuid]', stack: [] },
        });
      });
    });
  });

  given('[case2] a line with no volatile field', () => {
    const line = {
      level: 'debug',
      timestamp: '2026-11-07T17:00:00.000Z',
      message: 'handler.output',
      metadata: JSON.stringify({ output: { salute: 'aloha, Kai' } }),
      trail: { exid: 'exid:browser-1', stack: [] },
    };

    when('[t0] it is masked', () => {
      const masked = asLogLineMasked({ line });

      then('only the timestamp moves; every other field is kept whole', () => {
        expect(masked).toEqual({
          ...line,
          timestamp: '<timestamp>',
          metadata: { output: { salute: 'aloha, Kai' } },
        });
      });
    });
  });
});
