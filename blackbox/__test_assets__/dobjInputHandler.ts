/**
 * .what = a handler whose INPUT border carries domain objects at four shapes — depth-0, nested
 *         via `.nested`, inside an array, and under a PLAIN wrapper — and whose output REPORTS
 *         what `invoke` received, so the proof rides the wire rather than a closure
 * .why = the wish's headline capability is an INPUT-border one, and every extant blackbox
 *        fixture places its dobjs at the OUTPUT border (`surfboardContractHandler`,
 *        `refTrophyHandlers`). so the capability had unit coverage and zero acceptance-grain
 *        coverage (`rule.require.test-coverage-by-grain` — a contract owes an acceptance test)
 *
 * ⚠️ .why the output is a REPORT of class names rather than the values themselves = a blackbox
 *        caller reads BYTES, and `JSON.stringify` of a coerced instance is byte-identical to
 *        the plain bag it came from — that is exactly what `local.dobjWire` measured at the
 *        output border. so serialized values could never tell an instance from a bag. the
 *        constructor name is the one arrival fact that survives the wire
 *   ⇒ so a regression that stopped the coerce would flip these strings to `Object`, which is a
 *     legible red rather than a silent green
 *
 * ⚠️ .why `invoke` needs no `reached` flag here = the REFUSAL case observes the same fact from
 *        the wire. a response that carries `arrivedAs` proves `invoke` ran; one that carries
 *        `errorType` and no `arrivedAs` proves it did not produce a result. the pair is its own
 *        positive control, so no deliberate mutation is owed at this grain
 *   .the bound this does NOT prove = that `invoke` was not entered and then abandoned. the
 *        unit twin asserts that directly (`forAskEndpoint.test.ts [case11][t1]`, `reached`),
 *        and it is a closure fact, so it is not observable from bytes at all
 *
 * ⚠️ .note = LOCAL-ONLY. this fixture is NOT deployed — `provision/aws.infra/account=demo/
 *        resources.ts` names its bundles explicitly and this file is not among them. its
 *        claims are input-side coercion and refusal, neither of which is a property of the AWS
 *        transport, so it owes no `deployed.*` twin (`define.blackbox-suite-grains`)
 */
import { DomainEntity, DomainLiteral } from 'domain-objects';
import { z } from 'zod';

import { genLambdaEndpoint } from '../../src/index';

export interface SurfSpot {
  name: string;
  breakType: string;
}
export class SurfSpot extends DomainLiteral<SurfSpot> implements SurfSpot {
  public static unique = ['name'] as const;
  public static alias = { singular: 'surfSpot', plural: 'surfSpots' };
  public static schema = z.object({
    name: z.string(),
    breakType: z.string(),
  });
}

export interface Surfer {
  uuid: string;
  handle: string;
  home: SurfSpot;
}
export class Surfer extends DomainEntity<Surfer> implements Surfer {
  public static primary = ['uuid'] as const;
  public static unique = ['handle'] as const;
  public static alias = { singular: 'surfer', plural: 'surfers' };
  public static nested = { home: SurfSpot };
  public static schema = z.object({
    uuid: z.string(),
    handle: z.string(),
    home: SurfSpot.contract(),
  });
}

/**
 * .what = casts a value to the name of the class it arrived as
 * .why = the one arrival fact that survives a serialize — see the fixture's `.why` above
 *
 * ⚠️ .why the two early returns = `Object.getPrototypeOf` THROWS outright on `null` and on
 *    `undefined` (`TypeError: Cannot convert undefined or null to object`), and it throws
 *    BEFORE any `?.` on its result can help. so an absent value would have turned a legible
 *    red row into a suite-level error. measured — `dobjInputHandler.test.ts [case3]` was red on
 *    exactly this the first time it ran (`rule.require.failfast`)
 *
 * .why three distinct answers rather than one catch-all = a prototype-LESS object
 *      (`Object.create(null)`) and an ABSENT value are different states, and a shared label
 *      would let a reader of a red diff mistake one for the other
 */
export const asArrivalName = (input: { value: unknown }): string => {
  // an absent value carries no prototype to read
  if (input.value === null) return 'null';
  if (input.value === undefined) return 'undefined';

  // otherwise the prototype names the class — or `none`, where there is no prototype at all
  return Object.getPrototypeOf(input.value)?.constructor?.name ?? 'none';
};

export const dobjInputContractSchema = {
  input: z.object({
    surfer: Surfer.contract(), // depth 0
    crew: z.array(Surfer.contract()), // depth 1, inside an array
    signup: z
      .object({ spot: SurfSpot.contract(), note: z.string() })
      .nullable(), // depth 1, under a PLAIN wrapper
  }),
  output: z.object({
    arrivedAs: z.object({
      surfer: z.string(),
      surferHome: z.string(),
      crewFirst: z.string(),
      signupSpot: z.string(),
      note: z.string(),
    }),
  }),
};

/**
 * .what = the handler under test — built through `src/index`, so the action a suite drives
 *         crosses this repo's public contract
 */
export const handler = genLambdaEndpoint(
  {
    schema: dobjInputContractSchema,
    invoke: async ({ event }) => ({
      arrivedAs: {
        surfer: asArrivalName({ value: event.surfer }),
        surferHome: asArrivalName({ value: event.surfer.home }),
        crewFirst: asArrivalName({ value: event.crew[0] }),
        signupSpot: asArrivalName({ value: event.signup?.spot }),
        note: asArrivalName({ value: event.signup?.note }),
      },
    }),
  },
  { env: { access: 'prep' } },
);
