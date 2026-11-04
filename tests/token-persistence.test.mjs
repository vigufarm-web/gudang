import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('entry script and application imports load the same main module', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const entry = html.match(/<script type="module" src="([^"]+)"/)[1];
  const base = 'https://vigufarm-web.github.io/gudang/';
  assert.equal(new URL(entry, base).href, new URL(map.imports['./js/main.js?v=8'], base).href);
});

test('saved token survives a new module session until explicitly removed', async () => {
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  globalThis.location = { hostname: 'vigufarm-web.github.io', pathname: '/gudang/' };
  const before = await import('../js/github.js?test-before');
  before.simpanToken('fixture-token');
  const after = await import('../js/github.js?test-after');
  assert.equal(after.ambilToken(), 'fixture-token');
  assert.equal(after.adaTokenLokal(), true);
  after.simpanToken('');
  assert.equal(after.ambilToken(), '');
});
