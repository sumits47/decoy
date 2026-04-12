import { defineConfig, devices } from '@playwright/test';

const PORT = 3001;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './apps/web/tests',
  fullyParallel: true,
  timeout: 120_000,
  expect: {
    timeout: 15_000
  },
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: {
    command: `NEXT_PUBLIC_APP_URL=${baseURL} pnpm --dir ${process.cwd()}/apps/web exec next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
