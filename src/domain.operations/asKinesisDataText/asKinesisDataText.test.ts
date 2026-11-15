import { given, then, when } from 'test-fns';

import { asKinesisDataText } from './asKinesisDataText';

describe('asKinesisDataText', () => {
  given('[case1] base64 of utf8 text', () => {
    when('[t0] decoded', () => {
      then('the text comes back, byte for byte', () => {
        const wire = Buffer.from('{"clickId":"c-1"} ✓', 'utf8').toString(
          'base64',
        );
        expect(asKinesisDataText({ wire })).toEqual('{"clickId":"c-1"} ✓');
      });
    });
  });

  given('[case2] an empty data field', () => {
    when('[t0] decoded', () => {
      then('the text is empty', () => {
        expect(asKinesisDataText({ wire: '' })).toEqual('');
      });
    });
  });

  given('[case3] a value that is not valid base64', () => {
    when('[t0] decoded', () => {
      /**
       * .what = node's decode never throws; it skips the characters it cannot read
       * .why = so the next step, the json parse or the caller's schema, is where a bad record is
       *        refused. this pins that the decode itself is not the place a throw comes from
       */
      then('it returns text rather than throws', () => {
        expect(typeof asKinesisDataText({ wire: '%%%not base64%%%' })).toEqual(
          'string',
        );
      });
    });
  });
});
