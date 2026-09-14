import { expect, test, type Route } from '@playwright/test';

type Point = { x: number; y: number };
type Body = { shooter: Point; defenders: Point[]; goalkeeper: Point | null };

const clamp = (v: number) => Math.min(0.99, Math.max(0.01, v));

/** Deterministic stand-in for the model: fewer / deeper defenders and a closer shooter raise xG. */
function fakeXg(body: Body) {
  const depth = body.defenders.reduce((sum, d) => sum + (120 - d.x), 0);
  return clamp(0.6 - 0.1 * body.defenders.length - 0.01 * (120 - body.shooter.x) - 0.005 * depth);
}

async function fulfilPredict(route: Route, bodies: Body[]) {
  const body = route.request().postDataJSON() as Body;
  bodies.push(body);
  const xg = fakeXg(body);
  await route.fulfill({
    json: {
      xg,
      xg_raw: xg,
      logit: 0,
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
        gk_lateral_offset_toward_shooter: 0,
        weak_foot: 0,
      },
      explanation: [],
      geometry: {
        cone: [
          [body.shooter.x, body.shooter.y],
          [120, 36],
          [120, 44],
        ],
        shooter_used: body.shooter,
        goalkeeper_used: body.goalkeeper && { ...body.goalkeeper, imputed: false },
        players: [],
        goal_covered_intervals: [],
        goal_free_intervals: [[36, 44]],
      },
    },
  });
}

test('dragging a defender on the minimap changes the live xG', async ({ page }) => {
  const bodies: Body[] = [];
  await page.route('**/predict*', (route) => fulfilPredict(route, bodies));
  await page.route('**/health', (route) =>
    route.fulfill({ json: { status: 'ok', model_version: 'e2e', library_loaded: false } }),
  );

  await page.goto('/?capsules=1');
  const value = page.getByTestId('xg-value');
  await expect(value).not.toHaveText('—');
  await expect(page.getByTestId('scene').locator('canvas')).toBeVisible();
  const before = await value.textContent();
  const requestsBefore = bodies.length;
  const startX = bodies[0].defenders[0].x;

  // Shooter (108,40) and GK (118,40) are 10 SB units apart: measure the minimap scale from them.
  const [shooterBox, gkBox, tokenBox] = await Promise.all(
    ['token-shooter', 'token-gk', 'token-d0'].map((id) => page.getByTestId(id).boundingBox()),
  );
  if (!shooterBox || !gkBox || !tokenBox) throw new Error('minimap not laid out');
  const pxPerUnit = (gkBox.x - shooterBox.x) / 10;

  const cx = tokenBox.x + tokenBox.width / 2;
  const cy = tokenBox.y + tokenBox.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 5 * pxPerUnit, cy, { steps: 5 });
  await page.mouse.move(cx - 10 * pxPerUnit, cy, { steps: 5 });
  await page.mouse.up();

  await expect(value).not.toHaveText(before!);
  await expect.poll(() => bodies.length).toBeGreaterThan(requestsBefore);
  const last = bodies[bodies.length - 1];
  expect(last.defenders[0].x).toBeCloseTo(startX - 10, 0);
  expect(last.defenders[0].y).toBeCloseTo(bodies[0].defenders[0].y, 0);
  await expect(value).toHaveText(`${(fakeXg(last) * 100).toFixed(1)}%`);
});
