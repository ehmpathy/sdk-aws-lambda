/**
 * sdk-aws-lambda
 *
 * define endpoints, ask endpoints, auto-propagate trace-ids.
 */

// re-export from helpful-errors for convenience
export { BadRequestError } from 'helpful-errors';

/**
 * .what = releases every LambdaClient this sdk memoized on the caller's behalf
 * .why = `askLambdaEndpoint` findserts a client per region and holds it for the process, so
 *        its keep-alive agent can hold the event loop open in a cli or one-off command. a
 *        library that makes process-lifetime state owes the caller a way to release it
 */
export { delLambdaSdks } from './access/sdks/lambda/genLambdaSdk';
// domain objects
export type { ApiGatewayRequestPayload } from './domain.objects/ApiGatewayRequestPayload';
export type { ApiGatewayResponse } from './domain.objects/ApiGatewayResponse';
export type { ApiGatewayResponsePayload } from './domain.objects/ApiGatewayResponsePayload';
export type { ContextAwsLambdaCaller } from './domain.objects/ContextAwsLambdaCaller';
export type {
  ContextAwsLambdaServer,
  EnvAccess,
  EnvConfig,
} from './domain.objects/ContextAwsLambdaServer';
export { GeneratedFile } from './domain.objects/GeneratedFile';
export { HttpStatusCode } from './domain.objects/HttpStatusCode';
export { LambdaCredentialsAbsentError } from './domain.objects/LambdaCredentialsAbsentError';
export { LambdaDomainObjectNotCapturableError } from './domain.objects/LambdaDomainObjectNotCapturableError';
export { LambdaDomainObjectRefUnbindableError } from './domain.objects/LambdaDomainObjectRefUnbindableError';
export { LambdaEndpoint } from './domain.objects/LambdaEndpoint';
export type { LambdaEndpointDialect } from './domain.objects/LambdaEndpointDialect';
export { LambdaEndpointError } from './domain.objects/LambdaEndpointError';
export type { LambdaEndpointSchema } from './domain.objects/LambdaEndpointSchema';
// contract discovery errors
export { LambdaFunctionNotFoundError } from './domain.objects/LambdaFunctionNotFoundError';
export { LambdaIntrospectionBlockedError } from './domain.objects/LambdaIntrospectionBlockedError';
export { LambdaIntrospectionNotSupportedError } from './domain.objects/LambdaIntrospectionNotSupportedError';
export { LambdaServiceNotFoundError } from './domain.objects/LambdaServiceNotFoundError';
export type {
  AskLambdaEndpointContext,
  AskLambdaEndpointInput,
} from './domain.operations/askLambdaEndpoint/askLambdaEndpoint';
// domain operations
export { askLambdaEndpoint } from './domain.operations/askLambdaEndpoint/askLambdaEndpoint';
export { asCacheWithoutSet } from './domain.operations/askLambdaEndpoint/cache/asCacheWithoutSet';
export { getAskLambdaCacheKey } from './domain.operations/askLambdaEndpoint/cache/getAskLambdaCacheKey';
// transformers
export { asLambdaEndpoint } from './domain.operations/asLambdaEndpoint/asLambdaEndpoint';
// test utils — the event source axis (construct the envelope a source delivers)
export { asLambdaEvent } from './domain.operations/asLambdaEvent/asLambdaEvent';
export { asApiGatewayResponseSchema } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/asApiGatewayResponseSchema';
export type {
  CorsConfig,
  ForApiGatewayContext,
  ForApiGatewayInput,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
export { forApiGateway } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
export { isApiGatewayResponse } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/isApiGatewayResponse';
export { genApiGatewayEventNormalizationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genApiGatewayEventNormalizationMiddleware';
export { genContentTypeCoherenceMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genContentTypeCoherenceMiddleware';
export { genZodBodyValidationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genZodBodyValidationMiddleware';
export type { UnifiedApiGatewayEvent } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/UnifiedApiGatewayEvent';
export type {
  EndpointOperation,
  FlatPayload,
  GenLambdaEndpointContext,
  GenLambdaEndpointInput,
  LambdaHandlerInput,
  WrappedPayload,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
export { genLambdaEndpoint } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/genLambdaEndpoint.forAskEndpoint';
export { genZodEventValidationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAskEndpoint/middleware/genZodEventValidationMiddleware';
/**
 * .what = the shared `request.context` reader every exported middleware uses
 * .why = it centralizes the one cast that reaches the trail fields this sdk itself wrote onto
 *        the lambda context. a consumer who authors a PEER of the exported middlewares would
 *        otherwise restate that cast — the exact sprawl this reader exists to retire
 *        (rule.forbid.as-cast)
 */
export {
  asContextTrailed,
  type ContextTrailed,
} from './domain.operations/genLambdaEndpoint/middleware/asContextTrailed';
export { genConstraintErrorMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genConstraintErrorMiddleware';
export { genInternalServiceErrorMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genInternalServiceErrorMiddleware';
export { genIntrospectionMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genIntrospectionMiddleware';
export { genIoLoggerMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genIoLoggerMiddleware';
// middleware (for advanced use)
export { genTrailMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genTrailMiddleware';
export { genZodOutputValidationMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genZodOutputValidationMiddleware';
/**
 * .what = the two error-body shapes `genConstraintErrorMiddleware.asOutputAfter` receives
 * .why = that middleware is public, so its OWN parameter type must be nameable by a consumer.
 *        an unexported parameter type forces an `any` or a hand-copied re-declaration at the
 *        public boundary (rule.forbid.as-cast)
 */
export type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from './domain.operations/genLambdaEndpoint/middleware/getErrorResponseBody';
/**
 * .note = `TranslateLog` is public because `logTranslate` accepts it, and it replaces the
 *         formerly-public `IoLogTranslate`. its three designed peers — `Translate<TShapes>`,
 *         `LambdaEndpointShapes`, `Translator<TFrom, TInto>` — are DELETED rather than
 *         unexported: no config field ever accepted a `Translate`, so all three would ship with
 *         zero consumers (rule.prefer.wet-over-dry). the design survives in `1.vision.yield.md`,
 *         so a later round restores a TERM from a record rather than a dead declaration
 */
export type { TranslateLog } from './domain.operations/genLambdaEndpoint/TranslateLog';
// sdk codegen (generate a per-service sdk from introspection)
export { genServiceSdk } from './domain.operations/genServiceSdk/genServiceSdk';
// contract discovery (for sdk generation)
export {
  type GetAllLambdaContractsContext,
  type GetAllLambdaContractsInput,
  getAllLambdaContracts,
} from './domain.operations/getAllLambdaContracts/getAllLambdaContracts';
export { getAllLambdaFunctionsByPrefix } from './domain.operations/getAllLambdaContracts/lambdaFunction/getAllLambdaFunctionsByPrefix';
export {
  type GetOneLambdaContractContext,
  type GetOneLambdaContractInput,
  getOneLambdaContract,
} from './domain.operations/getOneLambdaContract/getOneLambdaContract';
// test utils — the run boundary axis (run an endpoint by reference, or by slug)
export { asLambdaContext } from './domain.operations/runLambdaEndpoint/context/asLambdaContext';
// the narrows the union needs — a field read on `TOutput | Envelope` does not
// compile on EITHER arm, and an `as` cast is the only other way through.
// ⚠️ the success-side narrow was absent until self-review r6. the vision named
//    only the error one, so the MAJORITY case — a read on the handler's own
//    output — had no supported form at all.
export { asLambdaEndpointOutput } from './domain.operations/runLambdaEndpoint/dialect/asLambdaEndpointOutput';
// the envelope narrows, one per dialect (F22). contemp reads the codec-versioned
// tag (EXACT); ancient reads the flat shape (ambiguous by the wire). the caller
// names the dialect by WHICH function they call — so F9 (dialect-in-the-type)
// holds with no runtime dialect argument.
export {
  asLambdaEndpointErrorEnvelopeAncient,
  asLambdaEndpointErrorEnvelopeContemp,
  isLambdaEndpointErrorEnvelopeAncient,
  isLambdaEndpointErrorEnvelopeContemp,
} from './domain.operations/runLambdaEndpoint/dialect/isLambdaEndpointErrorEnvelope';
export type {
  LambdaEndpointErrorEnvelope,
  LambdaEndpointRunOutput,
} from './domain.operations/runLambdaEndpoint/dialect/LambdaEndpointRunOutput';
export { runLambdaEndpoint } from './domain.operations/runLambdaEndpoint/runLambdaEndpoint';
export type { LambdaEndpointHandlerReferenced } from './domain.operations/runLambdaEndpoint/runLambdaEndpoint.onReferenced';
export type { LambdaEndpointLocus } from './domain.operations/runLambdaEndpoint/runLambdaEndpoint.onSerialized';
