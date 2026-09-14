import type {
  BodyPart,
  PlayPattern,
  Point,
  PredictRequest,
  PreferredFoot,
  ShotDetail,
  ShotType,
  Technique,
} from '../api/types';
import { clampToPitch, type SB } from './pitch';

export type { SB };
export type Positioned = SB & { id: string };

export type ShotAttrs = {
  body_part: BodyPart;
  technique: Technique;
  shot_type: ShotType;
  play_pattern: PlayPattern;
  first_time: boolean;
  under_pressure: boolean;
  one_on_one: boolean;
  open_goal: boolean;
  preferred_foot: PreferredFoot;
};

export type Scenario = {
  shooter: SB;
  goalkeeper: SB | null;
  defenders: Positioned[];
  teammates: Positioned[];
  attrs: ShotAttrs;
};

export type EntityKind = 'shooter' | 'goalkeeper' | 'defender' | 'teammate';
/** Entity ids are unique across kinds: 'shooter', 'gk', 'd<n>', 't<n>'. */
export type EntityRef = { kind: EntityKind; id: string };

export const SHOOTER_REF: EntityRef = { kind: 'shooter', id: 'shooter' };
export const GK_REF: EntityRef = { kind: 'goalkeeper', id: 'gk' };
export const DEFAULT_GK: SB = { x: 118, y: 40 };

export function refFromId(id: string): EntityRef {
  if (id === SHOOTER_REF.id) return SHOOTER_REF;
  if (id === GK_REF.id) return GK_REF;
  return { kind: id.startsWith('d') ? 'defender' : 'teammate', id };
}

export const DEFAULT_ATTRS: ShotAttrs = {
  body_part: 'Right Foot',
  technique: 'Normal',
  shot_type: 'Open Play',
  play_pattern: 'Regular Play',
  first_time: false,
  under_pressure: false,
  one_on_one: false,
  open_goal: false,
  preferred_foot: 'Right',
};

export function defaultScenario(): Scenario {
  return {
    shooter: { x: 108, y: 40 },
    goalkeeper: { ...DEFAULT_GK },
    defenders: [
      { id: 'd0', x: 114, y: 37 },
      { id: 'd1', x: 115, y: 43 },
    ],
    teammates: [],
    attrs: { ...DEFAULT_ATTRS },
  };
}

export function entityPosition(s: Scenario, ref: EntityRef): SB | null {
  switch (ref.kind) {
    case 'shooter':
      return s.shooter;
    case 'goalkeeper':
      return s.goalkeeper;
    case 'defender':
      return s.defenders.find((d) => d.id === ref.id) ?? null;
    case 'teammate':
      return s.teammates.find((t) => t.id === ref.id) ?? null;
  }
}

export function allEntities(s: Scenario): (EntityRef & SB)[] {
  return [
    { ...SHOOTER_REF, ...s.shooter },
    ...(s.goalkeeper ? [{ ...GK_REF, ...s.goalkeeper }] : []),
    ...s.defenders.map((d) => ({ kind: 'defender' as const, ...d })),
    ...s.teammates.map((t) => ({ kind: 'teammate' as const, ...t })),
  ];
}

const moveIn = (list: Positioned[], id: string, pos: SB) =>
  list.map((p) => (p.id === id ? { ...p, ...pos } : p));

export function movePlayer(s: Scenario, ref: EntityRef, pos: SB): Scenario {
  const p = clampToPitch(pos);
  switch (ref.kind) {
    case 'shooter':
      return { ...s, shooter: p };
    case 'goalkeeper':
      return s.goalkeeper ? { ...s, goalkeeper: p } : s;
    case 'defender':
      return { ...s, defenders: moveIn(s.defenders, ref.id, p) };
    case 'teammate':
      return { ...s, teammates: moveIn(s.teammates, ref.id, p) };
  }
}

const nextId = (prefix: string, list: Positioned[]) =>
  `${prefix}${list.reduce((max, p) => Math.max(max, Number(p.id.slice(prefix.length)) + 1), 0)}`;

/** Default spawn: 4 units goal-side of the shooter, nudged sideways if that spot is taken. */
function spawnPoint(s: Scenario, wanted?: SB): SB {
  if (wanted) return clampToPitch(wanted);
  const base = { x: s.shooter.x + 4, y: s.shooter.y };
  const taken = allEntities(s);
  for (const dy of [0, 2, -2, 4, -4, 6, -6]) {
    const p = clampToPitch({ x: base.x, y: base.y + dy });
    if (!taken.some((e) => Math.hypot(e.x - p.x, e.y - p.y) < 1.5)) return p;
  }
  return clampToPitch(base);
}

export function addDefender(s: Scenario, pos?: SB): Scenario {
  const d = { id: nextId('d', s.defenders), ...spawnPoint(s, pos) };
  return { ...s, defenders: [...s.defenders, d] };
}

export function addTeammate(s: Scenario, pos?: SB): Scenario {
  const t = { id: nextId('t', s.teammates), ...spawnPoint(s, pos) };
  return { ...s, teammates: [...s.teammates, t] };
}

export function removeEntity(s: Scenario, ref: EntityRef): Scenario {
  switch (ref.kind) {
    case 'shooter':
      return s;
    case 'goalkeeper':
      return { ...s, goalkeeper: null };
    case 'defender':
      return { ...s, defenders: s.defenders.filter((d) => d.id !== ref.id) };
    case 'teammate':
      return { ...s, teammates: s.teammates.filter((t) => t.id !== ref.id) };
  }
}

export function setGoalkeeper(s: Scenario, pos: SB | null): Scenario {
  return { ...s, goalkeeper: pos && clampToPitch(pos) };
}

export function setAttr<K extends keyof ShotAttrs>(
  s: Scenario,
  key: K,
  value: ShotAttrs[K],
): Scenario {
  return { ...s, attrs: { ...s.attrs, [key]: value } };
}

const strip = ({ x, y }: SB): Point => ({ x, y });

export function toPredictBody(s: Scenario): PredictRequest {
  return {
    shooter: strip(s.shooter),
    goalkeeper: s.goalkeeper && strip(s.goalkeeper),
    defenders: s.defenders.map(strip),
    teammates: s.teammates.map(strip),
    ...s.attrs,
  };
}

/** Same shot as far as the backend is concerned (ids and object identity ignored). */
export function scenarioEquals(a: Scenario, b: Scenario): boolean {
  return a === b || JSON.stringify(toPredictBody(a)) === JSON.stringify(toPredictBody(b));
}

/** Library shot → editable scenario with stable ids d0..dn / t0..tn. */
export function fromShotDetail(detail: ShotDetail): Scenario {
  const { shooter, goalkeeper = null, defenders = [], teammates = [], ...attrs } = detail.scenario;
  return {
    shooter: { x: shooter.x, y: shooter.y },
    goalkeeper: goalkeeper && { x: goalkeeper.x, y: goalkeeper.y },
    defenders: defenders.map((p, i) => ({ id: `d${i}`, x: p.x, y: p.y })),
    teammates: teammates.map((p, i) => ({ id: `t${i}`, x: p.x, y: p.y })),
    attrs,
  };
}
