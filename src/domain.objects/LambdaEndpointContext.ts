import type { ContextLogTrail } from 'sdk-logs';

/**
 * .what = the context shape passed to lambda endpoint handlers
 * .why = provides trail-aware log methods for correlation across requests
 */
export type LambdaEndpointContext = ContextLogTrail;
