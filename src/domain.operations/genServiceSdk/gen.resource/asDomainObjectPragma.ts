import type { DomainObjectKind, DomainObjectPragma } from 'domain-objects';
import type { JSONSchema } from 'zod/v4/core/json-schema';

import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';

/**
 * .what = read the `x-domain-object` pragma off one json-schema node → a
 *         DomainObjectCaptured, or null when the node carries no pragma
 * .why = a captured node identifies a domain-object only if its schema was built
 *        from `X.contract()`; a plain shape has no pragma and stays a plain type
 *
 * .kind = domain-objects stamps the true `kind` on the pragma (via getKind) since 0.33.0.
 *         read it directly; fall back to the legacy `primary`-non-empty heuristic
 *         only for a pre-0.33 producer whose pragma omits `kind`
 *
 * .note = ⚠️ that fallback is REAL backcompat, and it holds for a reason this repo's own
 *         version cannot settle: the pragma's producer is the REMOTE lambda under
 *         introspection, which runs its own `domain-objects` on its own release cadence.
 *         so our bump to 0.34.0 does not retire a pre-0.33 producer — a peer service
 *         still on 0.32.x emits a `kind`-less pragma, and to drop the fallback would
 *         mis-type its every entity as a literal, silently
 */
export const asDomainObjectPragma = (input: {
  node: JSONSchema;
}): DomainObjectCaptured | null => {
  // read the pragma keyword off the node (absent → not a domain-object)
  const pragma = (input.node as { 'x-domain-object'?: DomainObjectPragma })[
    'x-domain-object'
  ];
  if (!pragma) return null;

  // default the omitted key-fields (getContract omits them when absent)
  const primary = pragma.primary ?? [];
  const unique = pragma.unique ?? [];
  const alias = pragma.alias ?? null;
  const nested = pragma.nested ?? {};

  // read the stamped kind; fall back to the heuristic for a pre-0.33 pragma
  const kind: DomainObjectKind =
    pragma.kind ?? (primary.length > 0 ? 'entity' : 'literal');

  return {
    name: pragma.name,
    kind,
    primary,
    unique,
    alias,
    nested,
    shape: input.node,
  } as DomainObjectCaptured;
};
