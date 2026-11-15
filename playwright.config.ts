import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:4321',
    headless: true,
    trace: 'off',
    launchOptions: {
      executablePath:
        process.env.CHROMIUM_PATH ||
        '/home/charmcast/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome',
    },
  },
});
