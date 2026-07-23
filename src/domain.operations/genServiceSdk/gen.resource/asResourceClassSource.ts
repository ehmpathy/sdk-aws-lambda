import type { DomainObjectKind } from 'domain-objects';

import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';
import { getTypescriptFromJsonSchema } from '../gen.mechanism/getTypescriptFromJsonSchema';

/**
 * .what = the domain-objects base class each `kind` maps to
 * .why = the pragma stamps the true `kind`; the resource extends the base class it
 *        names (entity→DomainEntity, literal→DomainLiteral, event→DomainEvent,
 *        object→a plain DomainObject)
 */
export const BASE_CLASS_BY_KIND: Record<DomainObjectKind, string> = {
  entity: 'DomainEntity',
  literal: 'DomainLiteral',
  event: 'DomainEvent',
  object: 'DomainObject',
};

/**
 * .what = emit the TS source for one captured domain-object: its prefixed
 *         interface + prefixed class with primary/unique/alias/nested (no schema)
 * .why = the resources file declares each upstream dobj so the consumer gets a
 *        real DomainEntity/DomainLiteral (etc), not a bare type (uc.2)
 *
 * .rules
 *   - class name = `prefix + name` (the TS class name from the pragma; NOT alias)
 *   - base class = the domain-objects class the pragma's `kind` maps to
 *   - nested type names are prefixed via the same formula
 *   - no `static schema` — consumers do not re-validate
 */
export const asResourceClassSource = (input: {
  dobj: DomainObjectCaptured;
  prefix: string;
  dobjRefs: Record<string, string>;
}): string => {
  const { dobj, prefix } = input;

  // the emitted symbol name for this dobj (e.g. SvcJobsJob)
  const symbol = `${prefix}${dobj.name}`;

  // the interface shape, with nested dobj-tagged props referenced by prefixed
  // name; asRootShape renders THIS dobj's own shape (not a self-ref)
  const shape = getTypescriptFromJsonSchema({
    schema: dobj.shape,
    dobjRefs: input.dobjRefs,
    asRootShape: true,
  });

  // the base class the dobj's kind maps to
  const base = BASE_CLASS_BY_KIND[dobj.kind];

  // the static key + metadata lines (omit those with no content)
  const statics = [
    asStaticArray('primary', dobj.primary),
    asStaticArray('unique', dobj.unique),
    asStaticAlias(dobj.alias),
    asStaticNested(dobj.nested, prefix),
  ].filter((line): line is string => line !== null);

  const interfaceLine = `export interface ${symbol} ${shape}`;
  const classBody = statics.length > 0 ? `\n  ${statics.join('\n  ')}\n` : '';
  const classLine = `export class ${symbol} extends ${base}<${symbol}> implements ${symbol} {${classBody}}`;

  // a blank line between the interface + class halves makes each dobj's two-part
  // structure obvious at a glance (biome preserves the gap)
  return `${interfaceLine}\n\n${classLine}`;
};

/**
 * .what = render a `public static primary = [...] as const;` line, or null if empty
 */
const asStaticArray = (name: string, values: string[]): string | null => {
  if (values.length === 0) return null;
  const items = values.map((v) => JSON.stringify(v)).join(', ');
  return `public static ${name} = [${items}] as const;`;
};

/**
 * .what = render a `public static alias = ...;` line, or null if absent
 * .why = the alias is a string ('surfboard') or an object ({ singular, plural });
 *        render it as a TS literal — NOT `JSON.stringify` (which emits cramped raw
 *        json `{"singular":"job"}` with quoted keys, a codegen blemish)
 */
const asStaticAlias = (alias: DomainObjectCaptured['alias']): string | null => {
  if (alias === null) return null;
  return `public static alias = ${asAliasLiteral(alias)};`;
};

/**
 * .what = render an alias value as a clean TS literal
 * .why = a string alias becomes a string literal; an object alias becomes an
 *        object literal with unquoted keys + spaces (`{ singular: "job" }`)
 */
const asAliasLiteral = (
  alias: string | { singular?: string; plural?: string },
): string => {
  if (typeof alias === 'string') return JSON.stringify(alias);
  const members = Object.entries(alias).map(
    ([key, value]) => `${key}: ${JSON.stringify(value)}`,
  );
  return `{ ${members.join(', ')} }`;
};

/**
 * .what = render a `public static nested = { key: PrefixedType, ... };` line
 * .why = each nested type name gets the service prefix, so it points at the
 *        prefixed resource declaration; an array value (polymorphic) emits an
 *        array of prefixed names
 */
const asStaticNested = (
  nested: DomainObjectCaptured['nested'],
  prefix: string,
): string | null => {
  const entries = Object.entries(nested);
  if (entries.length === 0) return null;

  const members = entries.map(([key, typeName]) => {
    const value = Array.isArray(typeName)
      ? `[${typeName.map((n) => `${prefix}${n}`).join(', ')}]`
      : `${prefix}${typeName}`;
    return `${key}: ${value}`;
  });

  return `public static nested = { ${members.join(', ')} };`;
};
