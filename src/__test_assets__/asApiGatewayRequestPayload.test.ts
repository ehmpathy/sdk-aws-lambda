import { given, then, when } from 'test-fns';

import { asUnifiedApiGatewayEvent } from '../domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/asUnifiedApiGatewayEvent';
import { asApiGatewayRequestPayload } from './asApiGatewayRequestPayload';

/**
 * .what = clamps the SHAPE the wire harness builds for each payload version
 *
 * .why = the wire acceptance cases prove the round trip, and they ASSUME the envelope the
 *        harness hands over is the one aws actually delivers. that assumption is the part a
 *        wire assertion cannot state: a v2 envelope with the method at the wrong path would
 *        surface only as a downstream symptom — a 204 still emits a 204 — so the harness
 *        could be wrong in the exact way that matters and every wire case would stay green
 *
 * .why here rather than in the wire suite = this needs no credentials and no http, so it runs
 *        in the unit suite. review i023/r009 blocked because the wire cases were UNRUN behind
 *        an expired aws sso; this clamp raises the verified floor to the claim that is
 *        actually version-specific, and it holds whether or not that gate ever opens
 *
 * .note = the assertion runs the built payload through `asUnifiedApiGatewayEvent`, the sdk's
 *         own reconcile, rather than against a hand-written expected object. so it measures
 *         what the SDK reads out of the envelope — never merely what this file put in
 *         (rule.require.measure-the-value-you-emit)
 */
describe('asApiGatewayRequestPayload', () => {
  const request = {
    method: 'POST',
    url: '/voice?spot=pipeline',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'From=%2B15551234567&CallStatus=completed',
  };

  given('[case1] a v1 (rest-api) trigger', () => {
    const payload = asApiGatewayRequestPayload({ version: 'v1', ...request });

    when('[t0] the sdk reconciles it', () => {
      const unified = asUnifiedApiGatewayEvent({ payload });

      then('the method and path are read from the top level', () => {
        expect(unified.httpMethod).toBe('POST');
        expect(unified.path).toBe('/voice');
      });

      then('the query string is read', () => {
        expect(unified.queryStringParameters).toEqual({ spot: 'pipeline' });
      });

      then('a form body reaches the handler as the raw string', () => {
        expect(unified.body).toBe(request.body);
      });
    });
  });

  /**
   * .what = the same request, delivered as an http-api (payload format 2.0) event
   * .why = v2 is not a cosmetic variant: it moves the method and path under
   *        `requestContext.http` and drops `httpMethod`/`path` from the top level entirely.
   *        so THIS is the case that proves the harness's v2 envelope is real rather than a
   *        v1 object with a `version` field bolted on
   */
  given('[case2] a v2 (http-api) trigger', () => {
    const payload = asApiGatewayRequestPayload({ version: 'v2', ...request });

    when('[t0] the sdk reconciles it', () => {
      const unified = asUnifiedApiGatewayEvent({ payload });

      then('the method and path are read from requestContext.http', () => {
        expect(unified.httpMethod).toBe('POST');
        expect(unified.path).toBe('/voice');
      });

      then('the query string is read, as on v1', () => {
        expect(unified.queryStringParameters).toEqual({ spot: 'pipeline' });
      });

      then(
        'a form body reaches the handler as the raw string, as on v1',
        () => {
          expect(unified.body).toBe(request.body);
        },
      );
    });

    /**
     * .what = the envelope carries the v2 markers the sdk's version guard reads
     * .why = `asUnifiedApiGatewayEvent` picks its arm by those markers, so were they absent
     *        the reconcile would fall through to the v1 arm and [t0] would still pass — a
     *        probe whose null result looks like its positive result
     */
    when('[t1] the envelope itself is read', () => {
      then('it declares payload format 2.0', () => {
        expect((payload as { version?: string }).version).toBe('2.0');
      });

      then('it carries rawPath, which v1 has no field for', () => {
        expect((payload as { rawPath?: string }).rawPath).toBe('/voice');
      });

      then('it carries NO top-level httpMethod — the v1 field v2 drops', () => {
        expect((payload as { httpMethod?: string }).httpMethod).toBeUndefined();
      });
    });
  });
});
