import type rules from "../../../docs/design/reconciled/data/rules.json";
import type season from "../../../docs/design/reconciled/data/season.json";
import type death from "../../../docs/design/reconciled/data/death-reservation.json";

export type Intent =
  | "TRAIN"
  | "WORK"
  | "BEFRIEND"
  | "CONFIDE"
  | "PROTECT"
  | "WATCH"
  | "SCHEME"
  | "RECRUIT"
  | "DEFECT"
  | "REPORT"
  | "PLOT"
  | "REST"
  | "OFFER";
export interface Decision {
  character: string;
  intent: Intent;
  args: Record<string, string>;
  goal: string;
  mood: string;
  reasonValue: string;
  citedFacts: string[];
  line: string;
}
export interface CharacterSheet {
  id: string;
  name: string;
  tent: string;
  school: string;
  role: string;
  rank: number;
  traits: Record<string, number>;
  values: string[];
  goal: { id: string; target: string | null };
  stats: Record<string, number>;
  voice: { register: string; tics: string[]; never: string[] };
  bio: string;
  forbiddenIntents: string[];
  knowledgeSeed: string[];
}
export interface Character extends CharacterSheet {
  points: Record<string, number>;
  gold: number;
  renown: number;
  hunger: number;
  loyalty: number;
  fatigue: number;
  mastery: number;
  mood: string;
  knowledge: string[];
  life: "Alive" | "Dead" | "Executed";
  sick: boolean;
  warned: boolean;
  stocks: boolean;
  lastScheme: { day: number; target: string } | null;
}
export interface Fact {
  id: string;
  text: string;
  visibility: string;
  type?: string;
  actor?: string;
  target?: string;
  truth?: boolean;
}
export interface Plot {
  id: string;
  plotter: string;
  target: string;
  stage: "means" | "vigil" | "window" | "cover" | "resolved" | "foiled";
  meansNights: number[];
  routineKnowing: string | null;
  guardRotaKnowing: string | null;
  guardianCompromised: boolean;
  isolated: boolean;
  witnesses: string[];
  cover: string | null;
  result: string | null;
}
export interface CampState {
  seed: number;
  day: number;
  player: string;
  characters: Record<string, Character>;
  trust: Record<string, number>;
  debt: Record<string, number>;
  stores: Record<string, number>;
  facts: Fact[];
  board: { factId: string; text: string }[];
  bond: string;
  bondProgress: number;
  strays: string;
  fifth: string[];
  plots: Plot[];
  vigilAttention: number;
  investigations: {
    actor: string;
    target: string;
    day: number;
    substantiated: boolean;
  }[];
  ended: boolean;
}
export interface Tables {
  season: typeof season;
  "death-reservation": typeof death;
  characters: {
    characters: CharacterSheet[];
    moods: string[];
    valueVocabulary: string[];
  };
  relationships: { from: string; to: string; trust: number; debt: number }[];
  facts: Fact[];
  schools: {
    id: string;
    tent: string;
    hint: string;
    weights: Record<string, number>;
    preferredStat: string;
  }[];
  rules: typeof rules & {
    effects: Record<string, Record<string, number>>;
    ranges: Record<string, number[]>;
    caps: Record<string, number>;
  };
  intents: Record<
    string,
    { args: string[]; optionalArgs: string[]; visibility: string }
  >;
  goals: Record<string, { intent: Intent; args: Record<string, string>; location?: string }[]>;
  phrases: Record<string, string>;
  locations: {
    id: string;
    name: string;
    openHour: number;
    closeHour: number;
    activities: string[];
  }[];
  scenarios: {
    seed: number;
    startDay: number;
    nights: {
      id: string;
      choices: Record<string, [Intent, Record<string, string>]>;
    }[];
  };
}
export interface Trace {
  path: string;
  before: unknown;
  after: unknown;
  rule: string;
}
export interface Roll {
  seed: number;
  day: number;
  actor: string;
  action: string;
  unit: number;
  value: number;
  rule: string;
  score?: number;
  dc?: number;
  success?: boolean;
}
export interface Verdict {
  character: string;
  rejected: boolean;
  reason: string | null;
  lineReplaced: string | null;
}
export interface Resolution {
  state: CampState;
  trace: Trace[];
  rolls: Roll[];
  events: Fact[];
  carry?: DayCarry;
}
export interface DayCarry {
  helped: string[];
  working: string[];
  stopped: string[];
  freshStocks: string[];
}
export type Fallback = (id: string) => Decision;
