import { banner } from './banner';

/**
 * .what = assemble the `<svc>.ts` barrel file text
 * .why = the single public entrypoint: re-exports the mechanisms object + all
 *        resource declarations, so consumers import from one path (uc.1)
 */
export const asBarrelFileSource = (input: {
  object: string;
  mechanismsModule: string;
  resourcesModule: string;
}): string =>
  [
    banner,
    '',
    `export { ${input.object} } from '${input.mechanismsModule}';`,
    `export * from '${input.resourcesModule}';`,
    '',
  ].join('\n');
