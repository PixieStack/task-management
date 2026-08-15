import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];
if (!/^[0-9]+[.][0-9]+[.][0-9]+$/.test(version || '')) {
  throw new Error('Usage: node scripts/set-release-version.mjs <major.minor.patch>');
}

function replace(path, pattern, value) {
  const source = readFileSync(path, 'utf8');
  const updated = source.replace(pattern, value);
  if (updated === source) throw new Error('Version pattern was not found in ' + path);
  writeFileSync(path, updated);
}

replace('package.json', /"version": "[0-9]+[.][0-9]+[.][0-9]+"/, '"version": "' + version + '"');

const lockPath = 'package-lock.json';
let lock = readFileSync(lockPath, 'utf8');
let lockVersions = 0;
lock = lock.replace(/"version": "[0-9]+[.][0-9]+[.][0-9]+"/g, (match) => {
  lockVersions += 1;
  return lockVersions <= 2 ? '"version": "' + version + '"' : match;
});
if (lockVersions < 2) throw new Error('Package lock root versions were not found');
writeFileSync(lockPath, lock);

replace('src-tauri/Cargo.toml', /version = "[0-9]+[.][0-9]+[.][0-9]+"/, 'version = "' + version + '"');
replace('src-tauri/tauri.conf.json', /"version": "[0-9]+[.][0-9]+[.][0-9]+"/, '"version": "' + version + '"');
replace(
  'src/app/shared/services/app-update.service.ts',
  /export const APP_VERSION = '[0-9]+[.][0-9]+[.][0-9]+';/,
  "export const APP_VERSION = '" + version + "';",
);

const manifestPath = 'public/downloads.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const tag = 'native-v' + version;
for (const target of Object.values(manifest)) {
  target.version = version;
  if (target.url?.includes('/releases/download/native-v')) {
    target.url = target.url.replace(/[/]releases[/]download[/]native-v[^/]+[/]/, '/releases/download/' + tag + '/');
  }
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + String.fromCharCode(10));

console.log('Prepared native release v' + version);