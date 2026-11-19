import { given, then, when } from 'test-fns';

import { asAskLambdaCacheKeyOfRefusal } from './asAskLambdaCacheKeyOfRefusal';

const KEY = 'svc-notifications-prep-sendNotification::{"to":"kai@example.com"}';

describe('asAskLambdaCacheKeyOfRefusal', () => {
  given('[case1] an ask key', () => {
    when('[t0] the ask takes the default opt', () => {
      then('the key is the one it had before the opt existed', () => {
        expect(
          asAskLambdaCacheKeyOfRefusal({
            key: KEY,
            refusal: { as: 'LambdaEndpointRefusedError' },
          }),
        ).toEqual(KEY);
      });
    });

    when('[t1] the ask opts into pass-through', () => {
      then(
        'the key differs from the default, so no in-flight promise is shared',
        () => {
          const keyPassthrough = asAskLambdaCacheKeyOfRefusal({
            key: KEY,
            refusal: { as: 'ConstraintError' },
          });
          expect(keyPassthrough).not.toEqual(KEY);
          expect(keyPassthrough).toEqual(`${KEY}::refusal=ConstraintError`);
        },
      );
    });
  });
});
