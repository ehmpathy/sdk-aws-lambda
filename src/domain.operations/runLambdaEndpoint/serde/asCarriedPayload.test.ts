import { given, then, when } from 'test-fns';

import { getIsWrappedPayload } from '../../lambdaEndpointWire/frame/getIsWrappedPayload';
import { asCarriedPayload } from './asCarriedPayload';

describe('asCarriedPayload', () => {
  given('[case1] the wrapper carrier', () => {
    when('[t0] contemp', () => {
      then('it is the framed wrapper, unchanged', () => {
        const result = asCarriedPayload({
          event: { slug: 'abc' },
          trail: { exid: 'exid:1' },
          dialect: 'contemp',
          carrier: 'wrapper',
        });
        expect(getIsWrappedPayload(result)).toEqual(true);
        expect(result).toEqual({
          event: { slug: 'abc' },
          trail: { exid: 'exid:1' },
        });
      });
    });

    when('[t1] ancient', () => {
      then('the event crosses untouched', () => {
        const event = { slug: 'abc' };
        expect(
          asCarriedPayload({
            event,
            trail: null,
            dialect: 'ancient',
            carrier: 'wrapper',
          }),
        ).toBe(event);
      });
    });
  });

  given('[case2] the headers carrier', () => {
    const v1 = {
      httpMethod: 'POST',
      headers: { Accept: 'application/json' },
      multiValueHeaders: { Accept: ['application/json'] },
      body: null,
    };

    when('[t0] contemp, on a v1 event', () => {
      const result = asCarriedPayload({
        event: v1,
        trail: { exid: 'exid:ord-7' },
        dialect: 'contemp',
        carrier: 'headers',
      }) as typeof v1 & { headers: Record<string, string> };

      then('the header rides the headers bag, beside the extant keys', () => {
        expect(result.headers).toEqual({
          Accept: 'application/json',
          'x-trail-exid': 'exid:ord-7',
        });
      });

      then('the multi-value twin carries it too', () => {
        expect(result.multiValueHeaders).toEqual({
          Accept: ['application/json'],
          'x-trail-exid': ['exid:ord-7'],
        });
      });

      then('the event is never wrapped, and the input is not mutated', () => {
        expect(getIsWrappedPayload(result)).toEqual(false);
        expect(v1.headers).toEqual({ Accept: 'application/json' });
      });
    });

    when('[t1] contemp, on a v2 event with no multi-value twin', () => {
      const result = asCarriedPayload({
        event: { version: '2.0', headers: {} },
        trail: { exid: 'exid:2' },
        dialect: 'contemp',
        carrier: 'headers',
      });

      then('only headers gain the key', () => {
        expect(result).toEqual({
          version: '2.0',
          headers: { 'x-trail-exid': 'exid:2' },
        });
      });
    });

    when('[t2] ancient', () => {
      then('the event crosses untouched: the sdk adds no opt-in', () => {
        expect(
          asCarriedPayload({
            event: v1,
            trail: { exid: 'exid:3' },
            dialect: 'ancient',
            carrier: 'headers',
          }),
        ).toBe(v1);
      });
    });

    when('[t2b] ancient, on an event that already holds the key', () => {
      then('the key stays: it is the opt-in its caller placed', () => {
        const event = { headers: { 'x-trail-exid': 'exid:set', accept: 'a' } };
        expect(
          asCarriedPayload({
            event,
            trail: { exid: 'exid:3' },
            dialect: 'ancient',
            carrier: 'headers',
          }),
        ).toBe(event);
      });
    });

    when(
      '[t2d] contemp, with no trail given, on an event whose header holds an exid',
      () => {
        const result = asCarriedPayload({
          event: { headers: { 'x-trail-exid': 'exid:declared-by-hand' } },
          trail: null,
          dialect: 'contemp',
          carrier: 'headers',
        }) as { headers: Record<string, string> };

        then('the exid the event holds is kept: it was declared', () => {
          expect(result.headers['x-trail-exid']).toEqual(
            'exid:declared-by-hand',
          );
        });
      },
    );

    when('[t2c] contemp, with no trail given', () => {
      const result = asCarriedPayload({
        event: { headers: {} },
        trail: null,
        dialect: 'contemp',
        carrier: 'headers',
      }) as { headers: Record<string, string> };

      then(
        'an exid is generated, since a header holds a value or no opt-in',
        () => {
          expect(result.headers['x-trail-exid']).toMatch(/^exid:/);
        },
      );
    });

    when(
      '[t3] contemp, on an event that already holds the key in another case',
      () => {
        const event = {
          headers: { 'X-Trail-Exid': 'exid:stale', Accept: 'a' },
          multiValueHeaders: { 'X-TRAIL-EXID': ['exid:stale'], Accept: ['a'] },
        };
        const result = asCarriedPayload({
          event,
          trail: { exid: 'exid:fresh' },
          dialect: 'contemp',
          carrier: 'headers',
        });

        // a bag that held both variants, joined by an http client, would read `exid:stale, exid:fresh`
        then('every variant is dropped, so the sdk key is the only one', () => {
          expect(result).toEqual({
            headers: { Accept: 'a', 'x-trail-exid': 'exid:fresh' },
            multiValueHeaders: {
              Accept: ['a'],
              'x-trail-exid': ['exid:fresh'],
            },
          });
        });
      },
    );

    when('[t4] contemp, on a value that is not an event', () => {
      then('it refuses, since the header bags cannot be read', () => {
        expect(() =>
          asCarriedPayload({
            event: 'not an event',
            trail: { exid: 'exid:1' },
            dialect: 'contemp',
            carrier: 'headers',
          }),
        ).toThrow();
      });
    });
  });
});
