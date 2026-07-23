import type { DomainObjectPragmaRef, DomainObjectRefBy } from 'domain-objects';
import { UnexpectedCodePathError } from 'helpful-errors';
import type { JSONSchema } from 'zod/v4/core/json-schema';

/**
 * .what = compile a json-schema into a TypeScript type literal string
 * .why = the codegen needs typed shapes for mechanism args/returns + resource
 *        interfaces; a bespoke emitter (vs an external tool) keeps output fully
 *        deterministic for snapshots and avoids a heavy dep + esm/jest friction
 *
 * .note = these schemas come from zod via `z.toJSONSchema`, so the shapes are a
 *         known, bounded subset (object/array/string/number/boolean/enum/const/
 *         anyOf/allOf/$ref-free). unknown shapes surface as `unknown`.
 *
 * .dobjRefs = map of `x-domain-object` name → the prefixed resource name; when a
 *             sub-node carries a captured dobj pragma, its type becomes that
 *             prefixed name (a reference) instead of an inline shape
 *
 * .asRootShape = when true, the ROOT node renders its own shape even if it carries
 *             a dobj pragma (so a resource can render its own interface body);
 *             nested pragma nodes still become refs. default false — so a
 *             top-level dobj (e.g. a mechanism's `job` field) becomes a ref.
 */
export const getTypescriptFromJsonSchema = (input: {
  schema: JSONSchema;
  dobjRefs?: Record<string, string>;
  asRootShape?: boolean;
}): string =>
  asType(input.schema, input.dobjRefs ?? {}, input.asRootShape ?? false);

/**
 * .what = render one json-schema node as a TS type literal
 * .why = recursive core of the emitter
 */
const asType = (
  node: JSONSchema,
  dobjRefs: Record<string, string>,
  skipRootPragma = false,
): string => {
  // a node tagged as a domain-object REFERENCE becomes a typed Ref against the
  // referenced dobj's prefixed resource name (e.g. RefByPrimary<typeof SvcSurfSeaturtle>)
  const refType = asRefType(node, dobjRefs);
  if (refType) return refType;

  // a node tagged as a captured dobj becomes a reference to its prefixed name —
  // unless this is the root shape render (a resource emits its own interface)
  const pragma = (node as { 'x-domain-object'?: { name: string } })[
    'x-domain-object'
  ];
  if (!skipRootPragma && pragma && dobjRefs[pragma.name])
    return dobjRefs[pragma.name] as string;

  // const → literal type
  if ('const' in node) return asLiteral((node as { const: unknown }).const);

  // enum → union of literals
  const enumValues = (node as { enum?: unknown[] }).enum;
  if (enumValues) return enumValues.map(asLiteral).join(' | ');

  // anyOf / oneOf → union
  const anyOf =
    (node as { anyOf?: JSONSchema[] }).anyOf ??
    (node as { oneOf?: JSONSchema[] }).oneOf;
  if (anyOf) return anyOf.map((m) => asType(m, dobjRefs)).join(' | ');

  // allOf → intersection
  const allOf = (node as { allOf?: JSONSchema[] }).allOf;
  if (allOf) return allOf.map((m) => asType(m, dobjRefs)).join(' & ');

  // by json-schema `type`
  const type = (node as { type?: string }).type;
  if (type === 'string') return 'string';
  if (type === 'number' || type === 'integer') return 'number';
  if (type === 'boolean') return 'boolean';
  if (type === 'null') return 'null';
  if (type === 'array') return asArray(node, dobjRefs);
  if (type === 'object') return asObject(node, dobjRefs);

  // no recognizable shape → unknown (surfaces upstream schema looseness)
  return 'unknown';
};

/**
 * .what = render an object node as `{ key: type; ... }`
 * .why = objects are the dominant shape; honor `required` for optionality
 */
const asObject = (
  node: JSONSchema,
  dobjRefs: Record<string, string>,
): string => {
  const properties = (node as { properties?: Record<string, JSONSchema> })
    .properties;
  if (!properties || Object.keys(properties).length === 0) return 'unknown';

  const required = new Set((node as { required?: string[] }).required ?? []);

  const members = Object.entries(properties).map(([key, propSchema]) => {
    const optional = required.has(key) ? '' : '?';
    return `${asKey(key)}${optional}: ${asType(propSchema, dobjRefs)};`;
  });

  return `{ ${members.join(' ')} }`;
};

