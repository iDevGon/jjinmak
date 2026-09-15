const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SessionGuard } = require('@jjinmak/core');
const s = (phase, gameId = null) => ({ phase, gameId, supported: true });

test('only a new observed game ending twice produces one action and disarms', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), { discord: true, shutdown: false });
  assert.equal(g.observe(s('ChampSelect')), null);
  assert.equal(g.observe(s('InProgress', '101')), null);
  assert.equal(g.observe(s('PreEndOfGame', '101')), null);
  assert.deepEqual(g.observe(s('EndOfGame', '101')), { discord: true, shutdown: false });
  assert.equal(g.armed, false);
  assert.equal(g.observe(s('EndOfGame', '101')), null);
});

test('dodge, lobby, disappearing game and API errors never trigger', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), {});
  for (const value of [s('ChampSelect'), s('Lobby'), null, s('EndOfGame', '99')]) {
    assert.equal(g.observe(value), null);
  }
  g.observe(s('InProgress', '101'));
  for (const value of [null, s('None'), s('Reconnect', '101'), s('Lobby')]) {
    assert.equal(g.observe(value), null);
  }
  assert.equal(g.armed, true);
});

test('arming during a game skips that game and can track the next game', () => {
  const g = new SessionGuard();
  g.arm(s('InProgress', '101'), {});
  for (const value of [s('InProgress', '101'), s('EndOfGame', '101'), s('EndOfGame', '101')]) {
    assert.equal(g.observe(value), null);
  }
  g.observe(s('Lobby'));
  g.observe(s('InProgress', '102'));
  g.observe(s('EndOfGame', '102'));
  assert.ok(g.observe(s('EndOfGame', '102')));
});

test('arming without a connection establishes a baseline before tracking', () => {
  const g = new SessionGuard();
  g.arm(null, {});
  g.observe(s('InProgress', '101'));
  g.observe(s('EndOfGame', '101'));
  assert.equal(g.observe(s('EndOfGame', '101')), null);
  assert.equal(g.gameId, null);
});

test('no connection at activation still allows a game after observing a lobby', () => {
  const g = new SessionGuard();
  g.arm(null, {});
  g.observe(s('Lobby'));
  g.observe(s('InProgress', '101'));
  g.observe(s('EndOfGame', '101'));
  assert.ok(g.observe(s('EndOfGame', '101')));
});

test('disconnect interrupts end confirmation, reconnecting to same game works', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), {});
  g.observe(s('InProgress', '101'));
  g.observe(s('PreEndOfGame', '101'));
  g.observe(null);
  assert.equal(g.observe(s('EndOfGame', '101')), null);
  assert.ok(g.observe(s('EndOfGame', '101')));
});

test('mismatched or missing game IDs cannot finish a tracked game', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), {});
  g.observe(s('InProgress', '101'));
  for (const value of [s('EndOfGame'), s('EndOfGame'), s('EndOfGame', '102'), s('EndOfGame', '102')]) {
    assert.equal(g.observe(value), null);
  }
});

test('a different active game disarms instead of ending the wrong game', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), {});
  g.observe(s('InProgress', '101'));
  g.observe(s('InProgress', '102'));
  assert.equal(g.armed, false);
  assert.equal(g.observe(s('EndOfGame', '102')), null);
});

test('unsupported modes and unobserved active games cannot trigger', () => {
  const g = new SessionGuard();
  g.arm(s('Lobby'), {});
  g.observe({ ...s('InProgress', '101'), supported: false });
  assert.equal(g.gameId, null);
  g.observe(s('EndOfGame', '101'));
  assert.equal(g.observe(s('EndOfGame', '101')), null);
});

test('disarming cancels a tracked game and options are captured at activation', () => {
  const g = new SessionGuard();
  const options = { discord: true, shutdown: true };
  g.arm(s('Lobby'), options);
  options.shutdown = false;
  assert.equal(g.options.shutdown, true);
  g.observe(s('InProgress', '101'));
  g.disarm();
  g.observe(s('EndOfGame', '101'));
  assert.equal(g.observe(s('EndOfGame', '101')), null);
});

test('arming in an active phase with a missing ID waits for the next lobby', () => {
  const g = new SessionGuard();
  g.arm(s('InProgress'), {});
  g.observe(s('InProgress', '101'));
  g.observe(s('EndOfGame', '101'));
  assert.equal(g.observe(s('EndOfGame', '101')), null);
  g.observe(s('Lobby'));
  g.observe(s('InProgress', '102'));
  g.observe(s('EndOfGame', '102'));
  assert.ok(g.observe(s('EndOfGame', '102')));
});
