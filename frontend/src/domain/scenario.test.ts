import { describe, expect, it } from 'vitest';
import { shotDetail } from '../test/fixtures';
import {
  addDefender,
  addTeammate,
  DEFAULT_ATTRS,
  defaultScenario,
  fromShotDetail,
  GK_REF,
  movePlayer,
  refFromId,
  removeEntity,
  scenarioEquals,
  setAttr,
  setGoalkeeper,
  SHOOTER_REF,
  toPredictBody,
} from './scenario';

describe('scenario reducers', () => {
  it('moves and clamps', () => {
    const s = movePlayer(defaultScenario(), SHOOTER_REF, { x: 125, y: -4 });
    expect(s.shooter).toEqual({ x: 120, y: 0 });
    const d = movePlayer(s, { kind: 'defender', id: 'd1' }, { x: 100, y: 50 });
    expect(d.defenders.find((x) => x.id === 'd1')).toEqual({ id: 'd1', x: 100, y: 50 });
    expect(d.defenders.find((x) => x.id === 'd0')).toBe(s.defenders[0]);
  });

  it('ignores moves of a missing goalkeeper', () => {
    const s = setGoalkeeper(defaultScenario(), null);
    expect(movePlayer(s, GK_REF, { x: 110, y: 40 })).toBe(s);
  });

  it('assigns stable, never-reused ids', () => {
    let s = addDefender(defaultScenario());
    expect(s.defenders.map((d) => d.id)).toEqual(['d0', 'd1', 'd2']);
    s = removeEntity(s, { kind: 'defender', id: 'd1' });
    s = addDefender(s);
    expect(s.defenders.map((d) => d.id)).toEqual(['d0', 'd2', 'd3']);
    s = addTeammate(addTeammate(s));
    expect(s.teammates.map((t) => t.id)).toEqual(['t0', 't1']);
  });

  it('spawns goal-side of the shooter and avoids occupied spots', () => {
    const s = addDefender(defaultScenario());
    const [, , d2] = s.defenders;
    expect(d2.x).toBe(112);
    expect(d2.y).toBe(40);
    const t = addDefender(s);
    expect(t.defenders[3]).toMatchObject({ x: 112, y: 42 });
    const explicit = addTeammate(s, { x: 130, y: 20 });
    expect(explicit.teammates[0]).toMatchObject({ x: 120, y: 20 });
  });

  it('never removes the shooter', () => {
    const s = defaultScenario();
    expect(removeEntity(s, SHOOTER_REF)).toBe(s);
    expect(removeEntity(s, GK_REF).goalkeeper).toBeNull();
  });

  it('serialises to the API body without ids', () => {
    const s = setAttr(defaultScenario(), 'body_part', 'Head');
    const body = toPredictBody(s);
    expect(body.body_part).toBe('Head');
    expect(body.defenders).toEqual([
      { x: 114, y: 37 },
      { x: 115, y: 43 },
    ]);
    expect(body.goalkeeper).toEqual({ x: 118, y: 40 });
    expect(body).not.toHaveProperty('attrs');
  });

  it('rebuilds a scenario from a library shot with d0../t0.. ids', () => {
    const body = toPredictBody(addTeammate(defaultScenario()));
    const s = fromShotDetail(shotDetail(body));
    expect(s.defenders.map((d) => d.id)).toEqual(['d0', 'd1']);
    expect(s.teammates.map((t) => t.id)).toEqual(['t0']);
    expect(s.attrs).toEqual(defaultScenario().attrs);
    expect(toPredictBody(s)).toEqual(body);
  });

  it('fills the player lists the API body may omit', () => {
    const s = fromShotDetail(
      shotDetail({
        ...DEFAULT_ATTRS,
        shooter: { x: 110, y: 42 },
        defenders: [{ x: 115, y: 40 }],
        body_part: 'Head',
      }),
    );
    expect(s.goalkeeper).toBeNull();
    expect(s.teammates).toEqual([]);
    expect(s.defenders).toEqual([{ id: 'd0', x: 115, y: 40 }]);
    expect(s.attrs).toEqual({ ...DEFAULT_ATTRS, body_part: 'Head' });
  });

  it('compares scenarios by what the backend would see', () => {
    const a = defaultScenario();
    expect(scenarioEquals(a, defaultScenario())).toBe(true);
    expect(scenarioEquals(a, movePlayer(a, SHOOTER_REF, { x: 100, y: 40 }))).toBe(false);
    expect(scenarioEquals(a, setAttr(a, 'first_time', true))).toBe(false);
  });

  it('derives the entity kind from its id', () => {
    expect(refFromId('shooter')).toEqual(SHOOTER_REF);
    expect(refFromId('gk')).toEqual(GK_REF);
    expect(refFromId('d4')).toEqual({ kind: 'defender', id: 'd4' });
    expect(refFromId('t0')).toEqual({ kind: 'teammate', id: 't0' });
  });
});
