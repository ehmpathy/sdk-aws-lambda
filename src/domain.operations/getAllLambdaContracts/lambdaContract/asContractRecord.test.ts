import { given, then, when } from 'test-fns';

import type { LambdaEndpointSchema } from '../../../domain.objects/LambdaEndpointSchema';
import { asContractRecord } from './asContractRecord';

describe('asContractRecord', () => {
  const exampleSchema: LambdaEndpointSchema = {
    input: { type: 'object', properties: { id: { type: 'string' } } },
    output: { type: 'object', properties: { name: { type: 'string' } } },
  };

  given('[case1] empty array', () => {
    const contracts: Array<[string, LambdaEndpointSchema]> = [];

    when('[t0] transformed', () => {
      then('returns empty record', () => {
        expect(asContractRecord(contracts)).toEqual({});
      });
    });
  });

  given('[case2] single contract', () => {
    const contracts: Array<[string, LambdaEndpointSchema]> = [
      ['getCustomer', exampleSchema],
    ];

    when('[t0] transformed', () => {
      then('returns single-key record', () => {
        expect(asContractRecord(contracts)).toEqual({
          getCustomer: exampleSchema,
        });
      });
    });
  });

  given('[case3] multiple contracts', () => {
    const schema2: LambdaEndpointSchema = {
      input: { type: 'object', properties: { uuid: { type: 'string' } } },
      output: { type: 'object', properties: { total: { type: 'number' } } },
    };

    const contracts: Array<[string, LambdaEndpointSchema]> = [
      ['getCustomer', exampleSchema],
      ['getInvoice', schema2],
    ];

    when('[t0] transformed', () => {
      then('returns multi-key record', () => {
        expect(asContractRecord(contracts)).toEqual({
          getCustomer: exampleSchema,
          getInvoice: schema2,
        });
      });
    });
  });
});