/**
 * .what = render an array node as `type[]`
 * .why = items may be a single schema or absent (→ unknown[]); emit the idiomatic
 *        `T[]` form, consistent with the absent-items branch (not a mixed
 *        `Array<T>` vs `unknown[]` style)
 * .note = union/intersection item types are parenthesized so `A | B` renders as
 *         `(A | B)[]`, not the ambiguous `A | B[]`
 */
const asArray = (
  node: JSONSchema,
  dobjRefs: Record<string, string>,
): string => {
  const items = (node as { items?: JSONSchema }).items;
  if (!items) return 'unknown[]';
  const itemType = asType(items, dobjRefs);
  const needsParens = /\s[|&]\s/.test(itemType);
  return needsParens ? `(${itemType})[]` : `${itemType}[]`;
};

/**
 * .what = render a literal value as a TS literal type
 */
const asLiteral = (value: unknown): string => {
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  if (value === null) return 'null';
  throw new UnexpectedCodePathError('cannot render literal type for value', {
    value,
  });
};

/**
 * .what = the domain-objects ref generic (`Ref` / `RefByPrimary` / `RefByUnique`) a
 *         given `by` maps to
 * .why = the `x-domain-object-ref` pragma's `by` says which key(s) the reference
 *        carries; each maps to its domain-objects type
 */
const REF_GENERIC_BY: Record<DomainObjectRefBy, string> = {
  primary: 'RefByPrimary',
  unique: 'RefByUnique',
  ref: 'Ref',
};

/**
 * .what = read the `x-domain-object-ref` pragma off a schema node (the reference
 *         pragma stamped by `X.contract.ref(by)` in domain-objects@0.33.0)
 * .why = a reference field carries only the referenced dobj (`of`) + which key (`by`)
 */
const asRefPragma = (node: JSONSchema): DomainObjectPragmaRef | undefined =>
  (node as { 'x-domain-object-ref'?: DomainObjectPragmaRef })[
    'x-domain-object-ref'
  ];

/**
 * .what = render a node tagged with `x-domain-object-ref` as a typed Ref, or null
 *         when the node carries no ref pragma (or the referenced dobj is unbound)
 * .why = a reference field emits `RefByPrimary<typeof SvcSurfSeaturtle>` (etc)
 *        instead of an inline key-shape, so the generated sdk keeps the reference
 *        relationship + is typed against the prefixed resource
 * .note = the referenced dobj MUST be captured in full (present in dobjRefs) so the
 *         `typeof <prefixed>` binds; an unbound ref returns null here and the caller
 *         falls back to the plain inline shape (the bind-or-fail check lives upstream)
 */
const asRefType = (
  node: JSONSchema,
  dobjRefs: Record<string, string>,
): string | null => {
  const ref = asRefPragma(node);
  if (!ref) return null;

  const prefixed = dobjRefs[ref.of];
  if (!prefixed) return null;

  return `${REF_GENERIC_BY[ref.by]}<typeof ${prefixed}>`;
};

/**
 * .what = the set of domain-objects ref generics (`Ref` / `RefByPrimary` /
 *         `RefByUnique`) a schema tree uses, for the resources-file import line
 * .why = a resources file that references dobjs must import exactly the ref generics
 *        it emits — no more (no unused import), no less
 */
export const getRefGenericsUsed = (input: {
  schema: JSONSchema;
  dobjRefs: Record<string, string>;
}): string[] => {
  const used = new Set<string>();
  collectRefGenerics(input.schema, input.dobjRefs, used);
  return [...used].sort();
};

/**
 * .what = recursively collect the ref generics used across a schema tree
 */
const collectRefGenerics = (
  node: unknown,
  dobjRefs: Record<string, string>,
  used: Set<string>,
): void => {
  if (typeof node !== 'object' || node === null) return;

  const ref = asRefPragma(node as JSONSchema);
  if (ref && dobjRefs[ref.of]) used.add(REF_GENERIC_BY[ref.by]);

  for (const value of Object.values(node as Record<string, unknown>)) {
    if (Array.isArray(value))
      for (const item of value) collectRefGenerics(item, dobjRefs, used);
    else collectRefGenerics(value, dobjRefs, used);
  }
};

/**
 * .what = render a property key, quoted when it is not a valid identifier
 */
const asKey = (key: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
