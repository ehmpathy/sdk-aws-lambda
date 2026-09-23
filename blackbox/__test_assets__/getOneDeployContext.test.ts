import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, useThen, when } from 'test-fns';

import {
  DEPLOY_CREDENTIAL_HINT_ABSENT,
  DEPLOY_CREDENTIAL_HINT_REFUSED,
  getOneDeployContext,
  getOneDeployCredentialRefusal,
} from './getOneDeployContext';

/**
 * .what = the credential-refusal contract of the one operation all four `deployed.*`
 *         acceptance suites open with
 * .why = it was the single error surface in this diff with NO test of its own. every other
 *        one is snapshotted, and this one is what a human meets FIRST when a deployed suite
 *        cannot run — so its message and its hint are the whole of its value, and neither
 *        was clamped
 *
 * ⚠️ .why that asymmetry is worth a test rather than a shrug = this operation's `--env test`
 *    hint was itself the root cause of two prior multi-round failures on this branch. an
 *    unlock at the wrong tier grants a key a `test`-scoped source cannot read, so the human
 *    runs the command, it reports success, and the suite fails again with this same message.
 *    a hint that sends the reader in a circle is worse than none
 *    (rule.require.errors-name-the-fix), and prose alone is no clamp
 *
 * ⚠️ .why the two arms are clamped at DIFFERENT grains = the subject has two, and what each
 *    needs to fire differs:
 *
 *      arm                    | what it needs to fire     | so its BEHAVIOR is clamped
 *      -----------------------|---------------------------|---------------------------------
 *      credential ABSENT      | an env with neither key   | here — `[case1]`, `[case2]`
 *      credential REFUSED     | a live aws that says no   | transitively, by `deployed.*`
 *
 *    the second arm cannot be REACHED without the aws sdk, which is a remote boundary a unit
 *    test may not cross (`rule.forbid.unit.remote-boundaries`). to reach for a mock here
 *    would clamp the mock rather than the arm
 *
 * ⚠️ .the correction, taken at i014 = an earlier draft read that clause as "the REFUSED arm
 *    stays uncovered" and stopped there. that conflated two subjects: the arm's BEHAVIOR,
 *    which genuinely needs the boundary, and its TEXT, which never did
 *    ⇒ a hint is a string this subject OWNS, so a name makes it assertable with no call at
 *      all. `[case3]` clamps that half, and the hints are exported constants for that reason.
 *      the behavior half stays uncovered here, and is reached by every
 *      `deployed.*.acceptance.test.ts` whenever a credential goes stale
 *
 * ⚠️ .the SECOND correction, taken at i005 = the correction above stopped one level short. it
 *    named the hint as the text half — and a hint is a FRAGMENT of the surface, never the
 *    surface. three review rounds said so, and twice the answer was a deferral to the same
 *    credential gate the correction above had already dissolved
 *    ⇒ `[case4]` clamps the WHOLE frame — the wrap message, the facts beside it, and where
 *      the preserved sdk cause actually lands. the bound that survives is narrower than it
 *      was, and it is stated at each case rather than inferred from this header
 *
 * .note = `process.env` is mutated and restored per case. that is process-local state, so it
 *         crosses no boundary — and it is the ONLY way to reach a guard whose whole input is
 *         the ambient env (rule.require.immutable-vars: the deliberate exception, declared)
 */
