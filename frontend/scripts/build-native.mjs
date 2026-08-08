import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const rawBaseUrl = (process.env.APP_API_BASE_URL ?? '').trim();

if (!rawBaseUrl) {
  console.error('APP_API_BASE_URL is required for native builds. Example: https://your-api.onrender.com');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(rawBaseUrl);
} catch {
  console.error(`APP_API_BASE_URL is not a valid absolute URL: ${rawBaseUrl}`);
  process.exit(1);
}

if (!['http:', 'https:'].includes(parsed.protocol)) {
  console.error('APP_API_BASE_URL must use http:// or https://');
  process.exit(1);
}

const apiBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const angularCli = fileURLToPath(new URL('../node_modules/@angular/cli/bin/ng.js', import.meta.url));
const args = [
  angularCli,
  'build',
  '--configuration',
  'production',
  '--define',
  `APP_API_BASE_URL=${JSON.stringify(apiBaseUrl)}`,
];

console.log(`Building native frontend for API host: ${parsed.host}`);
const result = spawnSync(process.execPath, args, { stdio: 'inherit', shell: false });

if (result.error) {
  console.error('Failed to start Angular native build:', result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
