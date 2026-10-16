import { getOneTrailCarrierOfHandler } from './getOneTrailCarrierOfHandler';
import { setHandlerTrailCarrier } from './setHandlerTrailCarrier';

describe('getOneTrailCarrierOfHandler', () => {
  test('reads the carrier a builder stamped: headers', () => {
    const handler = setHandlerTrailCarrier({
      handler: async () => 'ok',
      carrier: 'headers',
    });
    expect(getOneTrailCarrierOfHandler({ handler })).toEqual('headers');
  });

  test('reads the carrier a builder stamped: wrapper', () => {
    const handler = setHandlerTrailCarrier({
      handler: async () => 'ok',
      carrier: 'wrapper',
    });
    expect(getOneTrailCarrierOfHandler({ handler })).toEqual('wrapper');
  });

  test('the stamp is not enumerable: it shows in no spread of the handler', () => {
    const handler = setHandlerTrailCarrier({
      handler: async () => 'ok',
      carrier: 'headers',
    });
    expect(Object.keys(handler)).toEqual([]);
    expect(getOneTrailCarrierOfHandler({ handler: { ...handler } })).toEqual(
      null,
    );
  });

  test('a plain handler declares none', () => {
    expect(getOneTrailCarrierOfHandler({ handler: async () => 'ok' })).toEqual(
      null,
    );
  });

  test('a value that is not a function declares none', () => {
    expect(getOneTrailCarrierOfHandler({ handler: { a: 1 } })).toEqual(null);
    expect(getOneTrailCarrierOfHandler({ handler: null })).toEqual(null);
    expect(getOneTrailCarrierOfHandler({ handler: undefined })).toEqual(null);
  });

  test('a stamp that is not a known carrier reads as none', () => {
    const handler = Object.defineProperty(
      async () => 'ok',
      Symbol.for('sdk-aws-lambda.handler.trailCarrier'),
      { value: 'carrier-pigeon', enumerable: false },
    );
    expect(getOneTrailCarrierOfHandler({ handler })).toEqual(null);
  });
});
