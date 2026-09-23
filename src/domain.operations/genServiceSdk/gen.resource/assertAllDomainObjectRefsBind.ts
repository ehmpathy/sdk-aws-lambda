import type { DomainObjectPragmaRef } from 'domain-objects';

import { LambdaDomainObjectRefUnbindableError } from '../../../domain.objects/LambdaDomainObjectRefUnbindableError';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getAllJsonSchemaNodes } from '../getAllJsonSchemaNodes';

/**
 * .what = verify every `x-domain-object-ref` across a service's contracts names a
 *         dobj that is captured in full (present in `capturedNames`)
 * .why = a reference emits `RefByPrimary<typeof Svc<Prefix><Name>>`; that prefixed
 *        resource must be declared, else the generated sdk will not compile. an
 *        unbound ref means the referenced dobj is surfaced by no endpoint whole —
 *        fail loud so the caller surfaces it (all-or-none, exit 2)
 *
 * .throws LambdaDomainObjectRefUnbindableError — names the unbound ref + its dobj
 */
export const assertAllDomainObjectRefsBind = (input: {
  contracts: Record<string, LambdaEndpointSchema>;
  capturedNames: Set<string>;
}): void => {
  const referencedNames = new Set<string>();

  // walk each endpoint's input + output schema trees for ref-pragma names
  for (const schema of Object.values(input.contracts))
    for (const root of [schema.input, schema.output])
      for (const node of getAllJsonSchemaNodes({ root })) {
        const ref = (node as { 'x-domain-object-ref'?: DomainObjectPragmaRef })[
          'x-domain-object-ref'
        ];
        if (ref?.of) referencedNames.add(ref.of);
      }

  // every referenced name must be captured in full; else the ref cannot bind
  const unbound = [...referencedNames]
    .filter((name) => !input.capturedNames.has(name))
    .sort();
  if (unbound.length > 0)
    throw new LambdaDomainObjectRefUnbindableError(
      `domain-object reference(s) cannot bind: ${unbound.join(', ')} — referenced by key but captured by no endpoint`,
      {
        unbound,
        hint: 'surface each referenced domain-object in full on some endpoint of this service (return it whole via `X.contract()`) so the codegen can declare its resource',
      },
    );
};
