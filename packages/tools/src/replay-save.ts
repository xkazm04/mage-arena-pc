import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeSave, encodeSave, hash, restoreSave, SeasonService, sourceHash } from '@mage/director';
import { flag, resolveWave, stampCommand, writeRecord, wavesRoot } from './evidence-record.ts';
import { fourteenDays } from './season-fixtures.ts';

type Make = () => SeasonService | Promise<SeasonService>;
export interface ReplaySaveRecord {
  label: string; command: string; sourceHash: string; policyHash: string;
  firstHash: string; secondHash: string; loadedHash: string; bytes: number; day: number;
  receipts: SeasonService['progress']['receipts']; exactBytes: boolean; passed: boolean;
}

const policyHash = () => hash(['season-policy.ts', 'season-fixtures.ts'].map(p =>
  readFileSync(new URL(p, import.meta.url), 'utf8').replaceAll('\r\n', '\n')));

/** Runs make() twice and round-trips the first save; passed is derived from the hash equalities. */
export async function replaySaveRecord({ wave, make }: { wave: string; make: Make }) {
  const first = await make(), second = await make();
  const ea = encodeSave(first), eb = encodeSave(second), a = JSON.stringify(ea), b = JSON.stringify(eb);
  const loaded = new SeasonService(first.tables, first.options);
  restoreSave(loaded, decodeSave(first.tables, a));
  const encoded = encodeSave(loaded), exactBytes = a === b, roundTrip = JSON.stringify(encoded) === a;
  const record: ReplaySaveRecord = {
    label: 'simulated seed 73 and ordinary input policy; exact deterministic bytes measured',
    command: stampCommand('replay-save.ts', ['--wave', wave]),
    sourceHash: sourceHash(),
    policyHash: policyHash(),
    firstHash: hash(ea),
    secondHash: hash(eb),
    loadedHash: hash(encoded),
    bytes: Buffer.byteLength(a),
    day: first.session.camp.day,
    receipts: first.progress.receipts,
    exactBytes,
    passed: exactBytes && roundTrip,
  };
  first.close(); second.close(); loaded.close();
  const failures = [exactBytes ? '' : 'Same seed and policy did not produce a byte-identical envelope.',
    roundTrip ? '' : 'Full envelope round trip was not byte identical.'].filter(Boolean);
  return { record, failures };
}

/** Resolves the wave first (an unknown wave never runs a season), records and writes the verdict. */
export async function runReplaySave({ wave, make = fourteenDays, root = wavesRoot }: { wave: string; make?: Make; root?: string }) {
  const path = resolveWave(wave, 'replay-save.json', root);
  const { record, failures } = await replaySaveRecord({ wave, make });
  writeRecord(path, record);
  return { record, failures, path, exitCode: record.passed ? 0 : 1 };
}

/** Entry for this script and the legacy u1/u2/u3/w7-replay shims. */
export async function replaySaveCli(wave: string) {
  const { record, failures, exitCode } = await runReplaySave({ wave });
  for (const f of failures) console.error(f);
  console.log(JSON.stringify({ passed: record.passed, hash: record.firstHash, bytes: record.bytes }));
  process.exitCode = exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const wave = flag(process.argv, 'wave', process.env.MAGE_EVIDENCE);
  if (!wave) throw Error('Usage: npx tsx packages/tools/src/replay-save.ts --wave <id>');
  await replaySaveCli(wave);
}
