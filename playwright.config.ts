import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/local',
  testMatch: 'ui.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  reporter: 'list',
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:8082',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run web -- --port 8082',
    url: 'http://127.0.0.1:8082',
    env: { EXPO_PUBLIC_DEMO_MODE: 'true' },
    reuseExistingServer: false,
    timeout: 120000,
  },
});
