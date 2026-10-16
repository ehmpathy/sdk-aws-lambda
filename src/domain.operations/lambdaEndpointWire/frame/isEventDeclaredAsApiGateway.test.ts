import { given, then, when } from 'test-fns';

import { isEventDeclaredAsApiGateway } from './isEventDeclaredAsApiGateway';
import { setEventDeclaredAsApiGateway } from './setEventDeclaredAsApiGateway';

describe('isEventDeclaredAsApiGateway', () => {
  given('[case1] an event declared as api gateway', () => {
    const event = setEventDeclaredAsApiGateway({ event: { headers: {} } });

    when('[t0] read', () => {
      then('it reads declared', () => {
        expect(isEventDeclaredAsApiGateway({ event })).toEqual(true);
      });

      then(
        'the mark leaves no trace in a snapshot, a key list, or json',
        () => {
          expect(Object.keys(event)).toEqual(['headers']);
          expect(JSON.stringify(event)).toEqual('{"headers":{}}');
          expect(event).toEqual({ headers: {} });
        },
      );
    });
  });

  given('[case2] an event declared twice', () => {
    when('[t0] declared again', () => {
      then(
        'it stays declared and does not throw: the set is idempotent',
        () => {
          const event = setEventDeclaredAsApiGateway({
            event: { headers: {} },
          });
          const again = setEventDeclaredAsApiGateway({ event });
          expect(again).toBe(event);
          expect(isEventDeclaredAsApiGateway({ event: again })).toEqual(true);
        },
      );
    });
  });

  given('[case3] an event that was never declared', () => {
    when('[t0] read', () => {
      then('a hand-built object reads undeclared', () => {
        expect(
          isEventDeclaredAsApiGateway({ event: { httpMethod: 'GET' } }),
        ).toEqual(false);
      });

      then('a spread of a declared event reads undeclared', () => {
        const declared = setEventDeclaredAsApiGateway({
          event: { headers: {} },
        });
        expect(isEventDeclaredAsApiGateway({ event: { ...declared } })).toEqual(
          false,
        );
      });

      then('a json round trip reads undeclared', () => {
        const declared = setEventDeclaredAsApiGateway({
          event: { headers: {} },
        });
        expect(
          isEventDeclaredAsApiGateway({
            event: JSON.parse(JSON.stringify(declared)),
          }),
        ).toEqual(false);
      });

      then('null, a string, and undefined read undeclared', () => {
        expect(isEventDeclaredAsApiGateway({ event: null })).toEqual(false);
        expect(isEventDeclaredAsApiGateway({ event: 'x' })).toEqual(false);
        expect(isEventDeclaredAsApiGateway({ event: undefined })).toEqual(
          false,
        );
      });
    });
  });
});
