import { getExidFromContext } from '../../lambdaEndpointWire/context/getExidFromContext';

/**
 * .what = the caller's trail, with an exid guaranteed — the caller's own, or a generated one
 * .why = the `x-trail-exid` header carries a value or carries no opt-in, so a request that
 *        opts in owes an exid. a wrapper may go without one; a header may not
 *
 * .note = an absent, null, or empty exid all read as "none" by `getExidFromContext`, which generates
 */
export const getOneTrailWithExid = (input: {
  trail: { exid?: string | null } | null | undefined;
}): { exid: string } => ({
  exid: getExidFromContext({
    log: { trail: { exid: input.trail?.exid ?? null } },
  }).exid,
});
