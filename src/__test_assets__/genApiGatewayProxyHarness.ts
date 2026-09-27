import type { Context } from 'aws-lambda';

import { createServer, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { text } from 'node:stream/consumers';
import type { ApiGatewayRequestEventOnwire } from '../domain.objects/ApiGatewayRequestEventOnwire';
import type { ApiGatewayResponseOnwire } from '../domain.objects/ApiGatewayResponseOnwire';
import { asLambdaEndpointOutput } from '../domain.operations/runLambdaEndpoint/dialect/asLambdaEndpointOutput';
import { runLambdaEndpoint } from '../domain.operations/runLambdaEndpoint/runLambdaEndpoint';
import {
  type ApiGatewayOnwireVersion,
  asApiGatewayRequestEventOnwire,
} from './asApiGatewayRequestEventOnwire';

/**
 * .what = the handler shape this harness fronts
 *
 * .note = the input must stay the union, never v1 alone. typed narrower, a v2 case cannot be
 *         written without a cast, so every case this harness hosts silently runs one arm
 *         (rule.require.a-harness-types-as-wide-as-its-contract)
 */
type ApiGatewayHandler = (
  wire: ApiGatewayRequestEventOnwire,
  context: Context,
) => Promise<ApiGatewayResponseOnwire>;

/**
 * .what = the bound on one request — the body read and the handler invoke alike, in ms
 * .why = a handler that hangs is a defect this harness exists to surface, and with no bound it
 *        surfaces as a generic jest timeout with no pointer to which handler hung. worse, a
 *        stalled `text(req)` leaves `res` unwritten, so the caller waits on a listener that will
 *        never answer (rule.forbid.behavior-hazards — an undocumented time assumption)
 *
 * .why 10s = every handler in this suite answers in ms; the slowest measured case is the cold
 *        chain at ~200ms. so 10s is ~50x headroom over the real distribution, which makes a trip
 *        of this bound a hang rather than a slow machine
 *
 * .note = it matches `getOneHttpResponse`'s caller-side bound deliberately. the caller's bound
 *         stops the suite from a hang; this one names which half hung, which the caller cannot
 *         see from outside
 */
const TIMEOUT_MS = 10_000;

/**
 * .what = the third subject this listener can meet — a handler that never answered at all
 * .why = a hang and a throw are different defects with different repairs, and the whole design
 *        of this file is that two subjects must not report alike. a hang reported as an escape
 *        would send a reader to look for a thrown value that does not exist
 */
class HandlerHungError extends Error {
  constructor(public readonly afterMs: number) {
    super(`handler did not answer within ${afterMs}ms — it hung`);
    this.name = 'HandlerHungError';
  }
}

/**
 * .what = the fourth subject — a caller that opened a request and never finished its body
 * .why = the two time bounds this file sets guard two different parties. the body read waits on
 *        the caller's bytes; the invoke waits on the handler. so to report a caller's stall as a
 *        handler hang sends a reader to read a handler that never ran at all
 *        (rule.forbid.failhide)
 */
class CallerStalledError extends Error {
  constructor(public readonly afterMs: number) {
    super(
      `caller did not finish its request body within ${afterMs}ms — it stalled`,
    );
    this.name = 'CallerStalledError';
  }
}

/**
 * .what = runs one step under an explicit time bound, and names the bound in its rejection
 * .why = a bound is what turns a hang into a named failure rather than a generic suite timeout
 *
 * .why `asTimeoutError` is a parameter = the bound is shared and the subject is not. each caller
 *        waits on a different party, so each names the class its own stall belongs to. a
 *        hardcoded class here would collapse the two subjects into one report
 *
 * .why the `finally` = it makes the race's loser unable to settle at all. once the step answers,
 *        `clearTimeout` cancels the timer, so the rejector never runs and the rejection is never
 *        constructed. the alternative — to leave a live timer and then reason about who observes
 *        its rejection — is a question this shape does not raise
 *        (rule.prefer.prevent-over-correct)
 *
 * .why not an `AbortController` = it bridges a timer declared outside the executor to the
 *        `reject` that lives inside it, and it leaves a controller, a signal, and a
 *        `{ once: true }` listener alive per request — with no seam to unregister the listener
 *        from, since the listener closes over a `reject` no outer scope can name. a timer
 *        declared inside the executor reaches `reject` directly, so all three objects are
 *        deleted rather than cleaned up (rule.require.review-attempts-deletion)
 *
 * .why not `input.run().catch(() => {})` = it is the measure a reader reaches for first, and it
 *        would delete this harness's whole subject split: a caught rejection settles as
 *        `undefined`, so a handler that threw would answer 200 with an empty body and the 599
 *        arm below would go permanently dark. never silence the run; disarm the timer instead
 *
 * .measured = a race loser that rejects late does not surface as an unhandled rejection.
 *        `Promise.race` subscribes to every entrant at call time, so each loser already carries
 *        a rejection handler and a late settle is absorbed by the already-settled race. probed
 *        both arms (a fast winner whose loser rejects late, and a timeout winner whose abandoned
 *        run throws afterward) -> `unhandledRejection` fired 0×
 *
 * .note = the step is not cancelled — node cannot cancel an arbitrary promise. the bound governs
 *         how long this listener waits, which is what decides whether the caller gets an answer
 */
const getOneAnswerWithinBound = async <T>(input: {
  run: () => Promise<T>;
  ms: number;
  asTimeoutError: (input: { afterMs: number }) => Error;
}): Promise<T> => {
  /**
   * .note = deliberate mutation, and the one shape javascript offers here: `reject` exists only
   *         inside the executor, and the timer handle is needed outside it. `new Promise`'s
   *         executor runs synchronously, so the assignment lands before the `try` below ever
   *         reads it (rule.require.immutable-vars — a scoped, documented exception)
   */
  let timer: ReturnType<typeof setTimeout> | undefined;

  const rejection = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(input.asTimeoutError({ afterMs: input.ms })),
      input.ms,
    );
  });

  try {
    return await Promise.race([input.run(), rejection]);
  } finally {
    clearTimeout(timer);
  }
};

