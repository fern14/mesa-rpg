import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  outputDir: 'test-results/firebase',
  testMatch: 'firebase.spec.ts',
  workers: 1,
  timeout: 90000,
  reporter: 'list',
  use: {
    channel: 'chromium',
    baseURL: 'http://127.0.0.1:8083',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run web -- --port 8083',
    url: 'http://127.0.0.1:8083',
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      EXPO_PUBLIC_DEMO_MODE: 'false',
      EXPO_PUBLIC_FIREBASE_API_KEY: 'fake-api-key',
      EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-mesa-rpg.firebaseapp.com',
      EXPO_PUBLIC_FIREBASE_PROJECT_ID: 'demo-mesa-rpg',
      EXPO_PUBLIC_FIREBASE_APP_ID: '1:123:web:demo',
      EXPO_PUBLIC_FIREBASE_EMULATOR_HOST: '127.0.0.1',
      EXPO_PUBLIC_SITE_URL: 'http://127.0.0.1:8083/',
    },
  },
});
