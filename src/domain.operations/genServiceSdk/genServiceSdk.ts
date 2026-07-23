import { join } from 'node:path';
import type { ContextAwsLambdaCaller } from '../../domain.objects/ContextAwsLambdaCaller';
import type { GeneratedFile } from '../../domain.objects/GeneratedFile';
import { getAllLambdaContracts } from '../getAllLambdaContracts/getAllLambdaContracts';
import { asServiceSymbols } from './asServiceSymbols/asServiceSymbols';
import { asBarrelFileSource } from './gen.file/asBarrelFileSource';
import { asMechanismsFileSource } from './gen.file/asMechanismsFileSource';
import { asResourcesFileSource } from './gen.file/asResourcesFileSource';
import { formatTypescript } from './gen.file/formatTypescript';
import { setGeneratedFilesBatch } from './gen.file/setGeneratedFilesBatch';
import { assertAllDomainObjectRefsBind } from './gen.resource/assertAllDomainObjectRefsBind';
import { getAllDomainObjectsFromContracts } from './gen.resource/getAllDomainObjectsFromContracts';

/**
 * .what = generate a per-service sdk from live lambda contract introspection
 * .why = the whole codegen: discover a service's contracts, capture its
 *        domain-objects, and emit the three files (barrel + mechanisms +
 *        resources) atomically into the target dir (uc.1, uc.2)
 *
 * .all-or-none = all file content is assembled in memory first; only after every
 *        transform succeeds is it written, via one atomic batch call — so any
 *        discovery/capture/fs error leaves zero files written (uc.5/6/8/9)
 */
export const genServiceSdk = async (
  input: {
    which: { service: string };
    into: string;
  },
  context: ContextAwsLambdaCaller,
): Promise<{ files: GeneratedFile[] }> => {
  // discover the service's endpoint contracts (prep-gated by the spine)
  const contracts = await getAllLambdaContracts(
    { which: { service: input.which.service } },
    context,
  );

  // derive the codegen symbols (object name + dobj prefix)
  const symbols = asServiceSymbols({ service: input.which.service });

  // capture every domain-object referenced across the contracts (de-duped)
  const dobjs = getAllDomainObjectsFromContracts({ contracts });

  // fail loud if any dobj REFERENCE (by key) names a dobj captured by no endpoint —
  // its `typeof Svc<Prefix><Name>` resource would not exist (all-or-none, exit 2)
  assertAllDomainObjectRefsBind({
    contracts,
    capturedNames: new Set(dobjs.map((dobj) => dobj.name)),
  });

  // build the ref map: each dobj name → its prefixed resource name
  const dobjRefs = Object.fromEntries(
    dobjs.map((dobj) => [dobj.name, `${symbols.prefix}${dobj.name}`]),
  );
  const resourceNames = dobjs.map((dobj) => `${symbols.prefix}${dobj.name}`);

  // the module specifiers the generated files use to import each other
  const resourcesModule = `./${symbols.object}.resources`;
  const mechanismsModule = `./${symbols.object}.mechanisms`;

  // assemble the three file texts in memory
  const resourcesText = asResourcesFileSource({
    dobjs,
    prefix: symbols.prefix,
    dobjRefs,
  });
  const mechanismsText = asMechanismsFileSource({
    service: input.which.service,
    object: symbols.object,
    resourcesModule,
    resourceNames,
    contracts,
    dobjRefs,
  });
  const barrelText = asBarrelFileSource({
    object: symbols.object,
    mechanismsModule,
    resourcesModule,
  });

  // pair each text with its target path
  const drafts: GeneratedFile[] = [
    { path: join(input.into, `${symbols.object}.ts`), content: barrelText },
    {
      path: join(input.into, `${symbols.object}.mechanisms.ts`),
      content: mechanismsText,
    },
    {
      path: join(input.into, `${symbols.object}.resources.ts`),
      content: resourcesText,
    },
  ];

  // format each file's text through biome (its real target path drives which
  // biome config applies) — clean, drop-in output, not our own whitespace
  const files: GeneratedFile[] = await Promise.all(
    drafts.map(async (draft) => ({
      path: draft.path,
      content: await formatTypescript({
        content: draft.content,
        path: draft.path,
      }),
    })),
  );

  // write all files atomically (all-or-none)
  await setGeneratedFilesBatch({ files });

  return { files };
};
