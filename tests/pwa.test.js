// The service worker must precache every file the app loads, or it breaks offline.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const sw = readFileSync('sw.js', 'utf8');
const listed = new Set([...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]));

const walk = dir => readdirSync(dir, { withFileTypes: true })
  .flatMap(e => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

test('every js/css/icon file is precached', () => {
  const files = [...walk('js'), ...walk('css'), ...walk('icons')];
  for (const f of files) assert.ok(listed.has(f), `sw.js is missing ./${f}`);
});

test('every precached file exists', () => {
  for (const f of listed) if (f) assert.ok(existsSync(f), `sw.js lists missing file ./${f}`);
});

test('manifest is valid and its icons exist', () => {
  const m = JSON.parse(readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(existsSync(i.src), i.src);
  assert.ok(m.icons.some(i => i.purpose === 'maskable'));
});
