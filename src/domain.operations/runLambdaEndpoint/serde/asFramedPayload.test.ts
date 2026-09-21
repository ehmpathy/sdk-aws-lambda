import { given, then, when } from 'test-fns';

import { getIsWrappedPayload } from '../../lambdaEndpointWire/frame/getIsWrappedPayload';
import { asFramedPayload } from './asFramedPayload';

describe('asFramedPayload', () => {
  given('[case1] the contemp dialect', () => {
    when('[t0] the trail carries an exid', () => {
      then('the event is wrapped and the exid travels', () => {
        const result = asFramedPayload({
          event: { slug: 'abc' },
          trail: { exid: 'exid:123' },
          dialect: 'contemp',
        });
        expect(result).toEqual({
          event: { slug: 'abc' },
          trail: { exid: 'exid:123' },
        });
      });
    });

    when('[t1] the trail is null', () => {
      then('the wrapper still forms, with an empty trail', () => {
        // an absent exid is legal — genTrailMiddleware generates one, exactly
        // as it does for askLambdaEndpoint
        const result = asFramedPayload({
          event: { slug: 'abc' },
          trail: null,
          dialect: 'contemp',
        });
        expect(result).toEqual({ event: { slug: 'abc' }, trail: {} });
      });
    });

    when('[t2] the trail carries fields beyond the exid', () => {
      then('only the exid survives', () => {
        // must agree with what the wire emits (serde/getLambdaPayload.ts:9-12).
        // a `stack` that survived here would be dropped by the wire, so the two
        // boundaries would disagree.
        const result = asFramedPayload({
          event: { slug: 'abc' },
          trail: { exid: 'exid:123', stack: ['a', 'b'] } as {
            exid?: string;
          },
          dialect: 'contemp',
        });
        expect(result).toEqual({
          event: { slug: 'abc' },
          trail: { exid: 'exid:123' },
        });
      });
    });
  });

  given('[case2] the ancient dialect', () => {
    when('[t0] the event is framed', () => {
      then('the event crosses untouched', () => {
        const event = { slug: 'abc' };
        expect(
          asFramedPayload({ event, trail: null, dialect: 'ancient' }),
        ).toEqual(event);
      });
    });

    when('[t1] a trail is supplied anyway', () => {
      then('the trail does NOT travel', () => {
        // askLambdaEndpoint.ts:74-77 sends `input.event` and naught else on the
        // ancient dialect. a merged `{ ...event, trail }` would be backcompat no
        // caller in this sdk asks for.
        expect(
          asFramedPayload({
            event: { slug: 'abc' },
            trail: { exid: 'exid:123' },
            dialect: 'ancient',
          }),
        ).toEqual({ slug: 'abc' });
      });
    });
  });

  given(
    '[case3] the frame is what the endpoint reads to pick a dialect',
    () => {
      when('[t0] each dialect is framed and then detected', () => {
        then('the detected dialect matches the declared one', () => {
          // the claim the whole transformer rests on: the frame IS the
          // declaration. this asserts it against the real detector rather than
          // against a restatement of it.
          const event = { slug: 'abc' };
          const trail = { exid: 'exid:123' };
          expect(
            getIsWrappedPayload(
              asFramedPayload({ event, trail, dialect: 'contemp' }),
            ),
          ).toBe(true);
          expect(
            getIsWrappedPayload(
              asFramedPayload({ event, trail, dialect: 'ancient' }),
            ),
          ).toBe(false);
        });
      });
    },
  );
});
