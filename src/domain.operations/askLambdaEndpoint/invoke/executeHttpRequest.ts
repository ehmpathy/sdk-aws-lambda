import { MalfunctionError } from 'helpful-errors';

/**
 * .what = sends one http request with the runtime's global fetch, and names the request on a fault
 * .why = a network fault leaves fetch as a bare `TypeError: fetch failed`, which names no url, no
 *        method, and no trail exid. the reader at 3am needs all three
 *
 * .note = the peer of `executeLambdaInvocation`: the raw i/o boundary for the http road
 * .note = every fault is caught and re-thrown, never hidden. `cause` rides along where the fault is
 *         an `Error` of this realm, and `causeMessage` rides always, since a fault from the runtime's
 *         own fetch may come from another realm, where `instanceof Error` is false
 */
export const executeHttpRequest = async (input: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  exid: string;
}): Promise<Response> => {
  try {
    return await fetch(input.url, {
      method: input.method,
      headers: input.headers,
      body: input.body,
    });
  } catch (error) {
    throw new MalfunctionError('askLambdaEndpoint.viaApiGateway.fetch.error', {
      url: input.url,
      method: input.method,
      exid: input.exid,
      causeMessage: String(error),
      ...(error instanceof Error ? { cause: error } : {}),
    });
  }
};
