import { withAssure } from 'type-fns';

/**
 * .what = the two header bags an api gateway event may hold: `headers` on every version, and its
 *         multi-value twin on v1
 * .why = the `headers` carrier writes the opt-in into both, so it must know their shape
 */
export type EventWithHeaders = {
  headers?: Record<string, string> | null;
  multiValueHeaders?: Record<string, string[]> | null;
};

/**
 * .what = whether a value is an object whose header bags, where present, are objects or null
 * .why = the carrier reads an `unknown` event, and a type guard checks the shape at run time where
 *        an `as` cast would only assert it (`rule.forbid.as-cast`, `rule.require.assure-via-type-checks`)
 *
 * .note = `.assure` narrows and throws a helpful error; `.assess` narrows in an `if`
 */
export const isEventWithHeaders = withAssure(
  (value: unknown): value is EventWithHeaders => {
    if (typeof value !== 'object' || value === null) return false;
    const isBagOrAbsent = (bag: unknown): boolean =>
      bag === undefined || bag === null || typeof bag === 'object';
    return (
      isBagOrAbsent(Reflect.get(value, 'headers')) &&
      isBagOrAbsent(Reflect.get(value, 'multiValueHeaders'))
    );
  },
  { name: 'isEventWithHeaders' },
);
