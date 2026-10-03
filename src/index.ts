/**
 * sdk-aws-lambda
 *
 * define endpoints, ask endpoints, auto-propagate trace-ids.
 *
 * .note = the trace-id propagates lambda to lambda, via the `{ event, trail }` wrapper
 *        `askLambdaEndpoint` sends. it does not cross an http or a queue boundary — those
 *        triggers mint a fresh `exid` per invoke (`domain.terms/trail.md`)
 */

// re-export from helpful-errors for convenience
export { BadRequestError } from 'helpful-errors';
/**
 * .what = the type of every value a `genLambdaEndpoint.for*` variant hands its `invoke`
 * .why = a consumer who declares a handler apart from the call site must be able to name it
 * .note = `FrozenDeep` is type-fns' own, re-exported so no consumer import changes
 */
export type { FrozenDeep } from 'type-fns';

/**
 * .what = releases every LambdaClient this sdk memoized on the caller's behalf
 * .why = `askLambdaEndpoint` findserts a client per region and holds it for the process, so
 *        its keep-alive agent can hold the event loop open in a cli or one-off command. a
 *        library that makes process-lifetime state owes the caller a way to release it
 */
export { delLambdaSdks } from './access/sdks/lambda/genLambdaSdk';
// domain objects
export type { ApiGatewayRequestEventOnwire } from './domain.objects/ApiGatewayRequestEventOnwire';
export type { ApiGatewayResponse } from './domain.objects/ApiGatewayResponse';
export type { ApiGatewayResponseOnwire } from './domain.objects/ApiGatewayResponseOnwire';
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
/**
 * .what = the `genLambdaEndpoint` family —
 *         `{ forAsk, forApiGateway, forSqs: { perRecord, perBatch } }`
 * .why = no variant is exported bare beside it, so autocomplete enumerates the family
 *        (`rule.forbid.unqualified-variant-exports`)
 */
export { genLambdaEndpoint } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint';
export type {
  ApiGatewayHeadersDeclared,
  ApiGatewayHeadersMerged,
  ApiGatewayHeadersOnwire,
  ApiGatewayRequestEventUnified,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/ApiGatewayRequestEventUnified';
export { asApiGatewayResponseSchema } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/asApiGatewayResponseSchema';
export type {
  CorsConfig,
  ForApiGatewayContext,
  ForApiGatewayInput,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
export { isApiGatewayResponse } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/isApiGatewayResponse';
export { genApiGatewayRequestEventNormalizationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genApiGatewayRequestEventNormalizationMiddleware';
export { genContentTypeCoherenceMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genContentTypeCoherenceMiddleware';
export { genZodInputValidationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genZodInputValidationMiddleware';
export type {
  EndpointOperation,
  FlatPayload,
  GenLambdaEndpointContext,
  GenLambdaEndpointInput,
  LambdaHandlerInput,
  WrappedPayload,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/genLambdaEndpoint.forAsk';
export { genZodEventValidationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forAsk/middleware/genZodEventValidationMiddleware';
/**
 * .what = the `forSqs` sub-family's types, through `SqsEventDecoded`
 * .why = each is reachable from `ForSqsPerRecordInput` / `ForSqsPerBatchInput`, so a consumer
 *        must be able to name it
 * .note = the chain's own operations (`asSqsEventDecoded`, `setSqsRecordValidated`, …) stay
 *         unexported, as do the api-gateway peers
 */
export type {
  ForSqsPerBatchInput,
  SqsRecordSuccessRef,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perBatch';
export type { ForSqsPerRecordInput } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/genLambdaEndpoint.forSqs.perRecord';
export type {
  SqsEventDecoded,
  SqsHeadersDeclared,
  SqsHeadersMerged,
  SqsHeadersOnwire,
  SqsRecordDecoded,
  SqsRecordDecodedShape,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forSqs/SqsEventDecoded';
/**
 * .what = the shared `request.context` reader every exported middleware uses
 * .why = it holds the one cast to the trail fields this sdk writes, so a consumer who authors a
 *        peer middleware need not restate it (rule.forbid.as-cast)
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
 * .why = a public middleware's parameter types must be nameable by a consumer
 */
export type {
  LambdaEndpointErrorResponseBodyAncient,
  LambdaEndpointErrorResponseBodyContemp,
} from './domain.operations/genLambdaEndpoint/middleware/getErrorResponseBody';
/**
 * .what = the two ROOT primitives a consumer needs to validate a border in a chain of their own
 * .why = the advanced-use exports above are middlewares, and the one on the OUTPUT side —
 *        `genZodOutputValidationMiddleware` — is positionally ambiguous by its own admission
 *        (F33). so a consumer who wanted to validate output safely had exactly one public tool,
 *        and it was the foot-gun: the atom was hidden and the risky composite was public
 *
 *        these two are unambiguous by construction — each takes the value it validates as an
 *        argument rather than reads it out of a slot whose type depends on registration order.
 *        so a consumer builds their own correctly-ordered step and the ambiguity never reaches it
 *
 * .note = this does NOT settle F33. that fulcrum asks whether the middleware should keep its
 *         export at all, and it belongs to the bound that shipped it
 *         (`.behavior/v2026_08_03.feat-apigateway-wire-response/`). what this changes is that the
 *         ambiguous export is no longer the ONLY option — which is the half that needed no
 *         wisher call, because it breaks no consumer (rule.always.fix-forward-under-scouts-honor)
 *
 * .note = each metadata type rides along for the same reason `LambdaEndpointErrorResponseBody*`
 *         does — a consumer who catches the throw must be able to NAME what `.metadata` holds,
 *         or they reach for an `as`-cast at the public boundary (rule.forbid.as-cast)
 */
export { getValidatedInput } from './domain.operations/genLambdaEndpoint/middleware/getValidatedInput';
export {
  getValidatedOutput,
  type OutputValidationErrorMetadata,
} from './domain.operations/genLambdaEndpoint/middleware/getValidatedOutput';
export type { ValidationErrorMetadata } from './domain.operations/genLambdaEndpoint/middleware/getValidationError';
export type { ZodIssueSummary } from './domain.operations/genLambdaEndpoint/middleware/getZodIssuesSummary';
/**
 * .what = the `logTranslate` config type
 * .note = `TranslateLog` is public because `logTranslate` accepts it, and it replaces the
 *         formerly-public `IoLogTranslate`. its three designed peers — `Translate<TShapes>`,
 *         `LambdaEndpointShapes`, `Translator<TFrom, TInto>` — are DELETED rather than
 *         unexported: no config field ever accepted a `Translate`, so all three would ship with
 *         zero consumers (rule.prefer.wet-over-dry)
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
