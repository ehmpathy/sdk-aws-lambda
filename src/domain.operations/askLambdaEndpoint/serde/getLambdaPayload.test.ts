import { given, then, when } from 'test-fns';

import { getLambdaPayload } from './getLambdaPayload';

describe('getLambdaPayload', () => {
  given('[case1] event and trail provided', () => {
    when('[t0] transformed', () => {
      const result = getLambdaPayload({
        event: { uuid: 'order-123' },
        trail: { exid: 'exid:abc123' },
      });

      then('it should include the event', () => {
        expect(result.event).toEqual({ uuid: 'order-123' });
      });

      then('it should include trail with exid', () => {
        expect(result.trail).toEqual({ exid: 'exid:abc123' });
      });
    });
  });

  given('[case2] complex event object', () => {
    when('[t0] transformed', () => {
      const result = getLambdaPayload({
        event: {
          customerId: 'cust-456',
          items: [{ id: 'item-1', quantity: 2 }],
          metadata: { source: 'web' },
        },
        trail: { exid: 'exid:xyz789' },
      });

      then('it should preserve full event structure', () => {
        expect(result.event).toEqual({
          customerId: 'cust-456',
          items: [{ id: 'item-1', quantity: 2 }],
          metadata: { source: 'web' },
        });
      });

      then('it should include trail', () => {
        expect(result.trail.exid).toEqual('exid:xyz789');
      });
    });
  });

  given('[case3] event is empty object', () => {
    when('[t0] transformed', () => {
      const result = getLambdaPayload({
        event: {},
        trail: { exid: 'exid:empty' },
      });

      then('it should return empty event', () => {
        expect(result.event).toEqual({});
      });

      then('it should still include trail', () => {
        expect(result.trail.exid).toEqual('exid:empty');
      });
    });
  });
});
