import type { Context } from 'aws-lambda';

import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { text } from 'node:stream/consumers';
import type { ApiGatewayRequestPayload } from '../domain.objects/ApiGatewayRequestPayload';
import type { ApiGatewayResponsePayload } from '../domain.objects/ApiGatewayResponsePayload';
import {
  type ApiGatewayPayloadVersion,
  asApiGatewayRequestPayload,
} from './asApiGatewayRequestPayload';
import { invokeHandlerForTest } from './invokeHandlerForTest';

/**
 * .what = the handler shape this harness fronts
 *
 * ⚠️ .note = the input must stay the UNION, never v1 alone. typed narrower, a v2 case cannot be
 *         written without a cast, so every case this harness hosts silently runs one arm
 *         (rule.require.a-harness-types-as-wide-as-its-contract)
 */
type ApiGatewayHandler = (
  payload: ApiGatewayRequestPayload,
  context: Context,
) => Promise<ApiGatewayResponsePayload>;

/**
 * .what = the ONE error class the request listener's catch is entitled to absorb
 * .why = an escape from the handler under test and a defect in the harness ITSELF are two
 *        different subjects, and a single catch over both cannot tell them apart — so a
 *        harness `TypeError` would report as a handler escape and mislead the reader
 *        (rule.forbid.failhide)
 *
 * .note = this is the allowlist. the handler's own throw arrives tagged, so the catch treats
 *         exactly this class as an expected outcome and gives every OTHER value a distinct,
 *         louder status of its own
 */
class HandlerEscapedError extends Error {
  constructor(public readonly escaped: unknown) {
    super(
      `handler escaped its chain: ${
        escaped instanceof Error ? escaped.message : String(escaped)
      }`,
    );
    this.name = 'HandlerEscapedError';
  }

  /**
   * .what = runs the handler and tags whatever it throws as a handler escape
   * .why = the tag is applied at the ONE call whose throw is expected, so the catch never has
   *        to guess which subject an error came from
   */
  public static tag = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      throw new HandlerEscapedError(error);
    }
  };
}

/**
 * .what = writes the wire response for a throw that reached the request listener, and tells the
 *         TWO subjects apart: a handler that escaped its chain, and a defect in the harness
 * .why = a throw cannot leave the listener — it would become an unhandled rejection AND leave
 *        `res` open, so the client hangs until the test times out with no clue why. so the two
 *        subjects are told apart HERE (rule.forbid.failhide, rule.require.failloud)
 *
 * .note = both branches emit the whole value, stack and all, so a real defect always reaches
 *         the test output. 598 and 599 sit OUTSIDE every status the sdk emits, so a test can
 *         never mistake either for a real wire response
 */
const setWireResponseForError = (input: {
  error: unknown;
  res: ServerResponse;
}): void => {
  const isHandlerEscape = input.error instanceof HandlerEscapedError;
  const label = isHandlerEscape
    ? 'harness.handlerEscaped'
    : 'harness.harnessDefect';

  console.error(
    label,
    isHandlerEscape
      ? (input.error as HandlerEscapedError).escaped
      : input.error,
  );

  input.res.writeHead(isHandlerEscape ? 599 : 598, {
    'Content-Type': 'text/plain',
  });
  input.res.end(
    `${label}: ${
      input.error instanceof Error ? input.error.message : String(input.error)
    }`,
  );
};

/**
 * .what = fronts an api-gateway lambda handler with a real http server that applies
 *         aws's documented proxy map, so a test can assert the bytes with `fetch`
 * .why = a test that asserts on the handler's RETURN proves only what the sdk computed.
 *        the wish's acceptance asks that the wire be proven — a 204 must have no body on
 *        the wire, a 308 must carry Location, xml must arrive byte-identical. only a real
 *        request/response round trip can say that
 *
 * .note = the map under test is THIS repo's reading of the aws docs, so this proves the
 *         sdk emits a payload that maps to the intended bytes. it does NOT prove aws
 *         implements the map as documented — that needs a deployed api gateway, which
 *         `declastruct-aws` cannot yet declare (see ehmpathy/declastruct-aws#90)
 */
export const genApiGatewayProxyHarness = async (input: {
  handler: ApiGatewayHandler;

  /**
   * .what = which payload format the trigger delivers; defaults to `v1`
   * .why = a case that omits it reads exactly as it did before this option existed
   */
  version?: ApiGatewayPayloadVersion;
}): Promise<{
  url: string;
  close: () => Promise<void>;
}> => {
  const version: ApiGatewayPayloadVersion = input.version ?? 'v1';

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        // node's own stream consumer, so there is no chunk accumulator to mutate and no
        // half-read state a later edit could leave behind (rule.require.immutable-vars)
        const body = await text(req);

        const payload = asApiGatewayRequestPayload({
          version,
          method: req.method ?? 'GET',
          url: req.url ?? '/',
          headers: req.headers as Record<string, string>,
          body,
        });

        // tags a throw that came from the HANDLER, so the outer catch can allowlist it. every
        // other throw in this listener is a harness defect, and the two must not report alike
        const response = await HandlerEscapedError.tag(() =>
          invokeHandlerForTest(input.handler, {
            event: payload,
            context: { functionName: 'svc-test-prep-harness' },
          }),
        );

        /**
         * .what = apply aws's documented proxy map: statusCode + headers + body -> the wire
         * .as = the sdk hands back `Record<string, string> | undefined`, assignable in value yet
         *       it picks the wrong `writeHead` overload — `as never` selects the header-object
         *       arm rather than the (rejected) `string[]` arm
         * .removal = drops when node's types express the overload without ambiguity
         */
        res.writeHead(response.statusCode, response.headers as never);

        // an ABSENT body means no bytes; api gateway sends an empty entity, never `'""'`
        res.end(response.body ?? undefined);
      } catch (error) {
        setWireResponseForError({ error, res });
      }
    })();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
};

// .note = the reader for this harness's output lives beside it, in `getOneWireResponse.ts` —
//         it works against any http url, while this file holds a server lifecycle
