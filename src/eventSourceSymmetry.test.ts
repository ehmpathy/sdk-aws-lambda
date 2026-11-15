import { given, then, when } from 'test-fns';

// .why the public barrel = the symmetry a consumer meets is the one that ships; a deep import
//        would clamp a family object the barrel might not export
import { asLambdaEventSchema, genLambdaEndpoint } from './index';

/**
 * .what = the clamp on `rule.require.event-source-symmetry` — every source has a
 *         `genLambdaEndpoint.forX` and an `asLambdaEventSchema.fromX`, or sits on the declared
 *         one-sided list with an axis
 * .why = a source added to one family alone compiles, passes its own tests, and ships half a
 *        source. only a read of both key sets together can see the gap, since the gap is a
 *        relation between two families (`rule.require.sweep-the-defect-class`)
 */

type SourcesOneSided = Record<string, { lacks: 'for' | 'from'; axis: string }>;

/**
 * .what = the sources declared one-sided, each with the half it lacks and why that half cannot
 *         exist
 * .note = mirrored in the brief's `.the declared one-sided list`; an entry here with no row there
 *         is a claim no reader can audit
 */
const SOURCES_ONE_SIDED: SourcesOneSided = {
  ask: {
    lacks: 'from',
    axis: 'a direct invoke has no envelope; fromAsk(schema) would equal schema',
  },
  apiGateway: {
    lacks: 'from',
    axis: 'forApiGateway validates its own reconciled v1/v2 input; a raw-event schema would be a second path',
  },
};

/**
 * .what = the source a family key names, and the name part both families share —
 *         `forSqs` → `{ source: 'sqs', name: 'Sqs' }`
 * .why = the two families name a source with different prefixes, so a pair is found by the part
 *        after the prefix; the name part is kept so each defect can cite the absent key verbatim
 */
const asSourceOfKey = (input: {
  key: string;
  prefix: 'for' | 'from';
}): { source: string; name: string } => {
  const name = input.key.slice(input.prefix.length);
  return { source: name.charAt(0).toLowerCase() + name.slice(1), name };
};

/**
 * .what = every way the two families disagree with each other and with the one-sided list, each
 *         stated as the defect and its fix
 * .why = a bare array diff tells a maintainer what differs and not what to do. each message names
 *        the move, so the red the clamp turns is its own instruction
 *        (`rule.require.errors-name-the-fix`)
 * .note = a pure transformer of key sets, so its red arms are proven below on synthetic families
 *         rather than by a hand edit of the shipped ones
 */
const getAllSymmetryDefects = (input: {
  keysEndpoint: string[];
  keysSchema: string[];
  oneSided: SourcesOneSided;
}): string[] => {
  const endpoints = input.keysEndpoint.map((key) =>
    asSourceOfKey({ key, prefix: 'for' }),
  );
  const schemas = input.keysSchema.map((key) =>
    asSourceOfKey({ key, prefix: 'from' }),
  );
  const nameOf = new Map(
    [...endpoints, ...schemas].map(({ source, name }) => [source, name]),
  );
  const sources = [
    ...new Set([...nameOf.keys(), ...Object.keys(input.oneSided)]),
  ].sort();

  return sources.flatMap((source) => {
    const name = nameOf.get(source) ?? source;
    const hasFor = endpoints.some((each) => each.source === source);
    const hasFrom = schemas.some((each) => each.source === source);
    const declared = input.oneSided[source];
    const forKey = `genLambdaEndpoint.for${name}`;
    const fromKey = `asLambdaEventSchema.from${name}`;

    // both halves present: a list entry for it is stale
    if (hasFor && hasFrom)
      return declared
        ? [
            `${source} has both ${forKey} and ${fromKey}, yet sits on the one-sided list; the list entry is stale, remove it`,
          ]
        : [];

    // neither half present: only a list entry names it, and that entry is stale
    if (!hasFor && !hasFrom)
      return [
        `${source} sits on the one-sided list, yet neither family serves it; the list entry is stale, remove it`,
      ];

    // one half present: the list must declare exactly the half that is absent
    const lacks = hasFor ? 'from' : 'for';
    if (declared?.lacks === lacks) return [];
    const [present, absent] = hasFor ? [forKey, fromKey] : [fromKey, forKey];
    return [
      `${source} has ${present} and no ${absent}; add ${absent}, or declare ${source} on the one-sided list with lacks '${lacks}' and an axis`,
    ];
  });
};

