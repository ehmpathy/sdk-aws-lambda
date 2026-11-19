import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import {
  type LambdaEndpointRefusal,
  REFUSAL_DEFAULT,
  REFUSAL_PASSTHROUGH,
} from '../../../domain.objects/LambdaEndpointRefusal';
import { LambdaEndpointRefusedError } from '../../../domain.objects/LambdaEndpointRefusedError';
import { getIsConstraintError } from '../../genLambdaEndpoint/middleware/getIsConstraintError';
import { asErrorFromHttpResponse } from './asErrorFromHttpResponse';

const URL = 'https://api.example.com/notifications';
const EXID = 'exid:ord-7';

const CONTEMP_400 = {
  error: {
    _serde: 'LambdaEndpointError::contemp',
    class: 'ConstraintError',
    message: '✋ ConstraintError: payload.to is not an email',
  },
};

/**
 * .what = each answer, with the class it is thrown as under each opt
 * .why = a 4xx (save a 429, a throttle) is a refusal of a request this caller composed: by default the caller's own
 *        malfunction (`LambdaEndpointRefusedError`), and a `ConstraintError` only on opt-in.
 *        a 5xx is a `MalfunctionError` either way (sdk-aws-lambda#77)
 */
const TEST_CASES: Array<{
  description: string;
  given: { status: number; body: unknown };
  expect:
    | { kind: 'none' }
    | {
        kind: 'refusal' | 'malfunction';
        message: string;
        correlationId: string | null;
      };
}> = [
  {
    description: 'a 200 is no error',
    given: { status: 200, body: { sentTo: 'kai@example.com' } },
    expect: { kind: 'none' },
  },
  {
    description: 'a 3xx is no error: the redirect is the answer',
    given: { status: 302, body: null },
    expect: { kind: 'none' },
  },
  {
    description: 'a contemp 400 is a refusal with the unprefixed message',
    given: { status: 400, body: CONTEMP_400 },
    expect: {
      kind: 'refusal',
      message: 'payload.to is not an email',
      correlationId: null,
    },
  },
  {
    description:
      'a flat ancient 400 reads from the status alone: no compat arm',
    given: {
      status: 400,
      body: { errorMessage: 'bad', errorType: 'BadRequestError' },
    },
    expect: {
      kind: 'refusal',
      message: 'the endpoint answered http 400',
      correlationId: null,
    },
  },
  {
    description: 'a 404 with no body is a refusal from the status',
    given: { status: 404, body: null },
    expect: {
      kind: 'refusal',
      message: 'the endpoint answered http 404',
      correlationId: null,
    },
  },
  {
    description:
      'a redacted 500 is a MalfunctionError that holds the correlationId',
    given: {
      status: 500,
      body: {
        errorMessage: 'internal server error',
        errorType: 'InternalServiceError',
        correlationId: EXID,
      },
    },
    expect: {
      kind: 'malfunction',
      message: 'the endpoint answered http 500',
      correlationId: EXID,
    },
  },
  {
    description:
      'a contemp 500 is a MalfunctionError with the unprefixed envelope message',
    given: {
      status: 500,
      body: {
        error: {
          _serde: 'LambdaEndpointError::contemp',
          class: 'MalfunctionError',
          message: '💥 MalfunctionError: the template store is down',
        },
      },
    },
    expect: {
      kind: 'malfunction',
      message: 'the template store is down',
      correlationId: null,
    },
  },
  {
    description:
      'a 502 with a non-json body is a MalfunctionError from the status',
    given: { status: 502, body: null },
    expect: {
      kind: 'malfunction',
      message: 'the endpoint answered http 502',
      correlationId: null,
    },
  },
];

