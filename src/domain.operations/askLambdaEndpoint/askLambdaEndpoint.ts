import { viaApiGateway } from './askLambdaEndpoint.viaApiGateway';
import { viaInvoke } from './askLambdaEndpoint.viaInvoke';

/**
 * .what = the `askLambdaEndpoint` family — every road a caller takes to an endpoint, under one name
 * .why = an api gateway endpoint is still a lambda endpoint; only the road differs. so the road
 *        qualifies the noun, and no second `ask*` noun is coined
 *        (`rule.forbid.unqualified-variant-exports`)
 *
 *   askLambdaEndpoint({ … })                  // the default: a direct invoke, as always
 *   askLambdaEndpoint.viaInvoke({ … })        // the same direct invoke, by name
 *   askLambdaEndpoint.viaApiGateway({ … })    // http, to an api gateway endpoint
 *
 * .note = callable, with the default also a key. `askLambdaEndpoint(…)` shipped bare, so the
 *         family keeps that call form and extant callers pay zero. the axis is backward
 *         compatibility: a family that had shipped no bare name would be a plain object, as
 *         `genLambdaEndpoint` is
 */
export const askLambdaEndpoint = Object.assign(viaInvoke, {
  viaInvoke,
  viaApiGateway,
});

/**
 * .what = input type for askLambdaEndpoint
 * .why = exported for sdk consumers
 */
export type AskLambdaEndpointInput<TRequest> = Parameters<
  typeof viaInvoke<TRequest, unknown>
>[0];

/**
 * .what = context type for askLambdaEndpoint
 * .why = exported for sdk consumers
 */
export type AskLambdaEndpointContext = Parameters<typeof viaInvoke>[1];
