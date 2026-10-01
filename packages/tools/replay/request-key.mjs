import { createHash } from 'node:crypto';
import { canonical } from './tables.mjs';
export function requestKey(request) { return createHash('sha256').update(canonical(request)).digest('hex'); }
