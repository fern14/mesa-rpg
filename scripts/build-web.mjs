import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

if (existsSync('.env')) process.loadEnvFile('.env');
const required = ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'APP_ID'];
for (const key of required) {
  if (!process.env[`EXPO_PUBLIC_FIREBASE_${key}`]) {
    throw new Error(`Preencha EXPO_PUBLIC_FIREBASE_${key} antes de publicar.`);
  }
}
if (
  process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ||
  process.env.EXPO_PUBLIC_FIREBASE_EMULATOR_HOST
) {
  throw new Error('O build público não pode usar demonstração ou emuladores.');
}
const site = new URL(process.env.EXPO_PUBLIC_SITE_URL || '');
if (site.protocol !== 'https:') throw new Error('EXPO_PUBLIC_SITE_URL precisa usar HTTPS.');
const base = site.pathname.replace(/\/$/, '');
if (process.env.EXPO_BASE_URL && process.env.EXPO_BASE_URL !== base) {
  throw new Error('EXPO_BASE_URL deve corresponder ao caminho de EXPO_PUBLIC_SITE_URL.');
}
const result = spawnSync(
  process.execPath,
  [path.resolve('node_modules/expo/bin/cli'), 'export', '--platform', 'web'],
  {
    stdio: 'inherit',
    env: { ...process.env, EXPO_BASE_URL: base },
    windowsHide: true,
  },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync('dist/.nojekyll', '');
const html = readFileSync('dist/index.html', 'utf8')
  .replace('<html lang="en">', '<html lang="pt-BR">')
  .replace(
    'You need to enable JavaScript to run this app.',
    'Ative o JavaScript para usar o Mesa RPG.',
  );
writeFileSync('dist/index.html', html);
copyFileSync('dist/index.html', 'dist/404.html');
console.log(`Site pronto em dist para ${site.origin}${base}/`);
