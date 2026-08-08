import { spawnSync } from 'node:child_process';

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
const ngExecutable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
  'ng',
  'build',
  '--configuration',
  'production',
  '--define',
  `APP_API_BASE_URL=${JSON.stringify(apiBaseUrl)}`,
];

console.log(`Building native frontend for API host: ${parsed.host}`);
const result = spawnSync(ngExecutable, args, { stdio: 'inherit', shell: false });

process.exit(result.status ?? 1);
