import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { asMechanismFnSource } from '../gen.mechanism/asMechanismFnSource';
import { banner } from './banner';

/**
 * .what = assemble the full `<svc>.mechanisms.ts` file text
 * .why = exposes the `<object>` const of typed `(event, context)` fns, one per
 *        endpoint (uc.1); imports askLambdaEndpoint + the resource types
 */
export const asMechanismsFileSource = (input: {
  service: string;
  object: string;
  resourcesModule: string;
  resourceNames: string[];
  contracts: Record<string, LambdaEndpointSchema>;
  dobjRefs: Record<string, string>;
}): string => {
  // one fn per endpoint, keyed by bare function name (sorted for stable output)
  const fns = Object.keys(input.contracts)
    .sort()
    .map((fnName) =>
      asMechanismFnSource({
        service: input.service,
        function: fnName,
        schema: input.contracts[fnName] as LambdaEndpointSchema,
        dobjRefs: input.dobjRefs,
      }),
    );
  const fnsText = fns.join('\n');

  // import only the resource types the fn signatures actually name — a nested-only
  // dobj (referenced inside another resource, never in a fn signature) must NOT be
  // imported here, else the generated file has an unused import (consumer lint fails)
  const usedResourceNames = input.resourceNames.filter((name) =>
    new RegExp(`\\b${name}\\b`).test(fnsText),
  );

  // the import lines: askLambdaEndpoint always; resource types only if any used
  const imports = [
    `import { askLambdaEndpoint, type ContextAwsLambdaCaller } from 'sdk-aws-lambda';`,
  ];
  if (usedResourceNames.length > 0)
    imports.push(
      `import type { ${usedResourceNames.join(', ')} } from '${input.resourcesModule}';`,
    );

  return [
    banner,
    '',
    imports.join('\n'),
    '',
    `export const ${input.object} = {`,
    fnsText,
    `};`,
    '',
  ].join('\n');
};
