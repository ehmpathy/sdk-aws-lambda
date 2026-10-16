/**
 * .what = the method a request is sent under: the caller's, else the one its body implies
 * .why = a request with a body and no method is a write, and fetch refuses `GET` with a body. so the
 *        bare call does the common work: `POST` where there is a body, `GET` where there is none
 *        (`rule.prefer.defaults-match-common-case`)
 *
 * | method | body | sent as |
 * |--------|------|---------|
 * | given | any | the given method, as is — a mismatch is the caller's to see |
 * | absent | present | `POST` |
 * | absent | absent | `GET` |
 */
export const asHttpMethod = (input: {
  method: string | undefined;
  body: unknown;
}): string => {
  if (input.method) return input.method;
  return input.body === undefined ? 'GET' : 'POST';
};
