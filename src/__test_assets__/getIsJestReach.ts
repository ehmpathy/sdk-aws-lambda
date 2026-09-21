/**
 * .what = decides whether a module reaches jest, by import or by global
 * .why = 🔴 jest is a devDependency (`package.json`), so a SHIPPED module that
 *        reached it would break a consumer's install while this repo's own
 *        suite stayed green — the defect is invisible from here, which is why
 *        it needs a structural guard rather than a review habit.
 *
 * ## the three reaches, and why one regex will not do
 *
 * | reach | shape | why it counts |
 * |---|---|---|
 * | bare import | `from 'jest…'` | `jest-mock`, `jest-diff`, … all resolve to devDeps |
 * | scoped import | `from '@jest/…'` | `@jest/globals` is the modern entrypoint |
 * | global touch | `jest.fn()`, `jest.spyOn()` | no import at all — the runner injects it |
 *
 * ⚠️ the third is the one an import-only detector misses, and it is the most
 *    common shape in this repo — `createTestContext.ts` and
 *    `createInProcessLambdaHarness.ts` both touch `jest.fn()` with no import.
 */
const JEST_REACHES = [
  /from\s+['"]jest/, // a bare jest-family import
  /from\s+['"]@jest\//, // a scoped @jest/* import
  /\bjest\s*\./, // the runner-injected global
];

export const getIsJestReach = (input: { code: string }): boolean =>
  JEST_REACHES.some((pattern) => pattern.test(input.code));
