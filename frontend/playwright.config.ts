import { defineConfig, devices } from '@playwright/test';

const port = 4173;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--ignore-gpu-blocklist',
            '--enable-unsafe-swiftshader',
          ],
        },
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