describe('event source symmetry, across genLambdaEndpoint and asLambdaEventSchema', () => {
  given('[case1] the two families as they ship', () => {
    const keysEndpoint = Object.keys(genLambdaEndpoint);
    const keysSchema = Object.keys(asLambdaEventSchema);

    when('[t0] each source is paired by name', () => {
      then('every key on each family follows its prefix', () => {
        expect(keysEndpoint.filter((key) => !key.startsWith('for'))).toEqual(
          [],
        );
        expect(keysSchema.filter((key) => !key.startsWith('from'))).toEqual([]);
      });

      then('no source is one-sided off the list, and no entry is stale', () => {
        expect(
          getAllSymmetryDefects({
            keysEndpoint,
            keysSchema,
            oneSided: SOURCES_ONE_SIDED,
          }),
        ).toEqual([]);
      });

      then('sqs, sns, and kinesis each have both halves', () => {
        // the floor the commander set; a list entry cannot excuse one of these
        expect(
          ['sqs', 'sns', 'kinesis'].filter(
            (source) => source in SOURCES_ONE_SIDED,
          ),
        ).toEqual([]);
        expect(
          getAllSymmetryDefects({
            keysEndpoint,
            keysSchema,
            oneSided: {},
          }).filter((defect) => /^(sqs|sns|kinesis) /.test(defect)),
        ).toEqual([]);
      });

      then('every one-sided entry states an axis', () => {
        expect(
          Object.entries(SOURCES_ONE_SIDED)
            .filter(([, entry]) => entry.axis.trim().length === 0)
            .map(([source]) => source),
        ).toEqual([]);
      });

      /**
       * .what = the positive control: the compare above reads derived lists, and two empty
       *         families with an empty list satisfy it. this proves both key sets were read
       *         (`rule.require.positive-control-before-absence-claims`)
       */
      then('both families were really read', () => {
        expect([...keysEndpoint].sort()).toEqual([
          'forApiGateway',
          'forAsk',
          'forKinesis',
          'forSns',
          'forSqs',
        ]);
        expect([...keysSchema].sort()).toEqual([
          'fromKinesis',
          'fromSns',
          'fromSqs',
        ]);
      });
    });
  });

  /**
   * .what = the red arms, proven on synthetic families
   * .why = against the shipped families the clamp is green by construction, so its failure
   *        messages would otherwise ship untested
   */
  given('[case2] a source added to one family alone', () => {
    when('[t0] an endpoint half has no schema half, off the list', () => {
      then('the defect names the absent half and both fixes', () => {
        const defects = getAllSymmetryDefects({
          keysEndpoint: ['forSqs', 'forDynamoStream'],
          keysSchema: ['fromSqs'],
          oneSided: {},
        });
        expect(defects).toEqual([
          "dynamoStream has genLambdaEndpoint.forDynamoStream and no asLambdaEventSchema.fromDynamoStream; add asLambdaEventSchema.fromDynamoStream, or declare dynamoStream on the one-sided list with lacks 'from' and an axis",
        ]);
      });
    });

    when('[t1] a schema half has no endpoint half, off the list', () => {
      then('the defect names the absent half', () => {
        const defects = getAllSymmetryDefects({
          keysEndpoint: ['forSqs'],
          keysSchema: ['fromSqs', 'fromS3'],
          oneSided: {},
        });
        expect(defects).toEqual([
          "s3 has asLambdaEventSchema.fromS3 and no genLambdaEndpoint.forS3; add genLambdaEndpoint.forS3, or declare s3 on the one-sided list with lacks 'for' and an axis",
        ]);
      });
    });

    when('[t2] the list declares the wrong half', () => {
      then('it is a defect, not an excuse', () => {
        const defects = getAllSymmetryDefects({
          keysEndpoint: ['forAsk'],
          keysSchema: [],
          oneSided: { ask: { lacks: 'for', axis: 'a wrong declaration' } },
        });
        expect(defects).toHaveLength(1);
        expect(defects[0]).toContain("with lacks 'from'");
      });
    });

    when('[t3] the source is declared, with the right half', () => {
      then('no defect', () => {
        expect(
          getAllSymmetryDefects({
            keysEndpoint: ['forAsk'],
            keysSchema: [],
            oneSided: { ask: { lacks: 'from', axis: 'no envelope' } },
          }),
        ).toEqual([]);
      });
    });
  });

  given('[case3] a list entry that no longer holds', () => {
    when('[t0] the source gained its other half', () => {
      then('the entry is named stale', () => {
        expect(
          getAllSymmetryDefects({
            keysEndpoint: ['forApiGateway'],
            keysSchema: ['fromApiGateway'],
            oneSided: { apiGateway: { lacks: 'from', axis: 'stale' } },
          }),
        ).toEqual([
          'apiGateway has both genLambdaEndpoint.forApiGateway and asLambdaEventSchema.fromApiGateway, yet sits on the one-sided list; the list entry is stale, remove it',
        ]);
      });
    });

    when('[t1] neither family serves the source any more', () => {
      then('the entry is named stale', () => {
        expect(
          getAllSymmetryDefects({
            keysEndpoint: [],
            keysSchema: [],
            oneSided: { ask: { lacks: 'from', axis: 'stale' } },
          }),
        ).toEqual([
          'ask sits on the one-sided list, yet neither family serves it; the list entry is stale, remove it',
        ]);
      });
    });
  });
});
