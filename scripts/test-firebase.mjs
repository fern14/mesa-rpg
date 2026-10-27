import { spawnSync } from 'node:child_process';
import path from 'node:path';
for (const [script, args] of [
  ['node_modules/tsx/dist/cli.mjs', ['--test', '--test-concurrency=1', 'tests/firestore.test.ts']],
  ['node_modules/@playwright/test/cli.js', ['test', '--config', 'playwright.firebase.config.ts']],
]) {
  const result = spawnSync(process.execPath, [path.resolve(script), ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