/**
 * .what = the one error class the request listener's catch is entitled to absorb
 * .why = an escape from the handler under test and a defect in the harness itself are two
 *        different subjects, and a single catch over both cannot tell them apart — so a
 *        harness `TypeError` would report as a handler escape and mislead the reader
 *        (rule.forbid.failhide)
 *
 * .note = this is the allowlist. the handler's own throw arrives tagged, so the catch treats
 *         exactly this class as an expected outcome and gives every other value a distinct,
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
   * .why = the tag is applied at the one call whose throw is expected, so the catch never has
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
 * .what = names the subject a throw belongs to, and the status that reports it
 * .why = a lookup rather than a ternary chain, so a further subject is a row rather than another
 *        nested branch (rule.forbid.else-branches)
 *
 * .note = 596, 597, 598 and 599 sit outside every status the sdk emits, so a test can never
 *         mistake one for a real wire response
 */
const asErrorSubject = (input: {
  error: unknown;
}): { label: string; status: number; report: unknown } => {
  // the handler threw — an expected outcome for the cases that assert an escape
  if (input.error instanceof HandlerEscapedError)
    return {
      label: 'harness.handlerEscaped',
      status: 599,
      report: input.error.escaped,
    };

  // the handler never answered — a different defect, with a different repair
  if (input.error instanceof HandlerHungError)
    return {
      label: 'harness.handlerHung',
      status: 597,
      report: input.error,
    };

  // the caller never finished its body — the handler is blameless, so it must not be named
  if (input.error instanceof CallerStalledError)
    return {
      label: 'harness.callerStalled',
      status: 596,
      report: input.error,
    };

  // every other value is a defect in the harness, and must not report as any above
  return {
    label: 'harness.harnessDefect',
    status: 598,
    report: input.error,
  };
};

/**
 * .what = writes the wire response for a throw that reached the request listener, and tells the
 *         four subjects apart: a handler that escaped its chain (599), a handler that hung
 *         (597), a caller that stalled mid-body (596), and a defect in the harness itself (598)
 * .why = a throw cannot leave the listener — it would become an unhandled rejection and leave
 *        `res` open, so the caller hangs until the test times out with no clue why. so the
 *        subjects are told apart here (rule.forbid.failhide, rule.require.failloud)
 *
 * .note = every branch emits the whole value, stack and all, so a real defect always reaches
 *         the test output
 */
const setHttpResponseForError = (input: {
  error: unknown;
  res: ServerResponse;
}): void => {
  const subject = asErrorSubject({ error: input.error });

  console.error(subject.label, subject.report);

  input.res.writeHead(subject.status, { 'Content-Type': 'text/plain' });
  input.res.end(
    `${subject.label}: ${
      input.error instanceof Error ? input.error.message : String(input.error)
    }`,
  );
};

