import type { DomainObjectCaptured } from '../../../domain.objects/DomainObjectCaptured';
import { getRefGenericsUsed } from '../gen.mechanism/getTypescriptFromJsonSchema';
import {
  asResourceClassSource,
  BASE_CLASS_BY_KIND,
} from '../gen.resource/asResourceClassSource';
import { banner } from './banner';

/**
 * .what = assemble the full `<svc>.resources.ts` file text
 * .why = declares every captured dobj as a prefixed interface + class (uc.2);
 *        imports the domain-objects base classes; carries the do-not-edit banner
 */
export const asResourcesFileSource = (input: {
  dobjs: DomainObjectCaptured[];
  prefix: string;
  dobjRefs: Record<string, string>;
}): string => {
  // one interface + class block per captured dobj (sorted for stable output)
  const blocks = input.dobjs.map((dobj) =>
    asResourceClassSource({
      dobj,
      prefix: input.prefix,
      dobjRefs: input.dobjRefs,
    }),
  );

  // import only the base classes actually used — one per distinct kind present
  // (entity→DomainEntity, literal→DomainLiteral, etc); an unused import here would
  // trip the consumer's lint (rule.forbid.snapshot-visual-blemishes)
  const baseClasses = [
    ...new Set(input.dobjs.map((dobj) => BASE_CLASS_BY_KIND[dobj.kind])),
  ];

  // import the ref generics (Ref / RefByPrimary / RefByUnique) any dobj shape
  // references — collected across every captured dobj so the import carries exactly
  // the generics emitted (no unused import)
  const refGenerics = [
    ...new Set(
      input.dobjs.flatMap((dobj) =>
        getRefGenericsUsed({ schema: dobj.shape, dobjRefs: input.dobjRefs }),
      ),
    ),
  ].sort();

  // one domain-objects import for base classes + ref generics, alphabetized
  const imported = [...baseClasses, ...refGenerics].sort();

  // the import line, omitted entirely when the import list is empty
  const importLine =
    imported.length > 0
      ? `import { ${imported.join(', ')} } from 'domain-objects';`
      : null;

  return [banner, '', importLine, '', blocks.join('\n\n'), '']
    .filter((line): line is string => line !== null)
    .join('\n');
};
