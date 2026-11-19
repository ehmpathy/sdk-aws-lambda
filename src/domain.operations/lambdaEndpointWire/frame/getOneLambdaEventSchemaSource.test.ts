import type { SNSEvent } from 'aws-lambda';
import { given, then, when } from 'test-fns';
import { z } from 'zod';

import {
  LAMBDA_EVENT_SCHEMA_SOURCE_NAMES,
  type LambdaEventSchemaSourceName,
} from '../../../domain.objects/LambdaEventSchemaSource';
import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { asLambdaEventSchema } from '../../asLambdaEventSchema/asLambdaEventSchema';
import { getOneLambdaEventSchemaSource } from './getOneLambdaEventSchemaSource';

/**
 * .what = a schema that carries a mark under the shared key, as another copy of this package
 *         would leave it
 */
const genSchemaWithMark = (input: { mark: unknown }): object =>
  Object.defineProperty(
    z.object({}),
    Symbol.for('sdk-aws-lambda.lambdaEventSchema.source'),
    { value: input.mark },
  );

describe('getOneLambdaEventSchemaSource', () => {
  given('[case1] a schema built by asLambdaEventSchema', () => {
    when('[t0] its source is read', () => {
      then('sns reads as sns, and the record holds the name alone', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromSns(),
          }),
        ).toEqual({ name: 'sns' });
      });
      then('kinesis reads as kinesis', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromKinesis(),
          }),
        ).toEqual({ name: 'kinesis' });
      });
      then(
        'every source name, by both call forms, reads back its own name',
        () => {
          // .why = a builder that forgets its stamp compiles; this walk over the name list catches it
          const builders: Record<
            LambdaEventSchemaSourceName,
            { bare: unknown; withPayload: unknown }
          > = {
            sqs: {
              bare: asLambdaEventSchema.fromSqs(),
              withPayload: asLambdaEventSchema.fromSqs({
                payload: z.object({}),
              }),
            },
            sns: {
              bare: asLambdaEventSchema.fromSns(),
              withPayload: asLambdaEventSchema.fromSns({
                payload: z.object({}),
              }),
            },
            kinesis: {
              bare: asLambdaEventSchema.fromKinesis(),
              withPayload: asLambdaEventSchema.fromKinesis({
                payload: z.object({}),
              }),
            },
          };
          LAMBDA_EVENT_SCHEMA_SOURCE_NAMES.forEach((name) => {
            expect([
              getOneLambdaEventSchemaSource({ schema: builders[name].bare }),
              getOneLambdaEventSchemaSource({
                schema: builders[name].withPayload,
              }),
            ]).toEqual([{ name }, { name }]);
          });
        },
      );
      then('the mark is non-enumerable, so a spread drops it', () => {
        // .why = `Object.keys` never lists a symbol key, so it could not catch an enumerable mark
        const schema = asLambdaEventSchema.fromSns();
        const key = Symbol.for('sdk-aws-lambda.lambdaEventSchema.source');
        expect(Object.getOwnPropertySymbols(schema)).toContain(key);
        expect(Object.prototype.propertyIsEnumerable.call(schema, key)).toBe(
          false,
        );
        expect(Object.getOwnPropertySymbols({ ...schema })).not.toContain(key);
      });
    });

    when('[t1] the consumer refines or annotates it (a zod clone)', () => {
      // .why = a clone points back at its source via `_zod.parent`, which the read follows, as
      //        zod's own registries do; `.refine` and `.describe` are the natural envelope wraps
      then('a .refine() keeps the source', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema
              .fromSns()
              .refine((event) => event.Records.length === 1),
          }),
        ).toEqual({ name: 'sns' });
      });
      then('a .describe() keeps the source', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromKinesis().describe('clicks'),
          }),
        ).toEqual({ name: 'kinesis' });
      });
      then('a .meta() over a .refine() keeps the source', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema
              .fromSns()
              .refine(() => true)
              .meta({ title: 'notices' }),
          }),
        ).toEqual({ name: 'sns' });
      });
    });
  });

  given('[case2] a schema that declares no source', () => {
    when('[t0] a plain schema is read', () => {
      then('it reads as null', () => {
        expect(
          getOneLambdaEventSchemaSource({ schema: z.object({}) }),
        ).toBeNull();
      });
    });
    when('[t1] an event-source schema the consumer wrapped is read', () => {
      then('the wrapper is a new schema, so it reads as null', () => {
        expect(
          getOneLambdaEventSchemaSource({
            schema: asLambdaEventSchema.fromSns().optional(),
          }),
        ).toBeNull();
        expect(
          [
            asLambdaEventSchema.fromSns().nullable(),
            asLambdaEventSchema
              .fromSns()
              .default(asLambdaEvent.fromSns({ messages: ['{}'] })),
            asLambdaEventSchema.fromSns().transform((event) => event),
            asLambdaEventSchema.fromSns().pipe(z.custom<SNSEvent>()),
          ].map((schema) => getOneLambdaEventSchemaSource({ schema })),
        ).toEqual([null, null, null, null]);
        expect(
          getOneLambdaEventSchemaSource({
            schema: z.union([
              asLambdaEventSchema.fromSns(),
              asLambdaEventSchema.fromKinesis(),
            ]),
          }),
        ).toBeNull();
      });
    });
    when('[t2] a value that is not an object is read', () => {
      then('it reads as null', () => {
        expect(getOneLambdaEventSchemaSource({ schema: 'x' })).toBeNull();
        expect(getOneLambdaEventSchemaSource({ schema: null })).toBeNull();
      });
    });
  });

  given('[case3] a mark another copy of this package left', () => {
    when('[t0] the mark sits under the shared Symbol.for key', () => {
      const schema = genSchemaWithMark({ mark: { name: 'kinesis' } });
      then('it is read', () => {
        expect(getOneLambdaEventSchemaSource({ schema })).toEqual({
          name: 'kinesis',
        });
      });
    });
    when('[t1] the mark names a source this copy does not know', () => {
      // .why s3 = a source no copy of this package serves; any served name would be read
      const schema = genSchemaWithMark({ mark: { name: 's3' } });
      then('it reads as null, never trusted', () => {
        expect(getOneLambdaEventSchemaSource({ schema })).toBeNull();
      });
    });
    when('[t2] the mark carries fields beyond the name', () => {
      const schema = genSchemaWithMark({
        mark: { name: 'sns', getAllIds: () => ['m-1'], consequence: 'x' },
      });
      then('only the name is read; the record is rebuilt from it', () => {
        expect(getOneLambdaEventSchemaSource({ schema })).toEqual({
          name: 'sns',
        });
      });
    });
    when('[t3] the mark is not an object', () => {
      const schema = genSchemaWithMark({ mark: 'sns' });
      then('it reads as null', () => {
        expect(getOneLambdaEventSchemaSource({ schema })).toBeNull();
      });
    });
  });
});
