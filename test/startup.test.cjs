const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getStartupEnabled, setStartupEnabled } = require('../packages/desktop/src/startup.cjs');

test('reads openAtLogin in real mode', () => {
  let reads = 0;
  const enabled = getStartupEnabled({
    demo: false,
    getLoginItemSettings: () => { reads += 1; return { openAtLogin: true }; },
  });

  assert.equal(enabled, true);
  assert.equal(reads, 1);
});

test('demo mode does not read OS login settings', () => {
  const enabled = getStartupEnabled({
    demo: true,
    getLoginItemSettings: () => assert.fail('demo must not query OS settings'),
  });

  assert.equal(enabled, false);
});

test('writes login settings with a visible startup window and reads the resulting state', () => {
  let stored = false;
  let options;
  const getLoginItemSettings = () => ({ openAtLogin: stored });
  const setLoginItemSettings = (value) => { options = value; stored = value.openAtLogin; };

  const enabled = setStartupEnabled({
    demo: false,
    enabled: true,
    launchOptions: { path: '/path/to/electron', args: ['/path/to/app'] },
    setLoginItemSettings,
    getLoginItemSettings,
  });

  assert.equal(enabled, true);
  assert.deepEqual(options, {
    path: '/path/to/electron',
    args: ['/path/to/app'],
    openAtLogin: true,
    openAsHidden: false,
  });
});

test('demo mode changes only memory state and does not write OS settings', () => {
  const enabled = setStartupEnabled({
    demo: true,
    enabled: true,
    setLoginItemSettings: () => assert.fail('demo must not write OS settings'),
    getLoginItemSettings: () => assert.fail('demo must not read OS settings'),
  });

  assert.equal(enabled, true);
});

test('startup setting rejects non-boolean values', () => {
  assert.throws(() => setStartupEnabled({ demo: true, enabled: 'true' }), /boolean/);
});
