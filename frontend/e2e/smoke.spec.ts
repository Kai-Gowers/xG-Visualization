import { expect, test, type Page, type Route } from '@playwright/test';

type Point = { x: number; y: number };
type Body = { shooter: Point; defenders: Point[]; goalkeeper: Point | null };

const clamp = (v: number) => Math.min(0.99, Math.max(0.01, v));

/** Deterministic stand-in for the model: fewer / deeper defenders and a closer shooter raise xG. */
function fakeXg(body: Body) {
  const depth = body.defenders.reduce((sum, d) => sum + (120 - d.x), 0);
  return clamp(0.6 - 0.1 * body.defenders.length - 0.01 * (120 - body.shooter.x) - 0.005 * depth);
}

function fakeResponse(body: Body) {
  const xg = fakeXg(body);
  const logit = Math.log(xg / (1 - xg));
  return {
    xg,
    xg_raw: xg,
    logit,
    base_value_logit: -2,
    model_version: 'e2e',
    rule: null,
    features: {
      distance_to_goal: 120 - body.shooter.x,
      angle_to_goal: 0.5,
      n_defenders_in_cone: 0,
      goal_open_fraction: 1,
      closest_defender_distance: 5,
      gk_distance_to_shooter: 10,
      gk_depth: 2,
      gk_lateral_offset_toward_shooter: 0,
      weak_foot: 0,
    },
    explanation: [
      { feature: 'distance_to_goal', value: 120 - body.shooter.x, contribution: logit + 2 - 0.3 },
      { feature: 'n_defenders_in_cone', value: body.defenders.length, contribution: 0.3 },
    ],
    geometry: {
      cone: [
        [body.shooter.x, body.shooter.y],
        [120, 36],
        [120, 44],
      ],
      shooter_used: { ...body.shooter, clamped: false },
      goalkeeper_used: body.goalkeeper && { ...body.goalkeeper, imputed: false },
      players: body.defenders.map((_, index) => ({
        kind: 'defender',
        index,
        in_cone: false,
        distance: 5 + index,
        goal_interval: null,
      })),
      goal_covered_intervals: [],
      goal_free_intervals: [[36, 44]],
    },
  };
}

async function fulfilPredict(route: Route, bodies: Body[]) {
  const body = route.request().postDataJSON() as Body;
  bodies.push(body);
  await route.fulfill({ json: fakeResponse(body) });
}

const SCENARIO = {
  shooter: { x: 108, y: 40 },
  goalkeeper: { x: 118, y: 40 },
  defenders: [
    { x: 114, y: 37 },
    { x: 115, y: 43 },
  ],
  teammates: [],
  body_part: 'Left Foot',
  technique: 'Normal',
  shot_type: 'Open Play',
  play_pattern: 'Regular Play',
  first_time: false,
  under_pressure: false,
  one_on_one: false,
  open_goal: false,
  preferred_foot: 'Right',
};

const COMPETITION = {
  competition_id: 55,
  season_id: 282,
  competition_name: 'UEFA Euro',
  season_name: '2024',
  competition_gender: 'male',
  n_matches: 1,
  n_shots: 1,
  has_360: true,
};

const MATCH = {
  match_id: 1,
  competition_id: 55,
  season_id: 282,
  competition_name: 'UEFA Euro',
  season_name: '2024',
  match_date: '2024-07-14',
  home_team: 'Spain',
  away_team: 'England',
  home_score: 2,
  away_score: 1,
  stage: 'Final',
  n_shots: 1,
  n_goals: 1,
};

const SHOT_ID = 'shot-e2e';

const SUMMARY = {
  shot_id: SHOT_ID,
  match_id: 1,
  competition_id: 55,
  season_id: 282,
  competition_name: 'UEFA Euro',
  season_name: '2024',
  match_date: '2024-07-14',
  home_team: 'Spain',
  away_team: 'England',
  period: 2,
  minute: 86,
  second: 10,
  team_name: 'Spain',
  player_id: 1,
  player_name: 'Mikel Oyarzabal',
  x: 108,
  y: 40,
  body_part: 'Left Foot',
  technique: 'Normal',
  shot_type: 'Open Play',
  outcome: 'Goal',
  is_goal: true,
  statsbomb_xg: 0.34,
  xg_model: fakeXg(SCENARIO),
  xg_diff: fakeXg(SCENARIO) - 0.34,
  weak_foot: true,
};

const DETAIL = {
  meta: {
    ...SUMMARY,
    play_pattern: 'Regular Play',
    end_x: 120,
    end_y: 42,
    end_z: 0.5,
    first_time: false,
    one_on_one: false,
    open_goal: false,
    under_pressure: false,
    aerial_won: false,
    deflected: false,
    follows_dribble: false,
    redirect: false,
    dominant_foot: 'Right',
    gk_present: true,
    has_freeze_frame: true,
    model_version: 'e2e',
    freeze_frame: [],
  },
  scenario: SCENARIO,
  prediction: fakeResponse(SCENARIO),
};

async function mockBackend(page: Page, bodies: Body[]) {
  await page.route('**/predict*', (route) => fulfilPredict(route, bodies));
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', model_version: 'e2e', library_loaded: true } }),
  );
  await page.route(
    (url) => url.pathname === '/library/competitions',
    (route) => route.fulfill({ json: [COMPETITION] }),
  );
  await page.route(
    (url) => url.pathname === '/library/matches',
    (route) => route.fulfill({ json: [MATCH] }),
  );
  await page.route(
    (url) => url.pathname === `/library/matches/${MATCH.match_id}/shots`,
    (route) => route.fulfill({ json: [SUMMARY] }),
  );
  await page.route(
    (url) => url.pathname === `/library/shots/${SHOT_ID}`,
    (route) => route.fulfill({ json: DETAIL }),
  );
}

