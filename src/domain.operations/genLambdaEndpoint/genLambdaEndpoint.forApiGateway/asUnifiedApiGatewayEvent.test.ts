import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getError, given, then, when } from 'test-fns';

import type { ApiGatewayRequestPayload } from '../../../domain.objects/ApiGatewayRequestPayload';
import { asUnifiedApiGatewayEvent } from './asUnifiedApiGatewayEvent';

/**
 * .what = builds a v1 proxy payload around one body value
 * .why = every case below varies only the body, so the rest of the envelope is noise
 */
const asV1PayloadWithBody = (input: {
  body: unknown;
  isBase64Encoded?: boolean;
}): ApiGatewayRequestPayload =>
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

describe('asUnifiedApiGatewayEvent', () => {
  given('[case1] a json body', () => {
    const payload = asV1PayloadWithBody({ body: '{"surfer":"kai"}' });

    when('[t0] deserialized', () => {
      then('the body reaches the handler as an object', () => {
        expect(asUnifiedApiGatewayEvent({ payload }).body).toEqual({
          surfer: 'kai',
        });
      });

      then('rawBody keeps the original string', () => {
        expect(asUnifiedApiGatewayEvent({ payload }).rawBody).toEqual(
          '{"surfer":"kai"}',
        );
      });
    });
  });

  given(
    '[case2] a form-encoded body — the twilio shape, which is NOT json',
    () => {
      const formBody = 'From=%2B15555550123&To=%2B15555550199';
      const payload = asV1PayloadWithBody({ body: formBody });

      when('[t0] deserialized', () => {
        then('the decoded string passes through rather than a throw', () => {
          // `JSON.parse` raises a SyntaxError here, which the transformer allowlists
          expect(asUnifiedApiGatewayEvent({ payload }).body).toEqual(formBody);
        });
      });
    },
  );

  given('[case3] a base64-flagged json body', () => {
    const payload = asV1PayloadWithBody({
      body: Buffer.from('{"spot":"pipeline"}').toString('base64'),
      isBase64Encoded: true,
    });

    when('[t0] deserialized', () => {
      then('it is decoded first, then parsed', () => {
        expect(asUnifiedApiGatewayEvent({ payload }).body).toEqual({
          spot: 'pipeline',
        });
      });
    });
  });

  given('[case4] deserialize.body disarmed', () => {
    const payload = asV1PayloadWithBody({ body: '{"surfer":"kai"}' });

    when('[t0] translated with deserialize.body false', () => {
      then('the body stays the untouched string', () => {
        expect(
          asUnifiedApiGatewayEvent(
            { payload },
            { deserialize: { body: false } },
          ).body,
        ).toEqual('{"surfer":"kai"}');
      });
    });
  });

  /**
   * .what = the clamp for the failhide three reviewers converged on (i003 r1/r4/r6)
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
    const payload = asV1PayloadWithBody({ body: poisoned });

    when('[t0] deserialized', () => {
      then('the unexpected error escapes rather than pass as a body', () => {
        const error = getError(() => asUnifiedApiGatewayEvent({ payload }));

        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toEqual('body is not a string');
      });
    });
  });

  given('[case6] a payload of neither version', () => {
    const payload = { hello: 'world' } as unknown as ApiGatewayRequestPayload;

    when('[t0] translated', () => {
      then('it fails loud rather than hand over a half shape', () => {
        const error = getError(() => asUnifiedApiGatewayEvent({ payload }));

        expect(error.message).toContain('neither v1 nor v2');
      });
    });
  });
});