/**
 * .what = fronts an api-gateway lambda handler with a real http server that applies
 *         aws's documented proxy map, so a test can assert the bytes with `fetch`
 * .why = a test that asserts on the handler's return proves only what the sdk computed. the
 *        wire is what must be proven — a 204 must have no body on the wire, a 308 must carry
 *        Location, xml must arrive byte-identical. only a real request/response round trip can
 *        say that
 *
 * .note = the map under test is how this repo reads the aws docs, so this proves the sdk emits
 *         a wire response that maps to the intended bytes. it does not prove aws implements the
 *         map as documented — that needs a deployed api gateway, which `declastruct-aws` cannot
 *         yet declare (see ehmpathy/declastruct-aws#90)
 */
export const genApiGatewayProxyHarness = async (input: {
  handler: ApiGatewayHandler;

  /**
   * .what = which payload format the trigger delivers; defaults to `v1`
   * .why = v1 is the common case, so a case that omits it needs no selector
   */
  version?: ApiGatewayOnwireVersion;
}): Promise<{
  url: string;
  close: () => Promise<void>;
}> => {
  const version: ApiGatewayOnwireVersion = input.version ?? 'v1';

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        /**
         * node's own stream consumer, so there is no chunk accumulator to mutate and no
         * half-read state a later edit could leave behind (rule.require.immutable-vars)
         *
         * .note = bounded, because `text()` takes no signal of its own: a caller that opens a
         *         request and never finishes the body would otherwise stall this listener
         *         forever, with `res` unwritten
         *
         * .why `CallerStalledError` = this bound waits on the caller's bytes, never on the
         *         handler — which has not been invoked yet, and may never be. to raise a
         *         `HandlerHungError` here would name a party that never ran
         */
        const body = await getOneAnswerWithinBound({
          run: () => text(req),
          ms: TIMEOUT_MS,
          asTimeoutError: ({ afterMs }) => new CallerStalledError(afterMs),
        });

        const wire = asApiGatewayRequestEventOnwire({
          version,
          method: req.method ?? 'GET',
          url: req.url ?? '/',
          headers: req.headers as Record<string, string>,
          body,
        });

        /**
         * tags a throw that came from the handler, so the outer catch can allowlist it. every
         * other throw in this listener is a harness defect, and the two must not report alike
         *
         * .note = the bound sits outside the tag, deliberately. a hang is not an escape, and to
         *         wrap it as one would hand the reader the wrong subject — so the timeout
         *         rejection travels untagged and `asErrorSubject` routes it to 597
         *
         * 🔴 `payload: 'ancient'` frames the event RAW. an api-gateway handler reads the http
         *    envelope off the event itself, so the contemp default — which wraps it as
         *    `{ event, trail }` — would hand it a shape aws never sends
         *    (`define.lambda-endpoint-run-boundary`)
         */
        const answered = await getOneAnswerWithinBound({
          run: () =>
            HandlerEscapedError.tag(() =>
              runLambdaEndpoint.onReferenced({
                event: wire,
                handler: input.handler,
                struct: { payload: 'ancient' },
                context: { functionName: 'svc-test-prep-harness' },
              }),
            ),
          ms: TIMEOUT_MS,
          asTimeoutError: ({ afterMs }) => new HandlerHungError(afterMs),
        });

        // `forApiGateway` converts every fault into a `{ statusCode }` response, so an error
        // envelope on this path is a contract breach — the narrow throws rather than hands
        // back an envelope typed as a response (`rule.forbid.failhide`)
        const response = asLambdaEndpointOutput(answered);

        /**
         * .what = apply aws's documented proxy map: statusCode + headers + body -> the wire
         * .as = the sdk hands back `Record<string, string> | undefined`, assignable in value yet
         *       it picks the wrong `writeHead` overload — `as never` selects the header-object
         *       arm rather than the (rejected) `string[]` arm
         * .removal = drops when node's types express the overload without ambiguity
         */
        res.writeHead(response.statusCode, response.headers as never);

        // an absent body means no bytes; api gateway sends an empty entity, never `'""'`
        res.end(response.body ?? undefined);
      } catch (error) {
        setHttpResponseForError({ error, res });
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

// .note = the reader for this harness's output lives beside it, in `getOneHttpResponse.ts` —
//         it works against any http url, while this file holds a server lifecycle
