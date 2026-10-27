import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
const env = { ...process.env, DEBUG: '' };
// Optional portable Java, used in this workspace; otherwise use system Java.
const javaRoot = path.resolve('.tools/java21');
if (process.platform === 'win32' && existsSync(javaRoot)) {
  const folder = readdirSync(javaRoot).find((name) =>
    existsSync(path.join(javaRoot, name, 'bin/java.exe')),
  );
  if (folder) {
    env.JAVA_HOME = path.join(javaRoot, folder);
    env.PATH = `${env.JAVA_HOME}/bin;${env.PATH}`;
  }
}
const cli = path.resolve('node_modules/firebase-tools/lib/bin/firebase.js');
const child = spawn(
  process.execPath,
  [
    cli,
    'emulators:exec',
    '--only',
    'auth,firestore',
    '--project',
    'demo-mesa-rpg',
    'node scripts/test-firebase.mjs',
  ],
  { env, stdio: 'inherit', windowsHide: true },
);
child.on('error', (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
