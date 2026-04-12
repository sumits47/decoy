import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3001;
const baseURL = `http://127.0.0.1:${PORT}`;
const webDir = resolve(process.cwd(), 'apps/web');

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    const rawValue = line.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    process.env[key] = value;
  }
}

loadEnvFile(resolve(webDir, '.env'));
loadEnvFile(resolve(webDir, '.env.local'));

export default defineConfig({
  testDir: './apps/web/tests',
  fullyParallel: false,
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
