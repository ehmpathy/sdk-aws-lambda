import type { JSONSchema } from 'zod/v4/core/json-schema';

import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';
import { LambdaDomainObjectNotCapturableError } from '../../../domain.objects/LambdaDomainObjectNotCapturableError';
import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getAllJsonSchemaNodes } from '../getAllJsonSchemaNodes';
import { asDomainObjectPragma } from './asDomainObjectPragma';

/**
 * .what = collect every domain-object captured across a service's contracts,
 *         de-duplicated by name
 * .why = the resources file declares each captured dobj once; a dobj referenced
 *        by many endpoints must yield a single declaration (uc.2 dedupe)
 *
 * .throws LambdaDomainObjectNotCapturableError — a pragma-tagged node whose shape
 *         cannot be reconstructed (no object properties) (uc.9)
 */
export const getAllDomainObjectsFromContracts = (input: {
  contracts: Record<string, LambdaEndpointSchema>;
}): DomainObjectCaptured[] => {
  // collect every dobj contract from every endpoint's input + output schemas
  const captured = new Map<string, DomainObjectCaptured>();

  // walk each endpoint's input and output schema trees
  for (const schema of Object.values(input.contracts))
    for (const root of [schema.input, schema.output])
      for (const node of getAllJsonSchemaNodes({ root }))
        captureDomainObjectAt({ node, captured });

  // return the de-duplicated contracts in stable (name-sorted) order
  return [...captured.values()].sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * .what = capture ONE node, if it carries an `x-domain-object` pragma
 * .why = the descent that reaches every node is `getAllJsonSchemaNodes`; what is left here
 *        is this file's own semantics — the pragma read, the uc.9 guard, and the de-dup.
 *        a dobj can appear at any depth (properties, items, $defs, anyOf, etc.), and the
 *        walker reaches each without this function aware of the shape it sat in
 */
const captureDomainObjectAt = (input: {
  node: object;
  captured: Map<string, DomainObjectCaptured>;
}): void => {
  const { node, captured } = input;

  // capture this node if it carries a domain-object pragma
  const contract = asDomainObjectPragma({ node: node as JSONSchema });
  if (contract) {
    // fail loud if the pragma names a dobj with no reconstructable shape (uc.9)
    if (!getIsCapturableShape(node))
      throw new LambdaDomainObjectNotCapturableError(
        `domain-object '${contract.name}' cannot be captured: its object schema declares no properties to reconstruct`,
        {
          name: contract.name,
          hint: 'ensure the domain-object schema declares its properties (an empty object schema cannot be captured)',
        },
      );

    // keep the first capture; a repeat of the same name is a de-dup no-op
    if (!captured.has(contract.name)) captured.set(contract.name, contract);
  }
};

/**
 * .what = decide whether a schema node has an object shape we can reconstruct
 * .why = a dobj resource needs properties to emit; a pragma without them is uncapturable
 */
const getIsCapturableShape = (node: object): boolean => {
  const properties = (node as { properties?: unknown }).properties;
  return (
    typeof properties === 'object' &&
    properties !== null &&
    Object.keys(properties).length > 0
  );
};
