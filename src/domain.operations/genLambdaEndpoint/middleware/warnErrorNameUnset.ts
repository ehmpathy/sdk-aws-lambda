import { asContextTrailed } from './asContextTrailed';

/**
 * .what = picks the warn sink: the context's `log.warn` when it is a function, else `console.warn`
 * .why = the guard runs on the error path, where a context may carry no log or a partial one,
 *        and a warn that threw would replace the handler's fault
 */
const getOneWarnSink = (input: {
  context: unknown;
}): ((message: string, meta: Record<string, unknown>) => void) => {
  const { log } = asContextTrailed({ context: input.context });
  if (typeof log?.warn === 'function') return log.warn.bind(log);
  return console.warn;
};

/**
 * .what = warns that a nameable error class could not take its name
 * .why = the error keeps `'Error'`, so where the throw escapes it reaches the wire as a server
 *        fault; the warn is the only signal of that skip
 */
export const warnErrorNameUnset = (input: {
  nameOfClass: string;
  context: unknown;
}): void => {
  const warn = getOneWarnSink({ context: input.context });
  warn('error.name.unset', {
    class: input.nameOfClass,
    consequence:
      "where the throw escapes the handler, it reaches the wire as 'Error', which the caller reads as a server fault",
    hint: 'throw the error before it is frozen or sealed, or set its .name yourself',
  });
};