/** Drag the minimap token `id` by `dx` SB units, measuring the scale from the shooter/GK tokens. */
async function dragToken(page: Page, id: string, dx: number) {
  // Shooter (108,40) and GK (118,40) are 10 SB units apart: measure the minimap scale from them.
  const [shooterBox, gkBox, tokenBox] = await Promise.all(
    ['token-shooter', 'token-gk', id].map((t) => page.getByTestId(t).boundingBox()),
  );
  if (!shooterBox || !gkBox || !tokenBox) throw new Error('minimap not laid out');
  const pxPerUnit = (gkBox.x - shooterBox.x) / 10;
  const cx = tokenBox.x + tokenBox.width / 2;
  const cy = tokenBox.y + tokenBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + (dx / 2) * pxPerUnit, cy, { steps: 5 });
  await page.mouse.move(cx + dx * pxPerUnit, cy, { steps: 5 });
  await page.mouse.up();
}

test('dragging a defender on the minimap changes the live xG', async ({ page }) => {
  const bodies: Body[] = [];
  await mockBackend(page, bodies);

  await page.goto('/?capsules=1');
  const value = page.getByTestId('xg-value');
  await expect(value).not.toHaveText('—');
  await expect(page.getByTestId('scene').locator('canvas')).toBeVisible();
  const before = await value.textContent();
  const requestsBefore = bodies.length;
  const startX = bodies[0].defenders[0].x;

  await dragToken(page, 'token-d0', -10);

  await expect(value).not.toHaveText(before!);
  await expect.poll(() => bodies.length).toBeGreaterThan(requestsBefore);
  const last = bodies[bodies.length - 1];
  expect(last.defenders[0].x).toBeCloseTo(startX - 10, 0);
  expect(last.defenders[0].y).toBeCloseTo(bodies[0].defenders[0].y, 0);
  await expect(value).toHaveText(`${(fakeXg(last) * 100).toFixed(1)}%`);
});

test('the waterfall lists the explanation and hovering a row highlights it', async ({ page }) => {
  await mockBackend(page, []);
  await page.goto('/?capsules=1');
  await expect(page.getByTestId('xg-value')).not.toHaveText('—');
  await page.getByRole('tab', { name: 'Why' }).click();
  const waterfall = page.getByTestId('waterfall');
  await expect(waterfall.getByTestId('waterfall-row-base')).toContainText('Base rate');
  await expect(waterfall.getByTestId('waterfall-row-total')).toContainText('xG');
  const row = waterfall.getByTestId('waterfall-row-distance_to_goal');
  await expect(row).toContainText('Distance to goal');
  await row.hover();
  await expect(row).toHaveClass(/is-active/);
});

test('loading a library shot, editing it, and resetting to the real positions', async ({
  page,
}) => {
  const bodies: Body[] = [];
  await mockBackend(page, bodies);
  await page.goto('/?capsules=1');
  await expect(page.getByTestId('xg-value')).not.toHaveText('—');

  await page.getByRole('tab', { name: 'Library' }).click();
  await page.getByTestId('competition-select').selectOption('55:282');
  await page
    .getByTestId('match-list')
    .getByRole('option', { name: /Spain 2–1 England/ })
    .click();
  await page.getByTestId(`shot-row-${SHOT_ID}`).click();

  const banner = page.getByTestId('loaded-banner');
  await expect(banner).toContainText('Mikel Oyarzabal');
  await expect(banner).toContainText('Spain 2–1 England');
  await expect(banner).toContainText('Weak foot');
  await expect(page.getByTestId('modified-pill')).toHaveCount(0);
  const ours = `${(fakeXg(SCENARIO) * 100).toFixed(1)}%`;
  await expect(page.getByTestId('xg-value')).toHaveText(ours);
  await expect(page.getByTestId('xg-compare')).toHaveText(`Ours ${ours} · StatsBomb 34.0%`);
  await expect(page).toHaveURL(new RegExp(`shot=${SHOT_ID}`));

  await dragToken(page, 'token-d0', -10);
  await expect(page.getByTestId('modified-pill')).toBeVisible();
  await expect(page.getByTestId('xg-compare')).toContainText(`Real ${ours} → Now`);

  await page.getByTestId('reset-real').click();
  await expect(page.getByTestId('modified-pill')).toHaveCount(0);
  await expect(page.getByTestId('xg-value')).toHaveText(ours);
  await expect.poll(() => bodies[bodies.length - 1].defenders[0]).toEqual(SCENARIO.defenders[0]);

  await page.getByTestId('clear-shot').click();
  await expect(banner).toHaveCount(0);
  await expect(page).not.toHaveURL(/shot=/);
});

test('?shot= deep link loads the shot on start', async ({ page }) => {
  await mockBackend(page, []);
  await page.goto(`/?capsules=1&shot=${SHOT_ID}`);
  await expect(page.getByTestId('loaded-banner')).toContainText('Mikel Oyarzabal');
  await expect(page.getByTestId('xg-compare')).toContainText('StatsBomb 34.0%');
});
