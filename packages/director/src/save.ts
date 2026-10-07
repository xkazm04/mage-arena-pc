import { closeSync, copyFileSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { phaseAt, endHour, bridgeRules, boutHash, linkBout, prepareBout, replayBout, type SeasonBout, type SeasonProgress, type Tables } from '@mage/core';
import { gamesResult, validateComposition, type Games } from '@mage/core/arena';
import { hash } from './cache.ts';
import { groups, request } from './input.ts';
import { validateGroup } from './validator.ts';
import { saveValidator } from './save-schema.ts';
import type { CampCheckpoint } from './camp-service.ts';
import { SeasonService } from './season-service.ts';
import { parleyInputProblem } from './parley.ts';

export interface SavePayload { camp: CampCheckpoint; progress: SeasonProgress }
type SavedGames = Omit<Games, 'player'> & { playerId: number };
type SavedProgress = Omit<SeasonProgress, 'bout'> & { bout: (Omit<SeasonBout, 'games'> & { games: SavedGames | null }) | null };
interface FilePayload { camp: CampCheckpoint; progress: SavedProgress }
export interface SaveEnvelope { version: 2; sources: string; checkpoint: string; checksum: string; payload: FilePayload }
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const root = fileURLToPath(new URL('../../../', import.meta.url));
export function sourceHash() {
  const walk = (path: string): string[] => readdirSync(resolve(root,path),{withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(`${path}/${e.name}`) : [`${path}/${e.name}`]);
  const files = ['docs/design/reconciled/data','packages/core/src','packages/director/src'].flatMap(walk).filter(p=>/\.(?:json|csv|ts)$/.test(p) && !p.endsWith('.test.ts') && !p.endsWith('.generated.ts'));
  files.push('art/scale-contract-v3.json','packages/core/scripts/compile-arena-data.mjs');
  return hash(files.sort().map(p=>[p,readFileSync(resolve(root,p),'utf8').replaceAll('\r\n','\n')]));
}
export function validatePayload(t: Tables, value: unknown): SavePayload {
  const validate = saveValidator(t);
  if (!validate(value)) throw Error(`Save schema rejected: ${validate.errors?.[0]?.instancePath} ${validate.errors?.[0]?.message}`);
  const p = value as SavePayload, s = p.camp.session, camp = s.camp;
  if (s.slot !== phaseAt(s.hour, t.season) || s.nightFinished !== (s.hour === endHour(t.season))) throw Error('Saved hour, phase or night completion is inconsistent.');
  const ids = new Set(camp.facts.map(f=>f.id));
  if (ids.size !== camp.facts.length || camp.board.some(b=>!ids.has(b.factId))) throw Error('Save fact references are corrupt.');
  for (const [id,c] of Object.entries(camp.characters)) {
    if (c.id !== id) throw Error('Save character identity does not match its key.');
    if (c.knowledge.some(id=>!ids.has(id)) || new Set(c.knowledge).size !== c.knowledge.length) throw Error('Save knowledge references are corrupt.');
    const sheet = t.characters.characters.find(x=>x.id===c.id)!;
    for (const key of ['name','school','role','traits','values','voice','bio','forbiddenIntents','knowledgeSeed'] as const) if (hash(c[key]) !== hash(sheet[key])) throw Error('Save character identity differs from authored data.');
    for (const stat of t.rules.stats.names) if (c.stats[stat] !== t.rules.stats.rankThresholds.filter(n=>c.points[stat]>=n).length) throw Error('Save stat mapping is inconsistent.');
  }
  if (validateComposition(p.progress.composition).length) throw Error('Save composition is invalid.');
  const receipts = p.progress.receipts;
  if (new Set(receipts.map(r=>r.id)).size !== receipts.length || receipts.some(r=>r.day>camp.day)) throw Error('Save receipts are inconsistent.');
  if (p.progress.bout) {
    const b = p.progress.bout;
    if (receipts.some(r=>r.id===b.id) || b.day !== camp.day || b.entrant.id !== (receipts.find(r=>r.kind==='trial' && r.day===b.day-t.season.trialOffsetBeforeGames)?.entrant)) throw Error('Save bout identity or receipt is invalid.');
    const expected=prepareBout(t,s,{...p.progress,bout:null},b.composition);
    if (hash(expected)!==hash({...b,phase:'prepared',games:null,log:[]}) || hash(b.composition)!==hash(p.progress.composition)) throw Error('Save entrant or seed differs from the camp snapshot.');
    const replay = replayBout(b);
    // Independent replay validates every arena field, not just the client's hash.
    if (hash(json(replay)) !== hash(json(b))) throw Error('Save arena replay differs from the checkpoint.');
    if (b.games?.result && hash(gamesResult(replay.games!)) !== hash(b.games.result)) throw Error('Save arena payout is invalid.');
    linkBout(b);
  }
  const n = p.camp.night;
  if (n) {
    const tables = { ...t, rules: { ...t.rules, caps: n.caps } };
    if (new Set(n.requests.map(r=>r.group)).size !== n.requests.length || new Set(n.completed.map(g=>g.group)).size !== n.completed.length) throw Error('Duplicate saved Director group.');
    for (const saved of n.requests) {
      const group = groups(n.state).find(g=>g.group===saved.group);
      if (!group || hash(saved.request) !== saved.key || hash(request(tables,n.state,group.group,group.members,saved.request.model,saved.request.options)) !== saved.key) throw Error('Saved Director identity mismatch.');
    }
    for (const completed of n.completed) {
      const group = groups(n.state).find(g=>g.group===completed.group);
      if (!group || !n.requests.some(r=>r.group===group.group)) throw Error('Saved Director group has no identity.');
      const checked = validateGroup(tables,n.state,group.group,group.members,{group:group.group,decisions:completed.items});
      if (checked.verdicts.some(v=>v.rejected) || hash(checked.items)!==hash(completed.items)) throw Error('Saved Director decisions are not valid.');
    }
  }
  if (p.camp.pendingDawn && (s.slot !== 'night' || !s.nightFinished || !n)) throw Error('Invalid saved pending dawn.');
  if (p.camp.pendingParley && parleyInputProblem(t,s,p.camp.pendingParley.input)) throw Error('Invalid saved pending Parley.');
  return p;
}
export function encodeSave(service: SeasonService): SaveEnvelope {
  const logical = json({ camp: service.checkpointCamp(), progress: service.progress });
  validatePayload(service.tables,logical);
  const sources = sourceHash(), checkpoint = boutHashSafe(logical.progress);
  const games = logical.progress.bout?.games;
  // Persist references as IDs. Hydration restores one authoritative actor object.
  const payload = logical as unknown as FilePayload;
  if (games) {
    const { player, ...state } = games;
    payload.progress.bout!.games = { ...state, playerId: player.id };
  }
  return { version:2,sources,checkpoint,checksum:hash({version:2,sources,checkpoint,payload}),payload };
}
export function decodeSave(t: Tables, text: string, expectedSources = sourceHash()): SavePayload {
  if (Buffer.byteLength(text)>bridgeRules.limits.saveBytes) throw Error('Save is too large.');
  const e = JSON.parse(text) as SaveEnvelope;
  if (!e || Object.keys(e).sort().join() !== 'checkpoint,checksum,payload,sources,version' || e.version!==2 || e.sources!==expectedSources) throw Error('Save version or source data is incompatible.');
  if (e.checksum !== hash({version:e.version,sources:e.sources,checkpoint:e.checkpoint,payload:e.payload})) throw Error('Save checksum is corrupt.');
  const saved=e.payload?.progress?.bout?.games;
  if (saved) {
    if ('player' in saved || !Number.isSafeInteger(saved.playerId) || !Array.isArray(saved.state?.actors)) throw Error('Invalid saved player reference.');
    const {playerId,...state}=saved, player=state.state.actors.find(a=>a.id===playerId);
    if (!player) throw Error('Missing saved player actor.');
    (e.payload as unknown as SavePayload).progress.bout!.games={...state,player};
  }
  const payload=validatePayload(t,e.payload);
  if (boutHashSafe(payload.progress)!==e.checkpoint) throw Error('Saved checkpoint hash differs.');
  return payload;
}
/** One bounded local slot, previous-good backup, validate before replacement. No caller path. */
export class SaveStore {
  readonly directory: string;
  readonly filename: string;
  constructor(directory = resolve(root,'.director-runtime/saves')) {
    this.directory = resolve(directory); this.filename = resolve(this.directory,'season.json');
    if (!this.filename.startsWith(this.directory+sep)) throw Error('Invalid save root');
    mkdirSync(this.directory,{recursive:true});
  }
  write(service: SeasonService) {
    const envelope=encodeSave(service), text=JSON.stringify(envelope);
    decodeSave(service.tables,text,envelope.sources);
    const temp=resolve(this.directory,'season.tmp');
    const fd=openSync(temp,'w');
    try { writeFileSync(fd,text); fsyncSync(fd); } finally { closeSync(fd); }
    if (existsSync(this.filename)) {
      // Never replace the previous-good snapshot with corrupt bytes.
      try { decodeSave(service.tables,readFileSync(this.filename,'utf8'),envelope.sources); copyFileSync(this.filename,`${this.filename}.previous`); } catch { /* Preserve the earlier good backup. */ }
    }
    renameSync(temp,this.filename);
    return { checksum:envelope.checksum, checkpoint:envelope.checkpoint, bytes:Buffer.byteLength(text) };
  }
  read(t: Tables, previous=false) {
    const filename=previous?`${this.filename}.previous`:this.filename;
    if (!existsSync(filename)) throw Error('No saved season yet.');
    if (statSync(filename).size>bridgeRules.limits.saveBytes) throw Error('Save is too large.');
    return decodeSave(t,readFileSync(filename,'utf8'));
  }
}
const boutHashSafe=(p:SeasonProgress)=>p.bout?boutHash(p.bout):'camp';
export function restoreSave(service: SeasonService,payload: SavePayload) {
  const validated=validatePayload(service.tables,json(payload));
  // Resolve every fallback in isolation before replacing the live service. Even a
  // future semantic check that throws during restoration cannot partially load.
  const staged=new SeasonService(service.tables,service.options,validated.camp.session.camp.seed,service.parleyDirector.options);
  try {
    staged.restoreCamp(validated.camp);
    const settled=staged.checkpointCamp();
    service.restoreCamp(settled); service.progress=validated.progress; service.paused=true;
  } finally { staged.close(); }
}
