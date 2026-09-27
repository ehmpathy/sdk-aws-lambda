import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { getTypescriptFromJsonSchema } from './getTypescriptFromJsonSchema';

/**
 * .what = emit one mechanism fn: a typed `(event, context)` wrapper around
 *         `askLambdaEndpoint` for a single endpoint
 * .why = the mechanisms file exposes one fn per discovered endpoint (uc.1); each
 *        is a thin, typed call into the endpoint by its service+function
 *
 * .note = `event` is **the whole object the invoke delivers** — aws's own word, and this
 *         repo's term for it (`domain.terms/event.md`). a direct-invoke lambda carries no
 *         envelope, so what arrives IS the caller's input and the two coincide here. that
 *         coincidence is a property of this trigger, never of the word: at api gateway the
 *         two differ, and there `event` names the envelope while `payload` names its body
 *
 * .note = the wrapper keeps the caller's `context` ambient (env.access lives there)
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
