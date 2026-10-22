/**
 * .what = whether a constructor name says more than the defaults do
 * .why = `'Error'` adds no label, `'Object'` means a plain object with no error class behind it
 *        (the runtime labels that by its own `.name`, never `'Object'`), and `''` is an
 *        anonymous class
 */
const isClassNameInformative = (input: { nameOfClass: unknown }): boolean =>
  typeof input.nameOfClass === 'string' &&
  !['', 'Error', 'Object'].includes(input.nameOfClass);

/**
 * .what = fills `.name` from the constructor name where `.name` is only the inherited 'Error'
 * .why = the aws runtime labels an escaped throw by `.name`; a class that never set it should
 *        still be read as itself (sdk-aws-lambda#73)
 *
 * .note = `gen` — it fills the name only where absent and preserves any extant choice. an own
 *         `.name` always wins, whatever its value, so a non-configurable own `name` is never
 *         touched
 * .note = a frozen or sealed error, or any object that declines the define, reports
 *         `unnameable`: the define goes through `Reflect.defineProperty`, which answers `false`
 *         where `Object.defineProperty` would throw. only an exotic object whose own trap throws
 *         can still throw here
 * .note = DELIBERATE MUTATION — the error is the one object middy rethrows to the runtime, so a
 *         copy would never reach the wire
 */
export const genErrorNameFromClass = (input: {
  error: unknown;
}):
  | { status: 'named'; nameOfClass: string }
  | { status: 'skipped' }
  | { status: 'unnameable'; nameOfClass: string } => {
  const { error } = input;

  // skip a value that is not an object; it has no class to read
  if (typeof error !== 'object' || error === null) return { status: 'skipped' };

  // skip an own name; the class or thrower chose it
  if (Object.hasOwn(error, 'name')) return { status: 'skipped' };

  // skip an inherited name other than 'Error'; a class prototype chose it
  if (!('name' in error) || error.name !== 'Error')
    return { status: 'skipped' };

  // skip a class whose name says no more than the defaults
  const nameOfClass: unknown = error.constructor?.name;
  if (
    typeof nameOfClass !== 'string' ||
    !isClassNameInformative({ nameOfClass })
  )
    return { status: 'skipped' };

  // name it, non-enumerable as a native error's name is; a declined define reports unnameable
  const isNamed = Reflect.defineProperty(error, 'name', {
    value: nameOfClass,
    enumerable: false,
    writable: true,
    configurable: true,
  });
  if (!isNamed) return { status: 'unnameable', nameOfClass };
  return { status: 'named', nameOfClass };
};
