/**
 * .what = the two error-envelope shapes a lambda endpoint answers with, one per
 *         caller dialect
 * .why = a domain shape two operations share: `genLambdaEndpoint` WRITES it (the
 *   constraint middleware returns it) and `runLambdaEndpoint` TYPES it (the dialect
 *   generic puts it in the public return). their common ancestor is
 *   `domain.objects/` (rule.prefer.most-common-denominator).
 *
 * @see invariant.ancient-vs-contemp-callers — why two shapes rather than one
 */

/**
 * the ancient envelope — flat, for a caller that predates the trail wrapper
 *
 * ⚠️ an ancient caller reads `errorType` and branches on the string, so these field
 *    names are a contract with code we do not own.
 */
export interface LambdaEndpointErrorResponseBodyAncient {
  errorMessage: string;
  errorType: string;
  /**
   * .note = the legacy wire name, NOT a synonym we coined. the producer this sdk
   *   replaces emits it verbatim — `ehmpathy/simple-lambda-handlers`,
   *   `badRequestErrorMiddleware.ts:88,99`. contemp's peer field is `cause`, and
   *   that one IS ours to choose.
   */
  causeMessage?: string;
  details?: unknown;
}

/**
 * .what = the stable PREFIX of the contemp serde tag — the whole discriminator
 * .why = 🔴 one WRITER for three operations to compare against. a producer and a
 *   detector that disagree do not fail loudly — the detector simply stops to
 *   recognize the envelope, and a caller fault reads as a success payload.
 */
export const LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX =
  'LambdaEndpointError::contemp' as const;

/**
 * the codec version of the contemp envelope's on-wire shape.
 * bump ONLY when the shape below changes in a way a decoder must branch on.
 *
 * 🟡 the `v` earns its character: `@v1` cannot be misread as a count, an index, or
 *    a package version, where a bare `@1` can.
 *
 * .note = the CODEC's version, not the service's. it is hand-maintained here
 *   rather than read from `package.json` (which `rootDir: 'src'` also forbids).
 */
export const LAMBDA_ENDPOINT_ERROR_CODEC_VERSION_CONTEMP = 'v1' as const;

/**
 * the full contemp serde tag — prefix + codec version.
 *
 * 🔴 producers stamp THIS; detectors match the PREFIX and read the version as
 *    opaque data. a tag compared by EQUALITY is a wire break on every release — a
 *    service on `v1` would stop to recognize a `v2` envelope, and per the prefix
 *    docblock that failure is silent.
 */
export const LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP =
  `${LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}@${LAMBDA_ENDPOINT_ERROR_CODEC_VERSION_CONTEMP}` as const;

/**
 * the contemp envelope — nested under `error`, with an explicit versioned serde tag
 *
 * `_serde` is typed as a `${prefix}@${string}` template, NOT the exact current tag:
 * a decoder must accept any codec version, while a producer writes the current one.
 */
export interface LambdaEndpointErrorResponseBodyContemp {
  error: {
    _serde: `${typeof LAMBDA_ENDPOINT_ERROR_SERDE_CONTEMP_PREFIX}@${string}`;
    class: string;
    message: string;
    cause?: string;
    details?: unknown;
  };
}
