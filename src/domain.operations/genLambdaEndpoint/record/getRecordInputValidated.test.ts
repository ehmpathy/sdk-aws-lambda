import { ConstraintError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';
import { z } from 'zod';

import { getRecordInputValidated } from './getRecordInputValidated';
import type { RecordDecodedOfSource } from './RecordDecoded';

const SCHEMA_OBJECT = z.object({ payload: z.object({ clickId: z.string() }) });

/**
 * .what = one header-less record, as a kinesis decode leaves it
 */
const genRecord = (input: { payload: unknown }): RecordDecodedOfSource => ({
  id: '49590',
  payload: input.payload,
  _: { raw: {} },
});

describe('getRecordInputValidated', () => {
  given('[case1] a text body left on the json default', () => {
    when('[t0] the object schema refuses the string it met', () => {
      then('the refusal names the `deserialize` fix', async () => {
        const error = await getError(async () =>
          getRecordInputValidated({
            record: genRecord({ payload: 'hello world' }),
            schema: SCHEMA_OBJECT,
            deserialize: { payload: true },
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).toContain('deserialize: { payload: false }');
        expect(error.message).toContain('expected object, received string');
        expect(error.message).toMatchSnapshot();
      });
    });
  });

  given('[case2] a text body with deserialize off', () => {
    when('[t0] the object schema refuses the string it met', () => {
      /**
       * .why = every payload is a string under `deserialize.payload = false`, so the not-json fix
       *        would point the wrong way. that is the reverse mis-pair, clamped elsewhere
       */
      then('the refusal is the plain validation error, no hint', async () => {
        const error = await getError(async () =>
          getRecordInputValidated({
            record: genRecord({ payload: 'hello world' }),
            schema: SCHEMA_OBJECT,
            deserialize: { payload: false },
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).not.toContain('deserialize');
      });
    });
  });

  given('[case3] a json body of the wrong shape', () => {
    when('[t0] the object schema refuses the object it met', () => {
      then('the refusal is the plain validation error, no hint', async () => {
        const error = await getError(async () =>
          getRecordInputValidated({
            record: genRecord({ payload: { wrong: 'shape' } }),
            schema: SCHEMA_OBJECT,
            deserialize: { payload: true },
          }),
        );
        expect(error).toBeInstanceOf(ConstraintError);
        expect(error.message).not.toContain('deserialize');
      });
    });
  });

  given('[case4] a schema whose own callback throws', () => {
    when('[t0] validated on a text body', () => {
      /**
       * .why = a defect in the schema is not a caller fault, so it must not be relabelled one
       */
      then('the throw escapes as itself', async () => {
        const error = await getError(async () =>
          getRecordInputValidated({
            record: genRecord({ payload: 'hello world' }),
            schema: z.object({ payload: z.string() }).refine(() => {
              throw new TypeError('the refine callback broke');
            }),
            deserialize: { payload: true },
          }),
        );
        expect(error).toBeInstanceOf(TypeError);
        expect(error.message).toEqual('the refine callback broke');
      });
    });
  });

  given(
    '[case6] a text payload that passed, beside a header that failed',
    () => {
      when('[t0] the schema refuses the header alone', () => {
        /**
         * .why = the `deserialize` fix answers only a payload issue. told to flip it here, an operator
         *        would break the json bodies and leave the header fault in place
         */
        then('the refusal is the plain validation error, no hint', async () => {
          const error = await getError(async () =>
            getRecordInputValidated({
              record: { ...genRecord({ payload: 'hello world' }), headers: {} },
              schema: z.object({
                headers: z.object({ tenant: z.string() }),
                payload: z.string(),
              }),
              deserialize: { payload: true },
            }),
          );
          expect(error).toBeInstanceOf(ConstraintError);
          expect(error.message).toContain('headers.tenant');
          expect(error.message).not.toContain('deserialize');
        });
      });
    },
  );

  /**
   * .what = how a text source left on the json default lands under a `z.string()` payload schema
   * .why = the outcome is partial, not total: a line that is not json reaches the schema as text
   *        and passes; a line that is also json (`42`, `true`) parses as json and is refused with
   *        no hint, since no reader can tell it from a json producer. pinned so the split is a
   *        decision, not an accident
   */
  given(
    '[case7] a text source on the json default, under a string schema',
    () => {
      const schema = z.object({ payload: z.string() });

      when('[t0] a line that is not json is validated', () => {
        then('it passes as the text it is', () => {
          expect(
            getRecordInputValidated({
              record: genRecord({ payload: 'hello world' }),
              schema,
              deserialize: { payload: true },
            }),
          ).toEqual({ payload: 'hello world' });
        });
      });

      when('[t1] a line that is also json is validated', () => {
        then(
          'it is refused with no hint, as a json producer would be',
          async () => {
            const error = await getError(async () =>
              getRecordInputValidated({
                record: genRecord({ payload: 42 }),
                schema,
                deserialize: { payload: true },
              }),
            );
            expect(error).toBeInstanceOf(ConstraintError);
            expect(error.message).not.toContain('deserialize');
          },
        );
      });
    },
  );

  given('[case5] a valid record', () => {
    when('[t0] validated', () => {
      then('the parsed slots are returned', () => {
        const output = getRecordInputValidated({
          record: genRecord({ payload: { clickId: 'c-1' } }),
          schema: SCHEMA_OBJECT,
          deserialize: { payload: true },
        });
        expect(output).toEqual({ payload: { clickId: 'c-1' } });
      });
    });
  });
});
