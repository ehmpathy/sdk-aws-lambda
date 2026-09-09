import { given, then, when } from 'test-fns';
import { z } from 'zod';

import { asApiGatewayResponseSchema } from './asApiGatewayResponseSchema';
import { isApiGatewayResponse } from './isApiGatewayResponse';

/**
 * .what = clamps what the exported response-envelope schema accepts and refuses
 *
 * .why = this builder is PUBLIC, so a consumer may parse against it outside `forApiGateway`
 *        entirely. its own doc-comment discloses that it accepts `{}` standalone — and a
 *        disclosure with no test is a claim, never a guarantee. these cases turn the prose
 *        into a clamp, so the day the seam changes, one of them goes red
 *
 * .note = `[case4]` asserts the DISCLOSED GAP rather than a desired behavior. it is green
 *         while the gap is present and goes red the moment zod can express an at-least-one
 *         refinement — which is exactly the signal the `.removal` note wants
 */
describe('asApiGatewayResponseSchema', () => {
  const schema = asApiGatewayResponseSchema({
    body: z.object({ salutation: z.string() }),
  });

  given('[case1] a full envelope', () => {
    when('[t0] it is parsed', () => {
      then('every field survives', () => {
        expect(
          schema.parse({
            status: 200,
            headers: { 'content-type': 'text/xml' },
            body: { salutation: 'aloha, kai' },
          }),
        ).toEqual({
          status: 200,
          headers: { 'content-type': 'text/xml' },
          body: { salutation: 'aloha, kai' },
        });
      });
    });
  });

  /**
   * .why = the three shapes this wish exists to make expressible. a schema that refused any
   *        one of them would block the capability at the validation step, with the type and
   *        the wire both correct — so each is clamped here, at the schema
   */
  given('[case2] each shape the wish requires', () => {
    when('[t0] a 204 with no body is parsed', () => {
      then('it passes with the body absent', () => {
        expect(schema.parse({ status: 204 })).toEqual({ status: 204 });
      });
    });

    when('[t1] a 308 with only a Location header is parsed', () => {
      then('it passes with no status-body pair', () => {
        expect(
          schema.parse({
            status: 308,
            headers: { Location: 'https://ehmpath.com/surf/pipeline' },
          }),
        ).toEqual({
          status: 308,
          headers: { Location: 'https://ehmpath.com/surf/pipeline' },
        });
      });
    });

    when('[t2] a body-only response is parsed', () => {
      then('it passes with the status absent', () => {
        expect(schema.parse({ body: { salutation: 'aloha' } })).toEqual({
          body: { salutation: 'aloha' },
        });
      });
    });
  });

  /**
   * .why = the builder's whole job is to guard the FIELD types; the at-least-one rule lives
   *        elsewhere. so a wrong field type must be refused, else the builder guards none of
   *        what it claims to
   */
  given('[case3] a field of the wrong type', () => {
    when('[t0] status is a string', () => {
      then('the parse is refused', () => {
        expect(() => schema.parse({ status: '204' })).toThrow();
      });
    });

    when('[t1] the body does not match the supplied body schema', () => {
      then('the parse is refused', () => {
        expect(() =>
          schema.parse({ body: { farewell: 'a hui hou' } }),
        ).toThrow();
      });
    });
  });

  /**
   * ⚠️ .what = THE DISCLOSED GAP, asserted rather than described
   *
   * .why = zod cannot express "at least one key present", so this schema's inferred shape is
   *        a superset of `ApiGatewayResponse` by exactly one member: `{}`. a consumer who
   *        treats a parse as the WHOLE check inherits no empty-response guard
   *
   * .why green means the gap is PRESENT = `[t0]` passes today. it goes RED when the seam
   *        closes, which is the signal `asApiGatewayResponseSchema`'s `.removal` note wants
   */
  given('[case4] an EMPTY response, against the schema standalone', () => {
    when('[t0] it is parsed directly, outside forApiGateway', () => {
      then(
        '⚠️ DISCLOSED GAP — it is ACCEPTED, so a parse is not the whole check',
        () => {
          expect(schema.parse({})).toEqual({});
        },
      );
    });

    /**
     * .what = the positive control for the gap above
     * .why = a disclosure that the schema is insufficient is only useful if the guard it
     *        points at actually refuses the same value. absent this, `[t0]` would read as
     *        "an empty response is fine everywhere"
     */
    when('[t1] the SAME value meets the guard forApiGateway uses', () => {
      then('it is refused loudly', () => {
        expect(() => isApiGatewayResponse.assure({})).toThrow();
      });
    });
  });
});
