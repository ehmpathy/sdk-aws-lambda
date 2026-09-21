import { given, then, when } from 'test-fns';

import * as sdk from './index';

/**
 * .what = pins the surface a migrant swaps their import TO
 * .why = case=1 is the wish's literal done-when — a repo drops
 *        `simple-lambda-testing-methods` and swaps to this package. that swap is
 *        possible only if the successor for each retired family is reachable
 *        from the package ROOT (fulcrum F4).
 *
 *        every other test in this drive imports by deep relative path, so not one
 *        of them would notice if an export fell out of the barrel. the migrant
 *        would notice immediately, and only they would.
 */
describe('[case1] the migrant swaps the import', () => {
  given('a repo that retires the simple-lambda-* test family', () => {
    when('[t0] it reaches for the referenced-invoke successor', () => {
      then('runLambdaEndpoint is exported, with both boundaries', () => {
        // invokeHandlerForTesting → onReferenced (20 repos / 318 sites)
        // invokeLambdaForTesting → onSerialized (24 repos / 519 sites)
        expect(typeof sdk.runLambdaEndpoint.onReferenced).toEqual('function');
        expect(typeof sdk.runLambdaEndpoint.onSerialized).toEqual('function');
      });

      then(
        'onReferenced takes no locus, so the barred cell cannot be asked for',
        () => {
          // referenced × cloud is unrepresentable BY ARITY, never policed
          // (define.lambda-endpoint-run-boundary). the arity is the guard, so it
          // is the arity this pins.
          expect(sdk.runLambdaEndpoint.onReferenced.length).toEqual(1);
        },
      );
    });

    when('[t1] it reaches for the event-factory successors', () => {
      then('all five sources are exported, and no sixth is invented', () => {
        // createExample{APIGateway,SNS,SQS,Kinesis,S3}Event → asLambdaEvent.from$Source
        // (wish A2 — 8 repos / 254 sites)
        expect(Object.keys(sdk.asLambdaEvent).sort()).toEqual([
          'fromApiGateway',
          'fromKinesis',
          'fromS3',
          'fromSns',
          'fromSqs',
        ]);
      });

      then('there is deliberately no fromAsk', () => {
        // the ask source wraps naught — the event IS the payload — so a factory
        // for it would be an identity function.
        expect('fromAsk' in sdk.asLambdaEvent).toEqual(false);
      });
    });

    when('[t2] it needs a lambda context to hand a handler', () => {
      then('asLambdaContext is exported', () => {
        expect(typeof sdk.asLambdaContext).toEqual('function');
      });

      then('it is the jest-free half, so it may ship', () => {
        // createTestContext's createMockLog calls jest.fn() and must stay
        // private (case=6). this is the portable half that travels instead.
        // 🟡 the claim is REACHABILITY — a call through the built barrel that
        //    resolves with no jest import in its graph. so the literal is the
        //    right assertion, never `expect.any(String)`: an `any` read passes
        //    on the empty string, which a broken default would also produce.
        expect(sdk.asLambdaContext().functionName).toEqual(
          'run-lambda-endpoint',
        );
      });
    });

    when('[t3] it needs to READ what a run of an endpoint answers', () => {
      // 🔴 every assertion here names one export BY HAND, so a NEW export is
      //    invisible to all of them — a guard whose own update is manual drifts.
      //    `[t4]`'s KEY-SET assertion is the repair, and it fails loud on the
      //    next added export rather than let it slip past.
      //
      //    the narrows are not an extra. `onReferenced` returns
      //    `TOutput | Envelope`, and typescript refuses a field read on a union
      //    unless the field is on EVERY arm — so absent these at the root a
      //    migrant's only way to a field is an `as` cast, the exact defect
      //    case=2 promised the type would remove (rule.forbid.as-cast).
      then('both narrows ship — the error arm AND the output arm', () => {
        // the error narrows are a DIALECT PAIR now (F22): contemp reads the
        // codec-versioned tag (exact), ancient reads the flat shape.
        expect(typeof sdk.isLambdaEndpointErrorEnvelopeContemp).toEqual(
          'function',
        );
        expect(typeof sdk.asLambdaEndpointErrorEnvelopeContemp).toEqual(
          'function',
        );
        expect(typeof sdk.isLambdaEndpointErrorEnvelopeAncient).toEqual(
          'function',
        );
        expect(typeof sdk.asLambdaEndpointErrorEnvelopeAncient).toEqual(
          'function',
        );

        // 🔴 the SUCCESS arm. it is the MAJORITY read — most assertions read the
        //    handler's own output — and the vision named only its error twin.
        expect(typeof sdk.asLambdaEndpointOutput).toEqual('function');
      });

      then('the contemp narrow reads the contemp envelope', () => {
        // contemp is the default dialect on the CALL, so the contemp narrow is
        // the one a default caller reaches for.
        const envelope = sdk.asLambdaEndpointErrorEnvelopeContemp({
          error: {
            _serde: 'LambdaEndpointError::contemp',
            class: 'ConstraintError',
            message: 'the uuid names no known surfer',
          },
        });
        expect(envelope.error.class).toEqual('ConstraintError');
      });

      then(
        'the output narrow returns the output, and refuses an envelope',
        () => {
          expect(sdk.asLambdaEndpointOutput({ found: true })).toEqual({
            found: true,
          });

          // fails LOUD rather than hands back an envelope typed as an output
          expect(() =>
            sdk.asLambdaEndpointOutput({
              error: {
                _serde: 'LambdaEndpointError::contemp',
                class: 'ConstraintError',
                message: 'nope',
              },
            }),
          ).toThrow('never an output');
        },
      );
    });

    // 🔴 the DRIFT CLAMP for every hand-named assertion above.
    //
    //    the list is EXPLICIT rather than a snapshot. hand-maintained is the
    //    cost; it FAILS LOUD the moment the barrel changes, which is the point.
    //    when it fails, answer: does a migrant need this export, and is it
    //    asserted above?
    when('[t4] the barrel itself grows', () => {
      then(
        'every RUNTIME export is accounted for, so a new one cannot slip in',
        () => {
          expect(Object.keys(sdk).sort()).toEqual([
            'BadRequestError',
            'GeneratedFile',
            'HttpStatusCode',
            'LambdaCredentialsAbsentError',
            'LambdaDomainObjectNotCapturableError',
            'LambdaDomainObjectRefUnbindableError',
            'LambdaEndpoint',
            'LambdaEndpointError',
            'LambdaFunctionNotFoundError',
            'LambdaIntrospectionBlockedError',
            'LambdaIntrospectionNotSupportedError',
            'LambdaServiceNotFoundError',
            'asApiGatewayResponseSchema',
            'asCacheWithoutSet',
            'asContextTrailed',
            // the run-boundary + event-source surface this wish adds — each
            // asserted individually above. ⚠️ NO count is stated: a count goes
            // stale as the surface grows, which is the very drift this
            // told-guard exists to catch.
            'asLambdaContext',
            'asLambdaEndpoint',
            'asLambdaEndpointErrorEnvelopeAncient',
            'asLambdaEndpointErrorEnvelopeContemp',
            'asLambdaEndpointOutput',
            'asLambdaEvent',
            'askLambdaEndpoint',
            'delLambdaSdks',
            'forApiGateway',
            'genApiGatewayEventNormalizationMiddleware',
            'genConstraintErrorMiddleware',
            'genContentTypeCoherenceMiddleware',
            'genInternalServiceErrorMiddleware',
            'genIntrospectionMiddleware',
            'genIoLoggerMiddleware',
            'genLambdaEndpoint',
            'genServiceSdk',
            'genTrailMiddleware',
            'genZodBodyValidationMiddleware',
            'genZodEventValidationMiddleware',
            'genZodOutputValidationMiddleware',
            'getAllLambdaContracts',
            'getAllLambdaFunctionsByPrefix',
            'getAskLambdaCacheKey',
            'getOneLambdaContract',
            'isApiGatewayResponse',
            'isLambdaEndpointErrorEnvelopeAncient',
            'isLambdaEndpointErrorEnvelopeContemp',
            'runLambdaEndpoint',
          ]);
        },
      );
    });

    /**
     * 🔴 the TYPE half of the barrel. `[t4]` reads `Object.keys(sdk)`, so it
     * sees runtime values and NO type export at all — delete one and every unit
     * test stays green, because a type has no runtime key to be absent from.
     * the migrant's build breaks; ours does not.
     *
     * .how = the annotations below ARE the assertion. a removed type export is a
     *   compile error here, so the TYPE GATE is the clamp and the runtime body
     *   merely keeps the bindings live.
     */
    when('[t5] the barrel grows a TYPE export', () => {
      then('every type this wish adds is reachable from the root', () => {
        const dialect: sdk.LambdaEndpointDialect = 'ancient';
        const locus: sdk.LambdaEndpointLocus = 'local';

        const envelope: sdk.LambdaEndpointErrorEnvelope<'ancient'> = {
          errorMessage: 'the uuid names no known surfer',
          errorType: 'BadRequestError',
        };

        const run: sdk.LambdaEndpointRunOutput<{ found: boolean }, 'contemp'> =
          { found: true };

        const handler: sdk.LambdaEndpointHandlerReferenced<
          { uuid: string },
          { found: boolean }
        > = async () => ({ found: true });

        expect(dialect).toEqual('ancient');
        expect(locus).toEqual('local');
        expect(envelope.errorType).toEqual('BadRequestError');
        expect(run).toEqual({ found: true });
        expect(typeof handler).toEqual('function');
      });
    });
  });
});
