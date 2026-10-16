import { ConstraintError, MalfunctionError } from 'helpful-errors';

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

const TEST_CASES: Array<{
  description: string;
  given: { status: number; body: unknown };
  expect:
    | { kind: 'none' }
    | {
        kind: 'constraint' | 'malfunction';
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
    description:
      'a contemp 400 is a ConstraintError with the unprefixed message',
    given: { status: 400, body: CONTEMP_400 },
    expect: {
      kind: 'constraint',
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
      kind: 'constraint',
      message: 'the endpoint answered http 400',
      correlationId: null,
    },
  },
  {
    description: 'a 404 with no body is a ConstraintError from the status',
    given: { status: 404, body: null },
    expect: {
      kind: 'constraint',
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
  test('the raw text is null where the message came from the contemp envelope', () => {
    const error = asErrorFromHttpResponse({
      status: 400,
      body: CONTEMP_400,
      text: JSON.stringify(CONTEMP_400),
      headers: {},
      url: URL,
      exid: EXID,
    });
    expect(error?.metadata?.text).toBeNull();
    expect(error?.message).toContain('payload.to is not an email');
  });

  test('the response headers ride the metadata: a 429 keeps its retry-after', () => {
    const error = asErrorFromHttpResponse({
      status: 429,
      body: null,
      text: '',
      headers: { 'retry-after': '30' },
      url: URL,
      exid: EXID,
    });
    expect(error).toBeInstanceOf(ConstraintError);
    expect(error?.metadata?.headers).toEqual({ 'retry-after': '30' });
  });

  test('the raw text rides the metadata, cut to a bound', () => {
    const error = asErrorFromHttpResponse({
      status: 502,
      body: null,
      text: `<html>${'x'.repeat(5000)}</html>`,
      headers: {},
      url: URL,
      exid: EXID,
    });
    expect(error?.metadata?.text).toHaveLength(1000);
    expect(String(error?.metadata?.text)).toContain('<html>');
  });

  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      const error = asErrorFromHttpResponse({
        ...thisCase.given,
        text: JSON.stringify(thisCase.given.body),
        headers: {},
        url: URL,
        exid: EXID,
      });

      if (thisCase.expect.kind === 'none') {
        expect(error).toBeNull();
        return;
      }

      expect(error).toBeInstanceOf(
        thisCase.expect.kind === 'constraint'
          ? ConstraintError
          : MalfunctionError,
      );
      expect(error?.message).toContain(thisCase.expect.message);
      expect(error?.metadata).toMatchObject({
        url: URL,
        status: thisCase.given.status,
        exid: EXID,
        correlationId: thisCase.expect.correlationId,
      });
    }),
  );
});