describe('asErrorFromHttpResponse', () => {
  given('[case1] a contemp 400 envelope', () => {
    when('[t0] the answer is cast', () => {
      then('the raw text is null, the message from the envelope', () => {
        const error = asErrorFromHttpResponse({
          status: 400,
          body: CONTEMP_400,
          text: JSON.stringify(CONTEMP_400),
          headers: {},
          url: URL,
          exid: EXID,
          refusal: REFUSAL_DEFAULT,
        });
        expect(error?.metadata?.text).toBeNull();
        expect(error?.message).toContain('payload.to is not an email');
      });

      then('the refusal names the url, its reason, and the opt-in', () => {
        const error = asErrorFromHttpResponse({
          status: 400,
          body: CONTEMP_400,
          text: JSON.stringify(CONTEMP_400),
          headers: {},
          url: URL,
          exid: EXID,
          refusal: REFUSAL_DEFAULT,
        });
        expect(error?.message).toContain(
          `${URL} refused the request: payload.to is not an email`,
        );
        expect(error?.message).toContain("refusal: { as: 'ConstraintError' }");
        expect(error?.metadata).toMatchObject({ errorType: 'ConstraintError' });
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case2] a 429 with no envelope', () => {
    when('[t0] the answer is cast under each opt', () => {
      then(
        'it is a throttle, never a refusal: a MalfunctionError under either opt, its retry-after kept',
        () => {
          const asThrottle = (input: { refusal: LambdaEndpointRefusal }) =>
            asErrorFromHttpResponse({
              status: 429,
              body: null,
              text: '',
              headers: { 'retry-after': '30' },
              url: URL,
              exid: EXID,
              refusal: input.refusal,
            });
          const errors = [
            asThrottle({ refusal: REFUSAL_DEFAULT }),
            asThrottle({ refusal: REFUSAL_PASSTHROUGH }),
          ];
          errors.map((error) => {
            expect(error).toBeInstanceOf(MalfunctionError);
            expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
            expect(getIsConstraintError({ error })).toBe(false);
            expect(error?.metadata?.headers).toEqual({ 'retry-after': '30' });
          });

          // the throttle's whole thrown shape, pinned; the opt does not touch it, so both opts match
          expect(errors[0]).toMatchSnapshot();
          expect(errors[1]?.message).toEqual(errors[0]?.message);
          expect(errors[1]?.metadata).toEqual(errors[0]?.metadata);
        },
      );
    });
  });

  given('[case3] a 429 with a contemp envelope', () => {
    when('[t0] the answer is cast', () => {
      then('it keeps the envelope message, still a throttle', () => {
        const body = {
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'MalfunctionError',
            message: '💥 MalfunctionError: rate limit hit for this caller',
          },
        };
        const error = asErrorFromHttpResponse({
          status: 429,
          body,
          text: JSON.stringify(body),
          headers: { 'retry-after': '5' },
          url: URL,
          exid: EXID,
          refusal: REFUSAL_DEFAULT,
        });
        expect(error).toBeInstanceOf(MalfunctionError);
        expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
        expect(error?.message).toContain('rate limit hit for this caller');
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case4] a 502 with a long html body', () => {
    when('[t0] the answer is cast', () => {
      then('the raw text rides the metadata, cut to a bound', () => {
        const error = asErrorFromHttpResponse({
          status: 502,
          body: null,
          text: `<html>${'x'.repeat(5000)}</html>`,
          headers: {},
          url: URL,
          exid: EXID,
          refusal: REFUSAL_DEFAULT,
        });
        expect(error?.metadata?.text).toHaveLength(1000);
        expect(String(error?.metadata?.text)).toContain('<html>');
      });
    });
  });

  given('[case5] a 404 with no envelope', () => {
    when('[t0] the answer is cast', () => {
      then('the refusal names the status as the peer verdict', () => {
        const error = asErrorFromHttpResponse({
          status: 404,
          body: null,
          text: '',
          headers: {},
          url: URL,
          exid: EXID,
          refusal: REFUSAL_DEFAULT,
        });
        expect(error).toBeInstanceOf(LambdaEndpointRefusedError);
        expect(error?.metadata).toMatchObject({ errorType: 'http 404' });
      });
    });
  });

  TEST_CASES.map((thisCase, index) =>
    given(`[case${index + 6}] ${thisCase.description}`, () => {
      const asError = (input: { refusal: LambdaEndpointRefusal }) =>
        asErrorFromHttpResponse({
          ...thisCase.given,
          // an absent body arrives as empty text, as fetch reads it, never as the string 'null'
          text:
            thisCase.given.body === null
              ? ''
              : JSON.stringify(thisCase.given.body),
          headers: {},
          url: URL,
          exid: EXID,
          refusal: input.refusal,
        });

      when('[t0] the answer is cast under the default opt', () => {
        then('it is thrown as the default class', () => {
          const error = asError({ refusal: REFUSAL_DEFAULT });

          if (thisCase.expect.kind === 'none') {
            expect(error).toBeNull();
            return;
          }

          // a refusal is a MalfunctionError of its own class; neither kind is a caller fault
          expect(error).toBeInstanceOf(MalfunctionError);
          expect(getIsConstraintError({ error })).toBe(false);
          if (thisCase.expect.kind === 'refusal')
            expect(error).toBeInstanceOf(LambdaEndpointRefusedError);
          if (thisCase.expect.kind === 'malfunction')
            expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
          expect(error?.message).toContain(thisCase.expect.message);
          expect(error?.metadata).toMatchObject({
            url: URL,
            status: thisCase.given.status,
            exid: EXID,
            correlationId: thisCase.expect.correlationId,
          });

          // the whole thrown error, so the message and verdict a caller reads are pinned per shape
          expect(error).toMatchSnapshot();
        });
      });

      when('[t1] the answer is cast under the pass-through opt', () => {
        then('it is thrown as the pass-through class', () => {
          const error = asError({ refusal: REFUSAL_PASSTHROUGH });

          if (thisCase.expect.kind === 'none') {
            expect(error).toBeNull();
            return;
          }

          // pass-through: a 4xx is a ConstraintError, as before; a 5xx is untouched by the opt
          expect(error).toBeInstanceOf(
            thisCase.expect.kind === 'refusal'
              ? ConstraintError
              : MalfunctionError,
          );
          expect(error).not.toBeInstanceOf(LambdaEndpointRefusedError);
          expect(error?.message).toContain(thisCase.expect.message);

          // the pass-through arm is a caller-visible contract too, so its thrown shape is pinned
          expect(error).toMatchSnapshot();
        });
      });
    }),
  );
});
