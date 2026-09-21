import { ConstraintError } from 'helpful-errors';

/**
 * .what = refuses a handler this util cannot run, with an error that names the fix
 * .why = both boundaries need these guards AHEAD of any delegation, so they live
 *   in one shared operation with two call sites.
 *
 * 🔴 placement is the whole repair, and it is measured. with this removed from
 *    `onSerialized` the same guard fires INSIDE the delegation and
 *    `asWireFunctionErrorPayload` washes its metadata — same `ConstraintError`,
 *    and `metadata.hint` is gone.
 *
 * ⚠️ a duplicate ahead of the delegation would repair the probed caller and leave
 *    every other hint-bearer washed. see `serde/asWireFunctionErrorPayload.ts`.
 */
export const assertHandlerIsRunnable = (input: { handler: unknown }): void => {
  // 🔴 the likeliest migrant slip is the IMPORT: a wrong export name binds
  //    `handler` to `undefined`, and `input.handler(…)` throws a bare
  //    `TypeError: input.handler is not a function` — which names neither this
  //    util nor the fix (rule.require.errors-name-the-fix).
  //
  //  .note = typescript types `handler` as a function at the referenced boundary,
  //    so this reads redundant there. a test file is routinely `any`-typed at the
  //    import, and this is the external boundary.
  //
  //  .note = no `return` prefix — `ConstraintError.throw` answers `never` and this
  //    answers `void`, which trips `lint/correctness/noVoidTypeReturn`.
  if (typeof input.handler !== 'function')
    ConstraintError.throw(
      'the handler given is not a function, so there is no endpoint to run',
      {
        received:
          input.handler === undefined ? 'undefined' : typeof input.handler,
        hint: 'check the import — a wrong export name binds `handler` to undefined. `runLambdaEndpoint.onReferenced` takes the handler itself, never its module.',
      },
    );

  // 🔴 a CALLBACK-style handler is refused by ARITY, because its failure is
  //    otherwise SILENT. it answers `undefined` rather than a promise, so the
  //    author gets `undefined` back on a green path and the handler's later
  //    `callback(err, result)` throws OUT OF BAND with no test to fail —
  //    rule.forbid.failhide at the boundary.
  //
  //    measured by a probe that disabled this guard:
  //
  //    | the handler | without this guard |
  //    |---|---|
  //    | calls `callback(…)` synchronously | `TypeError: callback is not a function` |
  //    | calls it later, or not at all | 🔴 no error at all — `undefined`, green |
  //
  //    the second is the shape a REAL callback handler takes, so the common case
  //    is the silent one.
  //
  // .note = the false positive is a promise handler that declares an unused third
  //   parameter. measured across `ahbode/*`: 1 match, in a research doc, never a
  //   handler — every handler in the population is middy-wrapped. the hint names
  //   the escape rather than assume it cannot happen.
  //
  // 🔴 .the MIRROR false negative is real: `Function.prototype.length` counts
  //    parameters before the first rest, so `(...args) => handler(...args)`
  //    reports 0 whatever it wraps — the shape `rule.require.hook-wrapper-pattern`
  //    composes with. a thenable check cannot fix it either: a SYNC handler answers
  //    a non-thenable exactly as a callback handler does. clamped as a known limit
  //    (`assertHandlerIsRunnable.knownLimit.test.ts`).
  //
  //    ⇒ this guard is a NET, never a proof.
  if (input.handler.length >= 3)
    ConstraintError.throw(
      'the handler given is callback-style, and this util runs handlers that answer with a promise',
      {
        declaredParameters: input.handler.length,
        hint: 'answer with a promise instead of a callback — `async (event, context) => …`. if your handler already answers with a promise and merely declares an unused third parameter, drop it from the signature.',
      },
    );
};
