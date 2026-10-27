import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: 'pages.spec.ts',
  outputDir: 'test-results/pages',
  workers: 1,
  use: { channel: 'chromium', baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run preview:web',
    url: 'http://127.0.0.1:4173/mesa-rpg/',
    reuseExistingServer: false,
  },
});
