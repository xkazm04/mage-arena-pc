// The only host global the core may use: a deep copy is deterministic. Node and DOM both
// provide it at run time; ES2022's lib does not declare it, so tsconfig.purity.json does.
declare function structuredClone<T>(value: T): T;
