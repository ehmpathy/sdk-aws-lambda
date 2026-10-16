import { asLambdaEvent } from '../../asLambdaEvent/asLambdaEvent';
import { getOneTrailCarrierOfEvent } from './getOneTrailCarrierOfEvent';

const TEST_CASES = [
  {
    description: 'an event the api gateway builder made rides headers',
    given: { event: asLambdaEvent.fromApiGateway({ httpMethod: 'POST' }) },
    expect: { carrier: 'headers' },
  },
  {
    description:
      'a hand-built api gateway object rides the wrapper: no shape sniff',
    given: { event: { httpMethod: 'POST', headers: {}, requestContext: {} } },
    expect: { carrier: 'wrapper' },
  },
  {
    description: 'a spread copy of a declared event rides the wrapper',
    given: {
      event: { ...asLambdaEvent.fromApiGateway({ httpMethod: 'POST' }) },
    },
    expect: { carrier: 'wrapper' },
  },
  {
    description: 'an sqs event rides the wrapper',
    given: { event: asLambdaEvent.fromSqs({ messages: ['{}'] }) },
    expect: { carrier: 'wrapper' },
  },
  {
    description: 'a plain direct-invoke event rides the wrapper',
    given: { event: { uuid: 'abc' } },
    expect: { carrier: 'wrapper' },
  },
];

describe('getOneTrailCarrierOfEvent', () => {
  TEST_CASES.map((thisCase) =>
    test(thisCase.description, () => {
      expect(getOneTrailCarrierOfEvent(thisCase.given)).toEqual(
        thisCase.expect.carrier,
      );
    }),
  );
});
