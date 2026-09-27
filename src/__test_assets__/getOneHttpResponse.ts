/**
 * .what = makes one real http request and reads the wire response into plain data
 * .why = `useBeforeAll` hands back a proxy that defers property access, which a native
 *        `Response` cannot survive — its status and `.text()` live behind internal slots,
 *        so the proxy yields `undefined`. a read of the bytes here, before the value is
 *        shared, keeps every assertion on a plain object
 *
 * .why = it also drops the `.clone()` ceremony a multi-assertion case would otherwise owe,
 *        since a `Response` body streams once
 *
 * .why its own file = it crosses no boundary this repo owns — it is a `fetch` and a header
 *        read, so it works against any http url and needs no harness at all. the harness
 *        beside it opens a real server and holds a lifecycle; two responsibilities, two
 *        files (`rule.require.single-responsibility`, `rule.require.sync-filename-opname`)
 */
/**
 * .what = the bound on one request, in ms
 * .why = a handler under test that hangs — an infinite loop, a deadlock, an unresolved promise —
 *        is a defect this harness exists to surface, so the wait for it must be bounded and must
 *        fail by name. with no bound the fetch hangs until jest's global timeout, and the failure
 *        reads as a generic suite timeout with no pointer to which handler hung
 *        (rule.forbid.behavior-hazards — an undocumented time assumption)
 *
 * .why 10s = every handler in this suite answers in ms; the slowest measured case is the cold
 *        chain at ~200ms. so 10s is ~50x headroom over the real distribution, which makes a trip
 *        of this bound a hang rather than a slow machine
 */
const TIMEOUT_MS = 10_000;

/**
 * .what = the one named failure this asset raises when a request trips its bound
 * .why = node's own `TimeoutError` message reads `"The operation was aborted due to timeout"` and
 *        names neither the url nor the bound, so it points at no handler. this class carries
 *        both, so the failure reads as a pointer rather than as a generic stall
 *        (`rule.require.failloud`)
 *
 * .measured = `ctor=DOMException | name=TimeoutError | message=The operation was aborted due to
 *        timeout`. a claim about an emitted value owes a run, never a read
 *        (`rule.require.measure-the-value-you-emit`)
 */
class HttpRequestTimedOutError extends Error {
  constructor(
    public readonly url: string,
    public readonly afterMs: number,
  ) {
    super(
      `no complete http response from ${url} within ${afterMs}ms — it hung`,
    );
    this.name = 'HttpRequestTimedOutError';
  }
}

/**
 * .what = true when a rejection is node's abort-by-timeout, whatever it was thrown from
 * .why = node raises a `DOMException`, never an `Error`, so an `instanceof Error` test reads it
 *        as an unknown value. measured: `ctor=DOMException | name=TimeoutError`
 * .note = the check is on `.name` rather than on the class, because `DOMException` is a global
 *         whose identity differs across realms — a `.name` read survives every one
 */
const isTimeoutRejection = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { name?: unknown }).name === 'TimeoutError';

export const getOneHttpResponse = async (input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
}> => {
  /**
   * .what = one signal, and it bounds both phases — the request and the body read
   * .why = per whatwg fetch, an abort errors the response body's stream, so a handler that
   *        writes headers and then stalls mid-body trips this same signal rather than hangs
   *
   * .measured = a server that writes headers, writes a partial body, and never ends it makes
   *        `.text()` reject at 1016ms against a 1000ms bound. so the try/catch below exists for
   *        the name, never for the bound
   */
  const signal = AbortSignal.timeout(TIMEOUT_MS);

  /**
   * .what = one try over both awaits, so either phase's timeout reports the same named subject
   * .why = the bound is already whole (see above); what node's own rejection lacks is the url.
   *        a reader who meets `"The operation was aborted due to timeout"` cannot tell which
   *        request stalled, and a suite of this size makes that unrecoverable
   */
  try {
    const response = await fetch(input.url, {
      method: input.method ?? 'POST',
      headers: input.headers,
      body: input.body,

      // never follow a redirect — the redirect itself is what a 3xx case asserts
      redirect: 'manual',

      signal,
    });

    /**
     * .what = deliberate mutation — reads the wire headers into a plain object
     * .why = the web `Headers` class exposes no reader that leaves it unmutated under this
     *        tsconfig's lib: it is not iterable here, and `entries()` / `keys()` are absent from
     *        the declared type, so `forEach` is the only door. `rule.require.immutable-vars`
     *        sanctions exactly this — an unavoidable mutation, isolated to one scope, annotated
     *
     * .note = the scope is three lines wide and the object never escapes before it is whole,
     *         so no reader can observe a partial value
     */
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return {
      status: response.status,
      headers,
      text: await response.text(),
    };
  } catch (error) {
    /**
     * .note = this catch is an allowlist of exactly one subject, and every other value
     *         re-throws untouched. it re-names a timeout; it absorbs no defect
     *         (`rule.forbid.failhide`)
     */
    if (isTimeoutRejection(error))
      throw new HttpRequestTimedOutError(input.url, TIMEOUT_MS);
    throw error;
  }
};
