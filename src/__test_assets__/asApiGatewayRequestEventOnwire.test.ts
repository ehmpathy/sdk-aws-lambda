import { given, then, when } from 'test-fns';

import { asApiGatewayRequestEventUnified } from '../domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/asApiGatewayRequestEventUnified';
import { asApiGatewayRequestEventOnwire } from './asApiGatewayRequestEventOnwire';

/**
 * .what = clamps the SHAPE the wire harness builds for each payload version
 *
 * .why = the wire acceptance cases assume the harness builds the envelope aws delivers. a v2
 *        envelope with the method at the wrong path would leave every wire case green. this
 *        needs no credentials or http, so it runs in the unit suite
 *
 * .note = each case runs the built payload through the sdk's own reconcile
 *         (`asApiGatewayRequestEventUnified`), so it measures what the sdk reads, not what this
 *         file wrote (rule.require.measure-the-value-you-emit)
 */
describe('asApiGatewayRequestEventOnwire', () => {
  const request = {
    method: 'POST',
    url: '/voice?spot=pipeline',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: 'From=%2B15551234567&CallStatus=completed',
  };

  given('[case1] a v1 (rest-api) trigger', () => {
    const wire = asApiGatewayRequestEventOnwire({ version: 'v1', ...request });

    when('[t0] the sdk reconciles it', () => {
      const unified = asApiGatewayRequestEventUnified({ wire });

      then('the method is read from the top level', () => {
        expect(unified.method).toBe('POST');
        expect(unified._.raw).toMatchObject({ path: '/voice' });
      });

      then('the query string is read', () => {
        expect(unified.params.query).toEqual({ spot: 'pipeline' });
      });

      then('a form body reaches the handler as the raw string', () => {
        expect(unified.payload).toBe(request.body);
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
    const wire = asApiGatewayRequestEventOnwire({ version: 'v2', ...request });

    when('[t0] the sdk reconciles it', () => {
      const unified = asApiGatewayRequestEventUnified({ wire });

      then('the method is read from requestContext.http', () => {
        expect(unified.method).toBe('POST');
        expect(unified._.raw.requestContext).toMatchObject({
          http: { path: '/voice' },
        });
      });

      then('the query string is read, as on v1', () => {
        expect(unified.params.query).toEqual({ spot: 'pipeline' });
      });

      then(
        'a form body reaches the handler as the raw string, as on v1',
        () => {
          expect(unified.payload).toBe(request.body);
        },
      );
    });

    /**
     * .what = the envelope carries the v2 markers the sdk's version guard reads
     * .why = `asApiGatewayRequestEventUnified` picks its arm by those markers, so were they absent
     *        the reconcile would fall through to the v1 arm and [t0] would still pass — a
     *        probe whose null result looks like its positive result
     */
    when('[t1] the envelope itself is read', () => {
      then('it declares payload format 2.0', () => {
        expect((wire as { version?: string }).version).toBe('2.0');
      });

      then('it carries rawPath, which v1 has no field for', () => {
        expect((wire as { rawPath?: string }).rawPath).toBe('/voice');
      });

      then('it carries NO top-level httpMethod — the v1 field v2 drops', () => {
        expect((wire as { httpMethod?: string }).httpMethod).toBeUndefined();
      });
    });
  });
});
