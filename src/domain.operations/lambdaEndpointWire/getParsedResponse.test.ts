import { BadRequestError, getError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { LambdaEndpointError } from '../../domain.objects/LambdaEndpointError';
import { asLambdaEndpoint } from '../asLambdaEndpoint/asLambdaEndpoint';
import { getParsedResponse } from './getParsedResponse';

const toPayload = (obj: unknown): Uint8Array =>
  new TextEncoder().encode(JSON.stringify(obj));

describe('getParsedResponse', () => {
  given('[case1] valid response payload', () => {
    when('[t0] parsed', () => {
      const result = getParsedResponse<{ data: string }>({
        payload: toPayload({ data: 'hello' }),
        functionError: undefined,
        endpoint: asLambdaEndpoint({
          service: 'svc-orders',
          access: 'prep',
          function: 'getOrder',
        }),
        exid: 'exid:abc123',
      });

      then('it should return parsed response', () => {
        expect(result).toEqual({ data: 'hello' });

        // the success shape is caller-visible too — a field added or a wrap
        // introduced passes every `toEqual` above and every negative snapshot
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case2] payload is undefined', () => {
    when('[t0] parsed', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: undefined,
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include empty payload message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: undefined,
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('empty payload');
      });

      then('it should match snapshot', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: undefined,
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case3] payload is invalid json', () => {
    when('[t0] parsed', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: new TextEncoder().encode('not json'),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include invalid json message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: new TextEncoder().encode('not json'),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('invalid json');
      });

      then('it should match snapshot', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: new TextEncoder().encode('not json'),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case4] payload contains error response', () => {
    when('[t0] parsed with errorMessage', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include the error message', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error.message).toContain('something went wrong');
      });

      then('it should include errorType in metadata', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.errorType).toEqual('ValidationError');
      });

      then('it should include stackTrace in metadata', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.stackTrace).toContain('at handler');
      });

      then('it should match snapshot', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'something went wrong',
              errorType: 'ValidationError',
              stackTrace: ['at handler', 'at process'],
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: 'exid:abc123',
          }),
        );
        expect(error).toMatchSnapshot();
      });
    });

    when('[t1] parsed with errorMessage only', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'minimal error',
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: null,
          }),
        );
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should handle null exid', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'minimal error',
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: null,
          }),
        );
        const lambdaError = error as LambdaEndpointError;
        expect(lambdaError.metadata.exid).toBeNull();
      });

      then('it should match snapshot', async () => {
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'minimal error',
            }),
            functionError: undefined,
            endpoint: asLambdaEndpoint({
              service: 'svc-orders',
              access: 'prep',
              function: 'getOrder',
            }),
            exid: null,
          }),
        );
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case5] complex nested response', () => {
    when('[t0] parsed', () => {
      const result = getParsedResponse<{
        user: { id: string; email: string };
        items: string[];
      }>({
        payload: toPayload({
          user: { id: 'user-123', email: 'test@example.com' },
          items: ['a', 'b', 'c'],
        }),
        functionError: undefined,
        endpoint: asLambdaEndpoint({
          service: 'svc-users',
          access: 'prep',
          function: 'getUser',
        }),
        exid: 'exid:xyz',
      });

      then('it should preserve nested structure', () => {
        expect(result.user.id).toEqual('user-123');
        expect(result.items).toEqual(['a', 'b', 'c']);

        // 🔴 the field-by-field reads above cannot catch an ADDED field or a
        //    wrap around the whole shape — the snapshot is what pins the WHOLE
        expect(result).toMatchSnapshot();
      });
    });
  });

  given('[case6] BadRequestError response with validation details', () => {
    const parseWithBadRequest = () =>
      getParsedResponse({
        payload: toPayload({
          errorMessage: 'validation failed',
          errorType: 'BadRequestError',
          stackTrace: 'at handler',
          details: {
            issues: [
              {
                path: 'email',
                message: 'invalid email',
                code: 'invalid_string',
              },
            ],
          },
          causeMessage: 'zod validation failed',
        }),
        functionError: undefined,
        endpoint: asLambdaEndpoint({
          service: 'svc-users',
          access: 'prep',
          function: 'createUser',
        }),
        exid: 'exid:abc123',
      });

    when('[t0] parsed with errorType BadRequestError', () => {
      then('it should throw BadRequestError', async () => {
        const error = await getError(parseWithBadRequest);
        expect(error).toBeInstanceOf(BadRequestError);
      });

      then('it should include validation details in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        expect(error.metadata).toHaveProperty('details');
        expect((error.metadata as { details: unknown }).details).toEqual({
          issues: [
            { path: 'email', message: 'invalid email', code: 'invalid_string' },
          ],
        });
      });

      then('it should include causeMessage in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        expect(
          (error.metadata as { causeMessage: string }).causeMessage,
        ).toEqual('zod validation failed');
      });

      then('it should include endpoint in metadata', async () => {
        const error = (await getError(parseWithBadRequest)) as BadRequestError;
        const endpoint = (
          error.metadata as { endpoint: { service: string; function: string } }
        ).endpoint;
        expect(endpoint.service).toEqual('svc-users');
        expect(endpoint.function).toEqual('createUser');
      });

      /**
       * 🔴 .the `errorType` asymmetry, pinned as INTENDED rather than left unsaid
       *
       * this branch drops `errorType`; the `LambdaEndpointError` branch keeps it:
       *
       * | envelope `errorType` | thrown as | `metadata.errorType` |
       * |---|---|---|
       * | `BadRequestError` / `ConstraintError` | `BadRequestError` | 🔴 **absent** (`getParsedResponse.ts:92-97`) |
       * | every other value | `LambdaEndpointError` | ✅ present (`:101-107`) |
       *
       * ⇒ **deliberate, because the CLASS already encodes it.** this branch READ
       *   `errorType` to pick which class to throw, so the fact is promoted from
       *   metadata into the type. the other branch throws one generic class for
       *   every value it does not name, so its class cannot express it and its
       *   metadata must.
       *
       * ⚠️ **and there is a real loss, which this assertion pins rather than
       *    hides**: an ancient caller's `'BadRequestError'` and a contemp caller's
       *    `'ConstraintError'` both hydrate here, so the DIALECT the server
       *    answered in is not recoverable from the thrown error.
       *
       *    that is correct by `rule.require.contemp-contracts-default` — the wire
       *    envelope keeps the ancient word (`invariant.ancient-vs-contemp-callers`),
       *    and the sdk normalizes what it hands its own caller. the compat
       *    guarantee is about the BYTES, never about the hydrated error.
       *
       * .note = the absence of this assertion is what let the asymmetry read as
       *   accidental, which is part of why `askLambdaEndpointAncient.ts` stays
       *   alive as a second raw-wire fixture (F17). clamped, it is a decision
       *   rather than a workaround.
       */
      then(
        'metadata carries NO errorType — the class already said it',
        async () => {
          const error = (await getError(
            parseWithBadRequest,
          )) as BadRequestError;
          expect(
            (error.metadata as Record<string, unknown>).errorType,
          ).toBeUndefined();
        },
      );

      then('it should match snapshot', async () => {
        const error = await getError(parseWithBadRequest);
        expect(error).toMatchSnapshot();
      });
    });
  });

  given('[case7] LambdaEndpointError with details', () => {
    const parseWithDatabaseError = () =>
      getParsedResponse({
        payload: toPayload({
          errorMessage: 'internal error',
          errorType: 'DatabaseError',
          stackTrace: 'at query',
          details: { table: 'users', operation: 'insert' },
          causeMessage: 'connection timeout',
        }),
        functionError: undefined,
        endpoint: asLambdaEndpoint({
          service: 'svc-users',
          access: 'prep',
          function: 'createUser',
        }),
        exid: 'exid:xyz789',
      });

    when('[t0] parsed with error details', () => {
      then('it should throw LambdaEndpointError', async () => {
        const error = await getError(parseWithDatabaseError);
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('it should include details in metadata', async () => {
        const error = (await getError(
          parseWithDatabaseError,
        )) as LambdaEndpointError;
        expect(error.metadata.details).toEqual({
          table: 'users',
          operation: 'insert',
        });
      });

      then('it should include causeMessage in metadata', async () => {
        const error = (await getError(
          parseWithDatabaseError,
        )) as LambdaEndpointError;
        expect(error.metadata.causeMessage).toEqual('connection timeout');
      });

      // ⇒ the OTHER half of the `errorType` asymmetry clamped at `[case6][t0]`.
      //   this class is generic over every type it does not name, so it cannot
      //   encode the type and its metadata must carry it.
      //
      //   🔴 the pair is what makes either assertion meaningful: alone, each reads
      //   as an arbitrary field list. together they state the RULE — the metadata
      //   carries `errorType` exactly when the class cannot.
      then('metadata DOES carry errorType — the class cannot', async () => {
        const error = (await getError(
          parseWithDatabaseError,
        )) as LambdaEndpointError;
        expect(error.metadata.errorType).toEqual('DatabaseError');
      });

      then('it should match snapshot', async () => {
        const error = await getError(parseWithDatabaseError);
        expect(error).toMatchSnapshot();
      });
    });
  });

  /**
   * 🔴 aws's own verdict. `functionError` holds `'Unhandled'` or `'Handled'`,
   * and every branch above classifies by payload SHAPE — so absent this read a
   * fault aws reported, whose payload matched neither envelope, reaches the
   * caller as a SUCCESS (`rule.forbid.failhide`, on a wire boundary).
   *
   * ⚠️ the rule is a CONJUNCTION, which is why it takes four cases: a check on
   *    `functionError` alone breaks the local locus; one on shape alone is the
   *    defect.
   */
  given('[case8] aws reported a function error', () => {
    const endpoint = asLambdaEndpoint({
      service: 'svc-orders',
      access: 'prep',
      function: 'getOrder',
    });

    when('[t0] the payload matches NEITHER error envelope', () => {
      // the reachable shape: a runtime that died without aws's standard
      // `{ errorMessage, errorType }` body, or a handler whose fault payload
      // is its own. aws still flags the invocation.
      const parseUnrecognized = () =>
        getParsedResponse({
          payload: toPayload({ someOtherShape: true }),
          functionError: 'Unhandled',
          endpoint,
          exid: 'exid:abc123',
        });

      then('it throws rather than returns the fault as a success', async () => {
        const error = await getError(parseUnrecognized);
        expect(error).toBeInstanceOf(LambdaEndpointError);
      });

      then('the error carries aws verdict and the raw payload', async () => {
        // rule.require.errors-name-the-fix — the author cannot read the shape
        // off the message, so the payload rides in metadata or it is lost.
        const error = (await getError(
          parseUnrecognized,
        )) as LambdaEndpointError;
        expect(error.metadata.errorType).toEqual('Unhandled');
        expect(error.metadata.details).toEqual({
          payload: { someOtherShape: true },
        });
      });

      then('it should match snapshot', async () => {
        const error = await getError(parseUnrecognized);
        expect(error).toMatchSnapshot();
      });
    });

    when('[t1] the payload DOES match an error envelope', () => {
      then('the richer shape-based classification still wins', async () => {
        // 🔴 the new check must be a LAST resort, never a first one — a
        //    `BadRequestError` envelope is a caller fault, and aws flags it
        //    `Unhandled` only when the handler let it escape. the ancient
        //    branch above carries the message and the metadata; this one
        //    carries neither, so order is the whole assertion.
        const error = await getError(() =>
          getParsedResponse({
            payload: toPayload({
              errorMessage: 'the uuid is malformed',
              errorType: 'BadRequestError',
            }),
            functionError: 'Unhandled',
            endpoint,
            exid: 'exid:abc123',
          }),
        );
        expect(error).toBeInstanceOf(BadRequestError);
      });
    });
  });

  given('[case9] aws reported NO function error — the local locus', () => {
    const endpoint = asLambdaEndpoint({
      service: 'svc-orders',
      access: 'prep',
      function: 'getOrder',
    });

    when('[t0] an unrecognized payload arrives with no verdict', () => {
      then('it returns as a success — the extant behavior, unchanged', () => {
        // 🔴 the clamp that proves the check did not fail OPEN. the local locus
        //    passes `functionError: undefined` because there is no aws to ask
        //    (`onSerialized.ts:457`), so `undefined` must read as "no verdict,
        //    trust the shapes" rather than as "no error". without this line the
        //    pair above would pass on a check that threw on every payload.
        const result = getParsedResponse<{ someOtherShape: boolean }>({
          payload: toPayload({ someOtherShape: true }),
          functionError: undefined,
          endpoint,
          exid: 'exid:abc123',
        });

        expect(result).toEqual({ someOtherShape: true });

        // the anti-fail-open clamp is caller-visible: a future wrap around the
        // pass-through would satisfy the `toEqual` only if it were removed, so
        // the snapshot is what reports the reshape
        expect(result).toMatchSnapshot();
      });
    });
  });
});
