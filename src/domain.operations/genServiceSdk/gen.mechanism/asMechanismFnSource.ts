import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getTypescriptFromJsonSchema } from './getTypescriptFromJsonSchema';

/**
 * .what = emit one mechanism fn: a typed `(event, context)` wrapper around
 *         `askLambdaEndpoint` for a single endpoint
 * .why = the mechanisms file exposes one fn per discovered endpoint (uc.1); each
 *        is a thin, typed call into the endpoint by its service+function
 *
 * .note = `event` is the repo's ubiqlang lambda-payload input; the wrapper keeps
 *         the caller's `context` ambient (env.access lives there)
 */
export const asMechanismFnSource = (input: {
  service: string;
  function: string;
  schema: LambdaEndpointSchema;
  dobjRefs: Record<string, string>;
}): string => {
  // the typed shapes for this endpoint's event (input) and result (output)
  const eventType = getTypescriptFromJsonSchema({
    schema: input.schema.input,
    dobjRefs: input.dobjRefs,
  });
  const resultType = getTypescriptFromJsonSchema({
    schema: input.schema.output,
    dobjRefs: input.dobjRefs,
  });

  // the fn: passes which + event to askLambdaEndpoint, threads context through.
  // the explicit <event, result> generics make the call self-evident — a reader
  // sees the contract at the call site, not only via the outer annotation
  return [
    `  ${input.function}: (`,
    `    event: ${eventType},`,
    `    context: ContextAwsLambdaCaller,`,
    `  ): Promise<${resultType}> =>`,
    `    askLambdaEndpoint<${eventType}, ${resultType}>(`,
    `      { which: { service: ${JSON.stringify(input.service)}, function: ${JSON.stringify(input.function)} }, event },`,
    `      context,`,
    `    ),`,
  ].join('\n');
};
