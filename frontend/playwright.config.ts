import { defineConfig } from 'playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  use: {
    baseURL: process.env.SCREENSHOT_URL ?? 'http://localhost:3000',
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    screenshot: 'only-on-failure',
  },
  reporter: 'list',
});
