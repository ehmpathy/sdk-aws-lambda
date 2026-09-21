/**
 * .what = decides whether a module assembles a hyphen-joined endpoint slug
 * .why = 🔴 the slug shape `{service}-{access}-{function}` must be written in
 *        exactly ONE place (`asLambdaEndpoint.ts`). a second writer would be a
 *        second opinion about what a lambda is CALLED — and the two would agree
 *        until the day an access tier or a service prefix changed, which is the
 *        drift radio #20 names in the incumbent.
 *
 * 🔴 the detector matches the INTENT — *"this module assembles a hyphen-joined
 *    slug from the endpoint parts"* — across every syntax that expresses it.
 *
 * ⚠️ a SINGLE-syntax detector is wrong in both directions, and the second is a
 *    failhide: a fork written as `[service, access, fn].join('-')` matches no
 *    template literal, so it never enters the result and `toEqual([one file])`
 *    passes green while the drift ships.
 *
 * .note = if a refactor turns the caller red, EXTEND the alternation below
 *   rather than delete the check — a red there is the clamp at work.
 */
const SLUG_COMPUTERS = [
  /\$\{[^}]*service[^}]*\}-\$\{/, // `${service}-${access}-${fn}`
  /\.join\(\s*['"`]-['"`]\s*\)/, // [service, access, fn].join('-')
  /['"`]-['"`]\s*\+/, // service + '-' + access
  /\+\s*['"`]-['"`]/, // service + '-' + access, other side
];

export const getIsSlugComputer = (input: { code: string }): boolean =>
  SLUG_COMPUTERS.some((pattern) => pattern.test(input.code));
