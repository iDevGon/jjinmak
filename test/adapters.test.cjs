const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCredentials, normalizeSession, LcuClient } = require('@jjinmak/core/lcu');
const { WindowsActions } = require('../apps/windows/platform.cjs');

test('LCU credentials accept quoted flags and reject invalid ports', () => {
  assert.deepEqual(parseCredentials('"C:\\Riot Games\\LeagueClientUx.exe" "--app-port=53124" "--remoting-auth-token=abc-_="'), { port: 53124, token: 'abc-_=' });
  assert.deepEqual(parseCredentials('--app-port=5000 --remoting-auth-token=hello'), { port: 5000, token: 'hello' });
  for (const line of ['', '--app-port=99999 --remoting-auth-token=a', '--app-port=0 --remoting-auth-token=a']) {
    assert.equal(parseCredentials(line), null);
  }
});

test('normalize only valid game IDs, and exclude TFT and spectators', () => {
  assert.deepEqual(normalizeSession({ phase: 'InProgress', gameData: { gameId: 123, queue: { gameMode: 'CLASSIC' } } }), { phase: 'InProgress', gameId: '123', supported: true });
  assert.equal(normalizeSession({ phase: 'InProgress', gameData: { gameId: 0 } }).gameId, null);
  assert.equal(normalizeSession({ phase: 'InProgress', gameData: { gameId: 123, queue: { gameMode: 'TFT' } } }).supported, false);
  assert.equal(normalizeSession({ phase: 'WatchInProgress', gameData: { gameId: 123 } }).supported, false);
  assert.throws(() => normalizeSession({}), /상태/);
});

test('LCU only queries a fixed endpoint and invalidates credentials on failure', async () => {
  let discoveries = 0;
  let fail = false;
  const c = new LcuClient({
    discover: async () => { discoveries++; return { port: 12345, token: 'private' }; },
    request: async (credentials, endpoint) => {
      assert.equal(credentials.port, 12345);
      assert.equal(endpoint, '/lol-gameflow/v1/session');
      if (fail) throw new Error('offline');
      return { phase: 'Lobby' };
    },
  });
  await c.read();
  await c.read();
  assert.equal(discoveries, 1);
  fail = true;
  await assert.rejects(c.read());
  fail = false;
  await c.read();
  assert.equal(discoveries, 2);
});

test('non-Windows OS actions are rejected before executing anything', async () => {
  const a = new WindowsActions({ platform: 'darwin', run: async () => assert.fail('executed') });
  await assert.rejects(a.closeGames({ discord: true }), /Windows/);
  await assert.rejects(a.shutdown(), /Windows/);
});

test('Windows termination is session-scoped and does not target Riot or Vanguard', async () => {
  const calls = [];
  const a = new WindowsActions({ platform: 'win32', run: async (...args) => { calls.push(args); return { stdout: '' }; } });
  await a.closeGames({ discord: true });
  const command = calls[0][1].at(-1);
  assert.match(command, /LeagueClient/);
  assert.match(command, /Discord/);
  assert.match(command, /SessionId/);
  assert.match(command, /Stop-Process.*-Force/s);
  assert.doesNotMatch(command, /RiotClient|vgc|vgtray|League of Legends/);
});

test('Discord is only included when selected and shutdown has no OS timer', async () => {
  const calls = [];
  const a = new WindowsActions({ platform: 'win32', run: async (...args) => { calls.push(args); return { stdout: '' }; } });
  await a.closeGames({ discord: false });
  assert.doesNotMatch(calls[0][1].at(-1), /Discord/);
  await a.shutdown();
  assert.deepEqual(calls[1][1], ['/s', '/f', '/t', '0']);
});
