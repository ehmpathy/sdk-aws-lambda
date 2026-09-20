import { LambdaClient, type LambdaClientConfig } from '@aws-sdk/client-lambda';
import { serialize } from 'domain-objects';
import { MalfunctionError } from 'helpful-errors';

/**
 * .what = the LambdaClient already made per distinct client config
 * .why = `gen` promises findsert, so the same input must converge on the same client.
 *        a client per call is an `https.Agent` per call, and an agent's keep-alive pool
 *        is per-agent — so a fresh agent always starts empty, never reuses a socket, and
 *        starves the runtime's dns budget (`getaddrinfo EBUSY` -> `Runtime.ExitError`)
 */
const sdkByConfig: Map<string, LambdaClient> = new Map();

/**
 * .what = the memo key for a LambdaClient config
 * .why = the key must cover EVERY knob that changes client identity, so it derives from
 *        the config object itself rather than from a hand-listed field. a hand-listed key
 *        silently hands back a wrong-config client the day a second knob lands
 * .note = throws when a knob does not survive serialization (e.g. a function-valued
 *         `credentials` provider), since such a knob would collide in silence
 */
const asLambdaSdkMemoKey = (config: LambdaClientConfig): string => {
  const key = serialize(config);

  // failfast when a knob drops out of the key; a dropped knob is a silent collision
  const knobsGiven = Object.keys(config);
  const knobsKeyed = Object.keys(JSON.parse(key) as Record<string, unknown>);
  if (knobsKeyed.length !== knobsGiven.length)
    MalfunctionError.throw(
      'lambda sdk config holds a knob the memo key drops',
      {
        knobsGiven,
        knobsKeyed,
      },
    );

  return key;
};

/**
 * .what = findserts the LambdaClient for this config; returns the injected one, if any
 * .why = named transformer for clear narrative in orchestrator
 */
export const genLambdaSdk = (input: {
  sdk?: LambdaClient;
  env?: { region?: string };
}): LambdaClient => {
  // return injected LambdaClient if provided
  if (input.sdk) return input.sdk;

  // build the config, let sdk infer region unless explicitly provided
  const config: LambdaClientConfig = input.env?.region
    ? { region: input.env.region }
    : {};

  // find the client already made for this config, if any
  const key = asLambdaSdkMemoKey(config);
  const sdkFound = sdkByConfig.get(key);
  if (sdkFound) return sdkFound;

  // otherwise, insert one
  const sdkMade = new LambdaClient(config);
  sdkByConfig.set(key, sdkMade);
  return sdkMade;
};

/**
 * .what = releases every memoized LambdaClient and destroys its sockets
 * .why = the `del` mirror of `gen`. a memoized client holds a keep-alive agent, and a live
 *        agent can hold the event loop open in a cli or a one-off command, which drains its
 *        loop rather than a call to `process.exit`. this is that escape hatch
 */
export const delLambdaSdks = (): void => {
  for (const sdk of sdkByConfig.values()) sdk.destroy();
  sdkByConfig.clear();
};
