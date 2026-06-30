/**
 * sdk-aws-lambda
 *
 * define endpoints, ask endpoints, auto-propagate trace-ids.
 */

// re-export from helpful-errors for convenience
export { BadRequestError } from 'helpful-errors';

// domain objects
export type { ContextAwsLambdaCaller } from './domain.objects/ContextAwsLambdaCaller';
export type {
  ContextAwsLambdaServer,
  EnvAccess,
  EnvConfig,
} from './domain.objects/ContextAwsLambdaServer';
export { HttpStatusCode } from './domain.objects/HttpStatusCode';
export { LambdaEndpoint } from './domain.objects/LambdaEndpoint';
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
export type {
  CorsConfig,
  ForApiGatewayContext,
  ForApiGatewayInput,
} from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
export { forApiGateway } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/genLambdaEndpoint.forApiGateway';
export type { UnifiedApiGatewayEvent } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genApiGatewayEventNormalizationMiddleware';
export { genApiGatewayEventNormalizationMiddleware } from './domain.operations/genLambdaEndpoint/genLambdaEndpoint.forApiGateway/middleware/genApiGatewayEventNormalizationMiddleware';
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
export { genConstraintErrorMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genConstraintErrorMiddleware';
export { genIntrospectionMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genIntrospectionMiddleware';
export type { IoLogTranslate } from './domain.operations/genLambdaEndpoint/middleware/genIoLoggerMiddleware';
export { genIoLoggerMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genIoLoggerMiddleware';
// middleware (for advanced use)
export { genTrailMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genTrailMiddleware';
export { genZodOutputValidationMiddleware } from './domain.operations/genLambdaEndpoint/middleware/genZodOutputValidationMiddleware';
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
