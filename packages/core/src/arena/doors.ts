/**
 * JSON imports widen authored strings to `string`. Narrow them here, once, at module load, instead of casting:
 * a value outside the set fails by name when the module loads rather than flowing on as a wrong branch.
 */
export function member<const T extends string>(value: string, allowed: readonly T[], label: string): T {
  if (!(allowed as readonly string[]).includes(value)) throw Error(`Authored ${label} "${value}" is not one of ${allowed.join(", ")}.`);
  return value as T;
}
