import { ConstraintError, MalfunctionError } from 'helpful-errors';
import { getError, given, then, when } from 'test-fns';

import { genErrorNameMiddleware } from './genErrorNameMiddleware';

/**
 * .what = the clamp on the label a throw carries out of a genLambdaEndpoint handler
 * .why = the aws runtime labels an escaped throw by `.name`, and helpful-errors 1.7.3 leaves
 *        `.name` at the inherited 'Error' (sdk-aws-lambda#73)
 */
describe('genErrorNameMiddleware', () => {
  // restore each console spy, even after a red assertion, so no later case reads a mocked global
  afterEach(() => jest.restoreAllMocks());

  /**
   * .what = runs the hook as middy does, with a fake log on the context
   * .why = the warn is the only signal of a skip that ships a server fault, so each case reads it
   */
  const runOnError = async (input: {
    error: unknown;
  }): Promise<{
    error: unknown;
    warns: { message: string; meta: unknown }[];
  }> => {
    const warns: { message: string; meta: unknown }[] = [];
    const log = {
      warn: (message: string, meta: unknown) => {
        warns.push({ message, meta });
      },
    };
    const request = asOnErrorRequest({ error: input.error, context: { log } });
    await genErrorNameMiddleware().onError(request);
    return { error: request.error, warns };
  };

  // the middy request the hook reads; the test hands only the two slots the hook touches
  const asOnErrorRequest = (input: {
    error: unknown;
    context: unknown;
  }): Parameters<ReturnType<typeof genErrorNameMiddleware>['onError']>[0] =>
    input as unknown as Parameters<
      ReturnType<typeof genErrorNameMiddleware>['onError']
    >[0];

  given('[case1] a helpful-errors class that never set .name', () => {
    when('[t0] a ConstraintError escapes', () => {
      then('it is named ConstraintError, with no warn', async () => {
        const error = new ConstraintError('quote id malformed');
        expect(error.name).toEqual('Error'); // the premise
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('ConstraintError');
        expect(warns).toEqual([]);
      });

      then(
        'the name is not enumerable, as a native error name is',
        async () => {
          const error = new ConstraintError('quote id malformed');
          await runOnError({ error });
          expect(Object.keys(error)).not.toContain('name');
          expect(
            Object.getOwnPropertyDescriptor(error, 'name')?.enumerable,
          ).toBe(false);
        },
      );

      then('the serialized error gains its name — pinned', async () => {
        // `HelpfulError.toJSON` reads own property names, so a logged error now carries `name`
        const error = new ConstraintError('quote id malformed');
        await runOnError({ error });
        const json = JSON.parse(JSON.stringify(error)) as Record<
          string,
          unknown
        >;
        expect(json.name).toEqual('ConstraintError');
        expect({
          name: json.name,
          keys: Object.keys(json).sort(),
        }).toMatchSnapshot();
      });
    });

    when('[t1] a MalfunctionError escapes', () => {
      then('it is named MalfunctionError', async () => {
        const error = new MalfunctionError('upstream down');
        await runOnError({ error });
        expect(error.name).toEqual('MalfunctionError');
      });
    });
  });

  given('[case2] an error whose .name was chosen', () => {
    when('[t0] the thrower set the name', () => {
      then('the guard leaves it', async () => {
        const error = new Error('Could not load credentials');
        error.name = 'CredentialsProviderError';
        await runOnError({ error });
        expect(error.name).toEqual('CredentialsProviderError');
      });
    });

    when(
      '[t1] a ConstraintError subclass opts into the caller-fault label',
      () => {
        then(
          'the guard keeps ConstraintError, not the subclass name',
          async () => {
            class QuoteStaleError extends ConstraintError {
              public override name = 'ConstraintError';
            }
            const error = new QuoteStaleError('quote stale');
            await runOnError({ error });
            expect(error.name).toEqual('ConstraintError');
          },
        );
      },
    );

    when('[t2] the thrower chose the name Error, as an own property', () => {
      then('the guard keeps that choice', async () => {
        const error = new ConstraintError('read me as a server fault');
        error.name = 'Error';
        await runOnError({ error });
        expect(error.name).toEqual('Error');
      });
    });

    when('[t3] an own name that cannot be redefined', () => {
      then('the guard leaves it and does not throw', async () => {
        const error = new ConstraintError('hardened');
        Object.defineProperty(error, 'name', {
          value: 'Error',
          writable: false,
          configurable: false,
        });
        const thrown = await getError(async () => {
          await runOnError({ error });
          throw new Error('no throw from the guard');
        });
        expect(thrown.message).toEqual('no throw from the guard');
        expect(error.name).toEqual('Error');
      });
    });
  });

  given('[case3] a ConstraintError subclass with no opt-in', () => {
    when('[t0] it escapes', () => {
      then(
        'it is named after the subclass — the wire reads a server fault, as the cloud will',
        async () => {
          class QuoteStaleError extends ConstraintError {}
          const error = new QuoteStaleError('quote stale');
          await runOnError({ error });
          expect(error.name).toEqual('QuoteStaleError');
        },
      );
    });
  });

  given('[case4] a nameable error that cannot take a name', () => {
    when('[t0] a frozen unnamed ConstraintError', () => {
      then(
        'it keeps Error, and the guard warns with the class and the consequence',
        async () => {
          const error = Object.freeze(new ConstraintError('frozen'));
          const { warns } = await runOnError({ error });
          expect(error.name).toEqual('Error');
          expect(warns).toHaveLength(1);
          expect(warns[0]?.message).toEqual('error.name.unset');
          expect(warns).toMatchSnapshot();
        },
      );
    });

    when('[t1] a sealed unnamed MalfunctionError', () => {
      then('it keeps Error, and the guard warns', async () => {
        const error = Object.seal(new MalfunctionError('sealed'));
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('Error');
        expect(warns.map((warn) => warn.message)).toEqual(['error.name.unset']);
      });
    });

    when('[t2] a frozen error, met before trail wrote a log', () => {
      then('the warn falls back to console, without a throw', async () => {
        const spy = jest.spyOn(console, 'warn');
        const error = Object.freeze(new ConstraintError('frozen'));
        await genErrorNameMiddleware().onError(
          asOnErrorRequest({ error, context: {} }),
        );
        expect(spy.mock.calls.map((call) => call[0])).toEqual([
          'error.name.unset',
        ]);
      });
    });

    when('[t3] a frozen error, with a log that has no warn', () => {
      then('the warn falls back to console, without a throw', async () => {
        const spy = jest.spyOn(console, 'warn');
        const error = Object.freeze(new ConstraintError('frozen'));
        await genErrorNameMiddleware().onError(
          asOnErrorRequest({ error, context: { log: { info: () => {} } } }),
        );
        expect(spy.mock.calls.map((call) => call[0])).toEqual([
          'error.name.unset',
        ]);
      });
    });
  });

  given('[case5] values the guard must not touch', () => {
    when('[t0] a plain Error', () => {
      then('it stays Error, with no warn', async () => {
        const error = new Error('plain');
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('Error');
        expect(Object.getOwnPropertyNames(error)).not.toContain('name');
        expect(warns).toEqual([]);
      });
    });

    when('[t1] a non-error value', () => {
      then('it passes through unchanged', async () => {
        expect((await runOnError({ error: 'quota exceeded' })).error).toEqual(
          'quota exceeded',
        );
      });
    });

    when('[t2] a thrown null', () => {
      then('it passes through unchanged', async () => {
        expect((await runOnError({ error: null })).error).toEqual(null);
      });
    });

    when('[t3] an anonymous class, whose name is empty', () => {
      then('it stays Error, with no warn', async () => {
        const Anonymous = (() => class extends ConstraintError {})();
        const error = new Anonymous('anonymous');
        expect(Anonymous.name).toEqual(''); // the premise
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('Error');
        expect(warns).toEqual([]);
      });
    });

    when('[t4] a plain object that inherits name Error', () => {
      then(
        'it stays Error — never Object, which the runtime would not write',
        async () => {
          // the name rides the prototype, so only the class-name check can refuse it
          const error = Object.assign(
            Object.create({ name: 'Error' }) as { name: string },
            { message: 'bare', stack: 'at handler' },
          );
          expect(error.constructor.name).toEqual('Object'); // the premise
          const { warns } = await runOnError({ error });
          expect(error.name).toEqual('Error');
          expect(Object.hasOwn(error, 'name')).toEqual(false);
          expect(warns).toEqual([]);
        },
      );
    });

    when('[t5] an object with no name anywhere on its chain', () => {
      then('it is left without a name, with no warn', async () => {
        const error = Object.assign(Object.create(null) as object, {
          message: 'nameless',
        });
        const { warns } = await runOnError({ error });
        expect('name' in error).toEqual(false);
        expect(warns).toEqual([]);
      });
    });

    when('[t6] a class whose prototype names it other than Error', () => {
      then('the prototype name is kept, with no warn', async () => {
        class LegacyError extends Error {}
        Object.defineProperty(LegacyError.prototype, 'name', {
          value: 'LegacyFault',
        });
        const error = new LegacyError('legacy');
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('LegacyFault');
        expect(Object.hasOwn(error, 'name')).toEqual(false);
        expect(warns).toEqual([]);
      });
    });
  });

  /**
   * 🔴 the TOTALITY clamp. the hook runs FIRST of every `onError`, and middy aborts the chain on a
   * throw, so a guard throw would replace the handler's fault before any later hook read it
   */
  given('[case6] an error or a log that fights the guard', () => {
    when('[t0] an extensible error declines the define', () => {
      then('it warns error.name.unset, as a frozen one does', async () => {
        const error = new Proxy(new ConstraintError('declined'), {
          defineProperty: () => false,
        });
        expect(Object.isExtensible(error)).toEqual(true); // the premise
        const { warns } = await runOnError({ error });
        expect(error.name).toEqual('Error');
        expect(warns.map((warn) => warn.message)).toEqual(['error.name.unset']);
      });
    });

    when('[t1] an error whose define trap throws', () => {
      then(
        'the hook does not throw; the same fault flows on, reported on console.error',
        async () => {
          const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
          const error = new Proxy(new ConstraintError('hostile'), {
            defineProperty: () => {
              throw new TypeError('the trap refuses');
            },
          });
          const { error: errorAfter } = await runOnError({ error });
          expect(errorAfter).toBe(error);
          expect(spy.mock.calls.map((call) => call[0])).toEqual([
            'error.name.guard.malfunction',
          ]);
        },
      );
    });

    when('[t2] a frozen error and a log whose warn throws', () => {
      then(
        'the hook does not throw; the same fault flows on, reported on console.error',
        async () => {
          const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
          const error = Object.freeze(new ConstraintError('frozen'));
          const log = {
            warn: () => {
              throw new Error('the log sink is down');
            },
          };
          const request = asOnErrorRequest({ error, context: { log } });
          await genErrorNameMiddleware().onError(request);
          expect(request.error).toBe(error);
          expect(spy.mock.calls.map((call) => call[0])).toEqual([
            'error.name.guard.malfunction',
          ]);
        },
      );
    });
  });
});
