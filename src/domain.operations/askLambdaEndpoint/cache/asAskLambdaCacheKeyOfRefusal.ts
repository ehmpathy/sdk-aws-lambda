import type { LambdaEndpointRefusal } from '../../../domain.objects/LambdaEndpointRefusal';

/**
 * .what = the cache key of one ask, under the refusal opt it was asked with
 * .why = the dedupe cache shares one in-flight promise per key, and a rejection's class depends on
 *        the opt. so a pass-through ask must never share a key with a default ask, or a caller
 *        could catch the class the other caller asked for (sdk-aws-lambda#77)
 *
 * .note = the default opt keeps the key it had before the opt existed, so the public
 *         `getAskLambdaCacheKey` and every extant cached entry stay as they were
 * .note = the cost: a pass-through ask no longer shares a cached success with a default ask of
 *         the same event. a class-neutral throw cast at the `viaInvoke` boundary would keep those
 *         hits, but needs a marker that tells a peer refusal from a local `ConstraintError`
 */
export const asAskLambdaCacheKeyOfRefusal = (input: {
  key: string;
  refusal: LambdaEndpointRefusal;
}): string => {
  if (input.refusal.as === 'LambdaEndpointRefusedError') return input.key;
  return `${input.key}::refusal=${input.refusal.as}`;
};
