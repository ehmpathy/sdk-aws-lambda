import { ConstraintError } from 'helpful-errors';
import { given, then, when } from 'test-fns';

import { genInternalServiceErrorMiddleware } from './genInternalServiceErrorMiddleware';

/**
 * .what = the clamp on WHAT cloudwatch carries when a handler faults
 * .why = the wire body a caller meets is deliberately generic — no internal detail, no secret —
 *        so the log is the ONLY surface that can carry a diagnosis. that made it the quietest
 *        regression surface in this chain: `handler.error` had zero assertions anywhere in the
 *        repo, so its shape could drift or lose a field with no test to notice
 *        (rule.require.clamp-edge-cases)
 *
 * ⚠️ .what this does NOT clamp = the wire body. whether a 500 may name an internal schema
 *         position is a disclosure call reserved to the wisher (`F02`), so the gap there is
 *         snapped at `genLambdaEndpoint.forApiGateway.test.ts [case17][t1]` rather than closed
 *
 * ⚠️ .the bite, MEASURED = the `endpoint` key was struck from the subject and this file re-run:
 *         **2 failed, 1 passed** — `[case1]` and `[case2]` go RED, and `[case3]` stays GREEN.
 *         the green one is what proves the clamp is SCOPED rather than broadly coupled: it
 *         asserts the log does NOT fire, so it cannot depend on the field's presence. a clamp
 *         whose every case moved would prove only that the file runs
 *         (`rule.require.clamp-edge-cases` — prove the clamp bites, and prove it bites HERE)
 */
describe('genInternalServiceErrorMiddleware', () => {
  const asMockLog = (): {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  } => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  });

  const asRequest = (input: {
    error: Error;
    log: ReturnType<typeof asMockLog>;
    functionName?: string;
  }): Parameters<
    NonNullable<ReturnType<typeof genInternalServiceErrorMiddleware>['onError']>
  >[0] =>
    ({
      event: {},
      response: undefined,
      error: input.error,
      internal: {},
      context: {
        log: input.log,
        ...(input.functionName ? { functionName: input.functionName } : {}),
      },
    }) as unknown as Parameters<
      NonNullable<
        ReturnType<typeof genInternalServiceErrorMiddleware>['onError']
      >
    >[0];

  given('[case1] a server fault, on an endpoint aws named', () => {
    when('[t0] the middleware handles it', () => {
      then('the log names WHICH endpoint raised it', async () => {
        // .why = introspection is service-wide, so one bad schema position 500s
        //        `getAllLambdaContracts` for every endpoint beside it. without this field the
        //        log says WHAT broke and never WHERE, and the caller's 500 carries only a
        //        correlation id — so the engineer has no path from the symptom to the endpoint
        const log = asMockLog();
        const middleware = genInternalServiceErrorMiddleware({
          asOutputAfter: () => ({ statusCode: 500 }),
        });

        await middleware.onError(
          asRequest({
            error: new Error('Void cannot be represented in JSON Schema'),
            log,
            functionName: 'svc-surf-prep-getWaveReport',
          }),
        );

        // the three fields that CARRY the claim, asserted by name
        expect(log.error).toHaveBeenCalledWith(
          'handler.error',
          expect.objectContaining({
            endpoint: 'svc-surf-prep-getWaveReport',
            errorMessage: 'Void cannot be represented in JSON Schema',
            stackTrace: expect.any(String),
          }),
        );

        /**
         * ⚠️ .why the no-extra-keys claim moved to a SNAPSHOT = an earlier draft asserted the
         *    whole payload with an exact `toHaveBeenCalledWith({ … })`. that is brittle in the
         *    ADDITIVE direction: the day someone legitimately adds a `correlationId` or a
         *    `cause`, this goes red while all three fields above are still correct and
         *    present — a benign addition dressed as a regression (`r009.nitpick.2`)
         *
         * ⇒ so the two claims are now carried by the two instruments that suit them:
         *     - the three fields are ASSERTED above, by name, and cannot drift silently
         *     - the payload's full SHAPE is snapped here, so an added key surfaces in a diff a
         *       reviewer reads rather than in a failure they must decode
         *       (`rule.require.snapshots` — both, never one)
         *
         * .note = this is a DENYLIST, never an allowlist: the payload is spread WHOLE and only
         *         `stackTrace` is masked, because it is the one volatile field (it carries
         *         absolute paths and line numbers of this machine). a field nobody predicted
         *         still shows up here
         *         (rule.require.snapshots-deny-volatile-not-allow-expected)
         *
         * ⚠️ .the SNAPSHOT's own bite, MEASURED — and it is a SECOND measurement, never the one
         *    recorded at the top of this file. that one struck a field and proved the NAMED
         *    assertions bite; a partial matcher cannot catch an ADDITION by construction, so the
         *    no-extra-keys claim rests on this line alone and owed a probe of its own:
         *
         *      `correlationId: 'probe'` added to the subject's logged payload, then re-run
         *        -> **2 passed, 1 failed** — and the failure is `toMatchSnapshot()` at THIS line,
         *           reported as `+ "correlationId": "probe"`. the two partial-match assertions
         *           above stayed GREEN, which is the division of labor claimed here, observed
         *      reverted -> **3 passed, 0 failed**
         *
         * ⇒ so the strictness an exact `toHaveBeenCalledWith` would have carried is not lost, it
         *   is relocated — and the relocation is now proven rather than argued (`r011` put the
         *   concern on the record and did not press it; `rule.require.clamp-edge-cases`)
         */
        const [, payload] = log.error.mock.calls[0]!;
        expect({ ...payload, stackTrace: '[masked]' }).toMatchSnapshot();
      });
    });
  });

  given('[case2] a server fault, where aws named no function', () => {
    when('[t0] the middleware handles it', () => {
      then('the field is null rather than absent', async () => {
        // .why = an ABSENT key and a null one read differently to a log query: absent means the
        //        field was never emitted, null means it was emitted and unknown. the second is
        //        the truth here, and it is the one that tells a reader the harness — never the
        //        endpoint — is what the log lacked
        const log = asMockLog();
        const middleware = genInternalServiceErrorMiddleware({
          asOutputAfter: () => ({ statusCode: 500 }),
        });

        await middleware.onError(asRequest({ error: new Error('boom'), log }));

        expect(log.error).toHaveBeenCalledWith(
          'handler.error',
          expect.objectContaining({ endpoint: null }),
        );
      });
    });
  });

  given('[case3] a CALLER fault, which this middleware does not own', () => {
    when('[t0] the middleware sees it', () => {
      then(
        'it logs naught — a constraint error is not a server fault',
        async () => {
          // .why = the positive control for the two cases above. without it, a green `[case1]`
          //        could equally mean "the log fires for every error", which would prove the
          //        endpoint field reaches the log and prove naught about the filter
          //        (invariant.badrequesterror-not-lambda-error)
          const log = asMockLog();
          const middleware = genInternalServiceErrorMiddleware({
            asOutputAfter: () => ({ statusCode: 500 }),
          });

          await middleware.onError(
            asRequest({ error: new ConstraintError('bad input'), log }),
          );

          expect(log.error).not.toHaveBeenCalled();
        },
      );
    });
  });
});
