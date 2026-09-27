import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getError, given, then, when } from 'test-fns';

import type { ApiGatewayOnwireVersion } from '../../../__test_assets__/asApiGatewayRequestEventOnwire';
import { asApiGatewayRequestEventOnwire } from '../../../__test_assets__/asApiGatewayRequestEventOnwire';
import type { ApiGatewayRequestEventOnwire } from '../../../domain.objects/ApiGatewayRequestEventOnwire';
import { asApiGatewayRequestEventUnified } from './asApiGatewayRequestEventUnified';

/**
 * .what = builds a v1 proxy wire event around one body value
 * .why = every case below varies only the body, so the rest of the envelope is noise
 */
const asV1OnwireWithBody = (input: {
  body: unknown;
  isBase64Encoded?: boolean;
}): ApiGatewayRequestEventOnwire =>
  ({
    httpMethod: 'POST',
    path: '/webhook',
    body: input.body,
    headers: {},
    queryStringParameters: null,
    pathParameters: null,
    isBase64Encoded: input.isBase64Encoded ?? false,
    requestContext: { requestId: 'req-1' },
  }) as unknown as APIGatewayProxyEvent;

describe('asApiGatewayRequestEventUnified', () => {
  given('[case1] a json body', () => {
    const wire = asV1OnwireWithBody({ body: '{"surfer":"kai"}' });

    when('[t0] deserialized', () => {
      then('the body reaches the handler as an object', () => {
        expect(asApiGatewayRequestEventUnified({ wire }).payload).toEqual({
          surfer: 'kai',
        });
      });

      /**
       * .why `_.raw.body` = the envelope carries no `rawPayload` of its own. the untouched
       *      wire string was never a second value — it is the one the wire delivered, and
       *      `_.raw` is where an un-reconciled wire value lives
       */
      then('the untouched string stays reachable at `_.raw`', () => {
        expect(asApiGatewayRequestEventUnified({ wire })._.raw.body).toEqual(
          '{"surfer":"kai"}',
        );
      });
    });
  });

  given(
    '[case2] a form-encoded body — the twilio shape, which is NOT json',
    () => {
      const formBody = 'From=%2B15555550123&To=%2B15555550199';
      const wire = asV1OnwireWithBody({ body: formBody });

      when('[t0] deserialized', () => {
        then('the decoded string passes through rather than a throw', () => {
          // `JSON.parse` raises a SyntaxError here, which the transformer allowlists
          expect(asApiGatewayRequestEventUnified({ wire }).payload).toEqual(
            formBody,
          );
        });
      });
    },
  );

  given('[case3] a base64-flagged json body', () => {
    const wire = asV1OnwireWithBody({
      body: Buffer.from('{"spot":"pipeline"}').toString('base64'),
      isBase64Encoded: true,
    });

    when('[t0] deserialized', () => {
      then('it is decoded first, then parsed', () => {
        expect(asApiGatewayRequestEventUnified({ wire }).payload).toEqual({
          spot: 'pipeline',
        });
      });
    });
  });

  given('[case4] deserialize.body disarmed', () => {
    const wire = asV1OnwireWithBody({ body: '{"surfer":"kai"}' });

    when('[t0] translated with deserialize.body false', () => {
      then('the body stays the untouched string', () => {
        expect(
          asApiGatewayRequestEventUnified(
            { wire },
            { deserialize: { payload: false } },
          ).payload,
        ).toEqual('{"surfer":"kai"}');
      });
    });
  });

  /**
   * .what = the clamp for the failhide at the body parse
   * .why = a bare `catch` around `JSON.parse` swallows EVERY error, so a defect that raises a
   *        TypeError would have been returned to the handler as if it were a caller's form
   *        body — a code defect disguised as valid input (rule.forbid.failhide)
   *
   * .note = this goes RED without the `instanceof SyntaxError` allowlist: the bare catch
   *         returns the poisoned value and no error escapes. verified by revert
   *         (rule.require.clamp-edge-cases)
   */
  given('[case5] a body that is not the string its type declares', () => {
    const poisoned = {
      toString: () => {
        throw new TypeError('body is not a string');
      },
    };
    const wire = asV1OnwireWithBody({ body: poisoned });

    when('[t0] deserialized', () => {
      then('the unexpected error escapes rather than pass as a body', () => {
        const error = getError(() => asApiGatewayRequestEventUnified({ wire }));

        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toEqual('body is not a string');
      });
    });
  });

  given('[case6] a wire of neither version', () => {
    const wire = { hello: 'world' } as unknown as ApiGatewayRequestEventOnwire;

    when('[t0] translated', () => {
      then('it fails loud rather than hand over a half shape', () => {
        const error = getError(() => asApiGatewayRequestEventUnified({ wire }));

        expect(error.message).toContain('neither v1 nor v2');
      });
    });
  });

  /**
   * .what = the clamp for the case-fold — fulcrum F08
   * .why = rfc 9110 §5.1 makes http field names case-insensitive, and every runtime in this path
   *        already lowercases (node, express, api gateway v2). a verbatim passthrough would make
   *        `headers['Authorization']` and `headers['authorization']` two different keys
   *
   * .note = it goes RED both ways without `asHeaderKeysLowercased`: the lowercased read returns
   *         `undefined` and the capitalized read returns the value — the exact inverse of every
   *         assertion below (rule.require.clamp-edge-cases)
   *
   * .what this does NOT prove = that aws delivers a different case per version. the fixture
   *         hands ONE header object to both arms, so it cannot vary case by arm. that claim stays
   *         unprovable in this repo — and the fold is what makes it stop to matter, since the
   *         sdk's emitted case no longer depends on the answer
   */
  given('[case7] a capitalized header key, on either version arm', () => {
    const headers = { 'X-Signature': 'abc', Authorization: 'Bearer tok' };

    /**
     * .note = the SHARED builder, never a hand-rolled event literal. two reasons, and the
     *         second is the one that bites later:
     *
     *         - a literal needs an `as unknown as ApiGatewayRequestEventOnwire` per arm, since aws
     *           declares ~15 `requestContext` fields this case has no use for. the builder
     *           carries that cast ONCE, with its `.as` / `.removal` pair (rule.forbid.as-cast)
     *         - a literal is a SECOND way to build a wire event, so the day the v2 shape gains
     *           a field the sdk reads, the builder learns it and this case does not
     *           (rule.forbid.parallel-codepaths)
     */
    const asOnwire = (version: ApiGatewayOnwireVersion) =>
      asApiGatewayRequestEventOnwire({
        version,
        method: 'POST',
        url: '/webhook',
        headers,
        body: '',
      });

    when('[t0] a v1 rest-api event is reconciled', () => {
      const event = asApiGatewayRequestEventUnified({ wire: asOnwire('v1') });

      then('the key reads lowercased', () => {
        expect(event.headers['x-signature']).toEqual('abc');
        expect(event.headers.authorization).toEqual('Bearer tok');
      });

      then('the wire capitalization is GONE from the bag', () => {
        expect(event.headers['X-Signature']).toEqual(undefined);
        expect(event.headers.Authorization).toEqual(undefined);
      });

      then('the wire form survives at `_.raw`, for whoever needs it', () => {
        expect(
          (event._.raw as { headers: Record<string, string> }).headers,
        ).toEqual(headers);
      });
    });

    when('[t1] a v2 http-api event is reconciled', () => {
      const event = asApiGatewayRequestEventUnified({ wire: asOnwire('v2') });

      then('the fold lands identically — one behavior, both arms', () => {
        expect(event.headers['x-signature']).toEqual('abc');
        expect(event.headers['X-Signature']).toEqual(undefined);
      });
    });

    /**
     * .what = the whole folded bag, both arms, as one pair
     * .why = the five assertions above each name one key, so a key the fold added, dropped, or
     *        mangled is invisible to every one of them. that is the allowlist failure mode a
     *        denylist snapshot exists to close
     *        (`rule.require.snapshots-deny-volatile-not-allow-expected`)
     * .note = a pair on purpose, exactly as `forApiGateway [case19][t2]`. `[t1]`'s whole claim
     *         is that the two arms fold identically, and two separate snapshots would each stay
     *         green while the arms drifted apart — the pair cannot
     *
     * .to check it bites = edit the v2 arm's keys in the `.snap` to `Authorization` /
     *         `X-Signature` — the verbatim passthrough this fold replaced — and re-run without
     *         `--resnap`. this test goes red, alone among the 12 in this file
     *         (rule.require.clamp-edge-cases)
     */
    when('[t2] the two folded bags are set side by side', () => {
      then('both bags match snapshot, as a pair', () => {
        expect({
          v1: asApiGatewayRequestEventUnified({ wire: asOnwire('v1') }).headers,
          v2: asApiGatewayRequestEventUnified({ wire: asOnwire('v2') }).headers,
        }).toMatchSnapshot();
      });
    });
  });
});
