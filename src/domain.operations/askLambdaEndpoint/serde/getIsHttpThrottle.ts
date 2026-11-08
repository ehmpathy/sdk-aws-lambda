import { HttpStatusCode } from '../../../domain.objects/HttpStatusCode';

/**
 * .what = whether an http status asks the caller to wait, never to fix the request
 * .why = a throttle is a 4xx that is not a refusal: the same request succeeds after `retry-after`,
 *        so it is a server fault under either refusal opt (`domain.terms/refusal.md`, F8)
 *
 * .note = names one status, 429, the one rfc 9110 defines as "retry later". widen it here, and only
 *         here, if a peer is seen to answer another transient 4xx (a 408, say)
 */
export const getIsHttpThrottle = (input: { status: number }): boolean =>
  input.status === HttpStatusCode.TOO_MANY_REQUESTS_429;