describe('getOneDeployContext', () => {
  /**
   * .what = the three keys these cases mutate, and the only three they restore
   * .why = an earlier draft snapshotted the WHOLE env at module load and restored it with
   *        `process.env = { ...envBefore }`. two costs, both named by `r006.nitpick.1`:
   *
   *        1. it replaces the process-global's IDENTITY, so any module that retained a
   *           direct reference to the prior object reads a stale view from then on
   *        2. the snapshot is frozen at LOAD time, so a key any peer suite sets afterward is
   *           silently dropped on the next restore — a cross-suite failure with no tell
   *
   *   ⇒ the cases touch exactly three keys, so three is what gets restored. the blast
   *     radius then matches the mutation rather than the process (rule.forbid.hidden-side-effects)
   */
  const KEYS_MUTATED = [
    'AWS_PROFILE',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ] as const;

  const valuesBefore = Object.fromEntries(
    KEYS_MUTATED.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    // restore each key to its prior value, or delete it if it had none
    for (const key of KEYS_MUTATED) {
      const valueBefore = valuesBefore[key];
      if (valueBefore === undefined) delete process.env[key];
      if (valueBefore !== undefined) process.env[key] = valueBefore;
    }
  });

  given('[case1] an env with no aws credential at all', () => {
    when('[t0] a deploy context is asked for', () => {
      /**
       * .note = the facts are EXTRACTED inside, rather than the error returned whole.
       *         `useThen` hands back a proxy that defers property access, so a
       *         `toBeInstanceOf` on the proxy itself grades the proxy — measured, it reports
       *         `Received constructor: Object` while the real error is a `ConstraintError`
       */
      const seen = useThen('it refuses', async () => {
        delete process.env.AWS_PROFILE;
        delete process.env.AWS_ACCESS_KEY_ID;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        const error = await getError(getOneDeployContext());
        return {
          isConstraintError: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('it is a CALLER fault, never a server one', () => {
        expect(seen.isConstraintError).toEqual(true);
      });

      then('the message names what is absent', () => {
        expect(seen.message).toContain('AWS credentials required');
      });

      /**
       * ⚠️ .why the TIER is asserted and not merely the command = `--env prep` would read as
       *    a correct hint and grant `ehmpathy.prep.AWS_PROFILE`, which the acceptance suites'
       *    own `keyrack.source({ env: 'test' })` cannot read. so the one character that
       *    matters is the tier, and it is the one a careless edit would change
       */
      then('the hint names the runnable command, at the right tier', () => {
        expect(seen.message).toContain(DEPLOY_CREDENTIAL_HINT_ABSENT);
      });

      /**
       * ⚠️ .why a SNAPSHOT beside the two fragments = the fragments clamp two TOKENS and
       *    say not one word about the rest. this surface is the whole of what an engineer
       *    reads when a deployed suite cannot run, so a reviewer must be able to vibecheck
       *    the string as a human meets it — and a fragment assertion renders none of it
       *    (rule.forbid.friction-hazards: "can a reviewer see actual user experience via
       *    snapshots?")
       *
       * ⇒ the two keep their own rows rather than fold into this one. a snapshot shows
       *   WHAT the text is and grades no part of it as load-bearing; the fragments name
       *   the two parts that ARE. so a resnap may accept a reworded sentence and can never
       *   accept a dropped command or a moved tier
       */
      then('the whole surface reads as a human meets it', () => {
        expect(seen.message).toMatchSnapshot();
      });
    });
  });

  given('[case2] an env with a HALF credential — a key id and no secret', () => {
    /**
     * ⚠️ .why this case exists = it is the one place this guard is deliberately STRICTER than
     *    the two `jest.*.env.ts` boot guards, and its own doc block says so. those ask *"is
     *    any credential HINT present?"* (`AWS_PROFILE || AWS_ACCESS_KEY_ID`); this asks *"is a
     *    COMPLETE credential present?"*, because a static key is unusable without its secret
     *
     * ⇒ so a box that exports `AWS_ACCESS_KEY_ID` alone PASSES the suite gate and is refused
     *   HERE — and that split is a claim the prose made and no run had measured
     *
     * .proven by revert = weaken the guard to `!!process.env.AWS_ACCESS_KEY_ID` (drop the
     *                     `&& AWS_SECRET_ACCESS_KEY`) and `[t0]` goes RED: the guard passes,
     *                     the aws sdk is reached, and the refusal is no longer a
     *                     `ConstraintError`
     */
    when('[t0] a deploy context is asked for', () => {
      const seen = useThen('it refuses', async () => {
        delete process.env.AWS_PROFILE;
        delete process.env.AWS_SECRET_ACCESS_KEY;
        process.env.AWS_ACCESS_KEY_ID = 'AKIAEXAMPLEKEYIDONLY';
        const error = await getError(getOneDeployContext());
        return {
          isConstraintError: error instanceof ConstraintError,
          message: error.message,
        };
      });

      then('a half credential is refused exactly as an absent one is', () => {
        expect(seen.isConstraintError).toEqual(true);
        expect(seen.message).toContain('AWS credentials required');
      });
    });
  });

  given('[case3] the REFUSED arm — its text, apart from its trigger', () => {
    /**
     * ⚠️ .what = the half of the second arm a unit test CAN reach
     * .why = the arm fires only when a live aws rejects a credential that was present, and
     *        that is a remote boundary a unit test may not cross
     *        (`rule.forbid.unit.remote-boundaries`). so its BEHAVIOR stays uncovered — as
     *        the header above states, and as it stated before this case existed
     *
     * ⇒ but its TEXT was uncovered too, and that half was never forced. a hint is a string
     *   the subject owns, so a name makes it assertable with no call at all. that is why
     *   the two hints are exported constants rather than inline literals
     *
     * ⚠️ .why this matters more here than at the absent arm = the refused arm is the one
     *    the acceptance runs ACTUALLY hit (a stale sso, a wrong-account identity), and it
     *    is the one with no behavioral clamp to catch a drift. ⇒ so the wording is the
     *    ONLY thing between a stale credential and a human who re-runs the wrong command —
     *    the exact circular-hint failure the header names
     *
     * .the bound, stated rather than implied = this grades the STRING. it does not prove
     *        the wrap emits it, nor that the wrap fires. the emit is proven transitively by
     *        every `deployed.*.acceptance.test.ts` whenever a credential goes stale
     */
    when('[t0] the hint is read', () => {
      then('it corrects the reader misdiagnosis the absent arm invites', () => {
        // ⇒ without this, a reader meets a credential error and re-runs `unlock`, which
        //   reports success and changes no state — the circle the header names
        expect(DEPLOY_CREDENTIAL_HINT_REFUSED).toContain(
          'stale or scoped wrong rather than absent',
        );
      });

      then(
        'it names the runnable command, at the SAME tier as the absent arm',
        () => {
          expect(DEPLOY_CREDENTIAL_HINT_REFUSED).toContain(
            'rhx keyrack unlock --owner ehmpath --env test',
          );
        },
      );

      then('the hint reads as a human meets it', () => {
        expect(DEPLOY_CREDENTIAL_HINT_REFUSED).toMatchSnapshot();
      });
    });
  });

  /**
   * ⚠️ .what = the REFUSED arm's WHOLE surface — the wrap message plus the facts
   *    `helpful-errors` serializes beside it — rather than the hint fragment `[case3]` grades
   *
   * .why = a reviewer raised across three rounds that a hint is one string out of a surface,
   *        and `rule.require.contract-snapshot-exhaustiveness` asks for the whole of what a
   *        caller meets. the answer twice was a deferral to the credential gate, and a
   *        re-read of the subject found that HALF wrong — the same half the hints got wrong
   *        before they were named (rule.require.reread-the-subject-a-repeated-find-names)
   *
   * 🔴 .why the synthetic throw is an INPUT and not a mock = this arm's whole contract is
   *    *"whatever the thunk throws, wrap it thus"*. the thunk is the arm's argument, so a
   *    thrown value is data a caller supplies rather than a stand-in for a dependency. no
   *    module is replaced, no boundary is crossed, and `MalfunctionError.wrap` plus
   *    `getOneDeployCredentialRefusal()` are the REAL ones the prod path calls
   *    (rule.forbid.unit.remote-boundaries stays honored; rule.forbid.acceptance.mocks has
   *    no subject here)
   *
   * .the bound, stated rather than implied = what stays uncovered is that
   *        `getDeclastructAwsProvider` is the thunk actually passed. that is proven
   *        transitively by every `deployed.*.acceptance.test.ts` whenever a credential goes
   *        stale — the same bound `[case3]` carries, unchanged
   */
  given('[case4] the REFUSED arm — its WHOLE surface, apart from its trigger', () => {
    when('[t0] the arm wraps a cause the way a live refusal would', () => {
      const seen = useThen('it wraps', async () => {
        // a fixed profile, so the snapshot grades the TEXT rather than the host's env
        process.env.AWS_PROFILE = 'ehmpathy-prep';
        const error = await getError(
          MalfunctionError.wrap(async () => {
            throw new Error(
              'The security token included in the request is expired',
            );
          }, getOneDeployCredentialRefusal())(),
        );
        return {
          isMalfunctionError: error instanceof MalfunctionError,
          message: error.message,
          causeMessage:
            error.cause instanceof Error ? error.cause.message : null,
        };
      });

      then('it is a SERVER fault, since the cause cannot be classified here', () => {
        expect(seen.isMalfunctionError).toEqual(true);
      });

      then('the message names the operation and what it did', () => {
        expect(seen.message).toContain('getOneDeployContext');
        expect(seen.message).toContain('refused the credential that was present');
      });

      /**
       * ⚠️ .why the cause is read off `.cause` and NOT off `.message` = MEASURED. the wrap
       *    stores the thrown error as `metadata.cause` (`helpful-errors/dist/HelpfulError.js:193`),
       *    and the constructor then OMITS `cause` from the message serialization
       *    (`:24`) while it hands the same value to `super(msg, { cause })` (`:48`)
       *
       *    ⇒ so a `.message` assertion would go red for a cause that IS preserved, and this
       *      clamp went red exactly that way before the field was corrected. the aim was the
       *      defect, never the wrap
       *
       * .why it is asserted at all = the wrap exists to preserve what the sdk said, since a
       *      stale token and an aws outage are told apart by that text alone and by naught
       *      else the frame carries (`getOneDeployContext.ts` — .why MalfunctionError)
       */
      then('it preserves the sdk cause, rather than asserts a class', () => {
        expect(seen.causeMessage).toContain('security token');
      });

      /**
       * ⚠️ .the consequence a reader must carry = the preserved cause is NOT in the text a
       *    human reads. so an engineer who meets this surface sees the frame alone, and the
       *    one fact that separates a stale token from an aws outage is a field away
       */
      then('and that cause is absent from the text a human reads', () => {
        expect(seen.message).not.toContain('security token');
      });

      then('the facts beside it name the credential source and the fix', () => {
        expect(seen.message).toContain('ehmpathy-prep');
        expect(seen.message).toContain(DEPLOY_CREDENTIAL_HINT_REFUSED);
      });

      then('the whole surface reads as a human meets it', () => {
        expect(seen.message).toMatchSnapshot();
      });
    });
  });
});
