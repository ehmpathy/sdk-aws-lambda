import { UnexpectedCodePathError } from 'helpful-errors';

/**
 * .what = derive the codegen symbols (object name + dobj prefix) for a service
 * .why = the generated sdk names one object `svcJobs` and prefixes captured
 *        domain-objects `SvcJobsJob`; both derive from the `svc-{noun}` name
 *
 * .model = matches the extant `asLambdaEndpoint` slug parser: a service is
 *          exactly `svc-{noun}` (2 dash-segments). so `svc-jobs` → noun `jobs`.
 *
 * .throws UnexpectedCodePathError — input is not a valid `svc-{noun}` service
 */
export const asServiceSymbols = (input: {
  service: string;
}): { object: string; prefix: string } => {
  // split the service into its dash-segments
  const parts = input.service.split('-');

  // require the svc-{noun} shape: exactly 2 non-empty segments, first is 'svc'
  const isValid =
    parts.length === 2 && parts[0] === 'svc' && (parts[1]?.length ?? 0) > 0;
  if (!isValid)
    throw new UnexpectedCodePathError(
      `service does not match expected 'svc-{noun}' shape`,
      { service: input.service },
    );

  // noun is the second segment (e.g. 'jobs')
  const noun = parts[1] as string;

  // object = camelCase svc+noun (e.g. 'svcJobs')
  const object = `svc${capitalize(noun)}`;

  // prefix = PascalCase Svc+Noun (e.g. 'SvcJobs')
  const prefix = `Svc${capitalize(noun)}`;

  return { object, prefix };
};

/**
 * .what = uppercase the first character of a word
 * .why = build camelCase/PascalCase symbols from the service noun
 */
const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);
