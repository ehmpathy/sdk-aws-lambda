import { LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX } from '../../../domain.objects/LambdaEndpointErrorResponseBody';

/**
 * .what = the contemp half of "is this an error envelope" — one shared tag check
 * .why = both boundaries (wire + run) ask the identical question of a tag, so one
 *   writer. a fork between a producer and a detector fails SILENT: the detector
 *   stops to recognize the envelope, and a caller fault reads as a success payload.
 *
 * 🔴 matches the PREFIX, never the full tag. a decoder must accept an envelope from
 *    ANY codec version; an equality check would stop to recognize a `v2` envelope
 *    the day a `v1` service met one — the silent break above.
 *
 * 🔴 an ABSENT `@version` is version 0 — the v0.3.0 producer, already deployed,
 *    emits a bare `…::contemp`. tolerance is finite; it dies once every producer
 *    stamps a version.
 *
 * .note = the match is prefix + (`@` | end). a bare `startsWith` would admit a peer
 *   codec named `…::contempFOO`.
 */
const CONTEMP_TAG_BOUNDARY = new RegExp(
  `^${LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}(@|$)`,
);

export const getIsContempErrorTagged = (value: unknown): boolean => {
  if (typeof value !== 'object' || value === null) return false;
  const serde = (value as { error?: { _serde?: unknown } }).error?._serde;
  if (typeof serde !== 'string') return false;
  return CONTEMP_TAG_BOUNDARY.test(serde);
};
