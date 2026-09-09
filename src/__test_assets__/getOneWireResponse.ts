/**
 * .what = makes one real http request and reads the wire response into plain data
 * .why = `useBeforeAll` hands back a PROXY that defers property access, which a native
 *        `Response` cannot survive — its status and `.text()` live behind internal slots,
 *        so the proxy yields `undefined`. a read of the bytes here, before the value is
 *        shared, keeps every assertion on a plain object
 *
 * .why = it also drops the `.clone()` ceremony a multi-assertion case would otherwise owe,
 *        since a `Response` body streams once
 *
 * .why its own file = it crosses no boundary this repo owns — it is a `fetch` and a header
 *        read, so it works against ANY http url and needs no harness at all. the harness
 *        beside it opens a real server and holds a lifecycle; two responsibilities, two
 *        files (`rule.require.single-responsibility`, `rule.require.sync-filename-opname`)
 */
export const getOneWireResponse = async (input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{
  status: number;
  headers: Record<string, string>;
  text: string;
}> => {
  const response = await fetch(input.url, {
    method: input.method ?? 'POST',
    headers: input.headers,
    body: input.body,

    // never follow a redirect — the redirect itself is what a 3xx case asserts
    redirect: 'manual',
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
};
