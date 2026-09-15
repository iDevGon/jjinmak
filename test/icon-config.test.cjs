const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('desktop runtime uses the generated PNG icon', () => {
  const source = fs.readFileSync(path.join(root, 'packages/desktop/src/main.cjs'), 'utf8');
  assert.match(source, /icon:\s*path\.join\(__dirname, 'ui', 'app-icon\.png'\)/);
});

test('packaging selects the native icon for each target platform', () => {
  const source = fs.readFileSync(path.join(root, 'scripts/package.mjs'), 'utf8');
  assert.match(source, /icon:\s*path\.join\(root, 'assets', platform === 'win32' \? 'jjinmak\.ico' : 'jjinmak\.icns'\)/);
});

test('native icon assets exist', () => {
  for (const name of ['jjinmak.ico', 'jjinmak.icns']) {
    assert.equal(fs.existsSync(path.join(root, 'assets', name)), true, `${name} is missing`);
  }
});
