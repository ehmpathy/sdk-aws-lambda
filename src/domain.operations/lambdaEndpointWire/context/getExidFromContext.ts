import { randomUUID } from 'crypto';

/**
 * .what = extracts trail exid from context or generates new one
 * .why = enables trail propagation with fallback for contexts without exid
 *
 * returns exid and source to enable caller to log when fallback occurs
 */
export const getExidFromContext = (input: {
  log: { trail: { exid: string | null } | null } | null;
}): { exid: string; source: 'extracted' | 'generated' } => {
  // extract exid from log trail
  const exid = input.log?.trail?.exid;
  if (exid) return { exid, source: 'extracted' };

  // generate new exid and indicate it was generated
  return { exid: `exid:${randomUUID()}`, source: 'generated' };
};
