const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MacActions, parseProcesses, discoverLeagueProcesses } = require('../apps/macos/platform.cjs');
const ps = `
  501 101 /Applications/League of Legends.app/Contents/LoL/LeagueClient.app/Contents/MacOS/LeagueClient
  501 102 /Applications/League of Legends.app/Contents/LoL/LeagueClientUx.app/Contents/MacOS/LeagueClientUx
  501 103 /Applications/League of Legends.app/Contents/LoL/LeagueClientUx.app/Contents/Frameworks/LeagueClientUx Helper (Renderer).app/Contents/MacOS/LeagueClientUx Helper (Renderer)
  501 201 /Applications/Discord.app/Contents/MacOS/Discord
  501 202 /Applications/Discord.app/Contents/Frameworks/Discord Helper (Renderer).app/Contents/MacOS/Discord Helper (Renderer)
  501 301 /Applications/Riot Client.app/Contents/MacOS/RiotClientServices
  501 302 /Applications/Other.app/Contents/MacOS/Discordish
  502 401 /Applications/Discord.app/Contents/MacOS/Discord
`;

test('macOS process parsing preserves spaces and selects current user only', () => {
  const processes = parseProcesses(ps, 501);
  assert.equal(processes.length, 7);
  assert.equal(processes[2].name, 'LeagueClientUx Helper (Renderer)');
  assert.equal(processes[0].pid, 101);
});

test('macOS discovery reads args only for the current user League executables', async () => {
  const calls = [];
  const run = async (file, args) => {
    calls.push([file, args]);
    return { stdout: args.includes('comm=') ? ps : 'LeagueClientUx --app-port=5555 --remoting-auth-token=fake' };
  };
  const lines = await discoverLeagueProcesses({ platform: 'darwin', uid: 501, run });
  assert.equal(lines.length, 2);
  assert.deepEqual(calls.slice(1).map(c => c[1][2]), ['101', '102']);
  assert.ok(calls.every(c => c[0] === '/bin/ps'));
});

test('macOS closes only League by default, and includes Discord only when selected', async () => {
  const killed = [];
  const actions = new MacActions({ platform: 'darwin', uid: 501, run: async () => ({ stdout: ps }), kill: (pid, signal) => { assert.equal(signal, 'SIGKILL'); killed.push(pid); } });
  await actions.closeGames({ discord: false });
  assert.deepEqual(killed, [101, 102, 103]);
  killed.length = 0;
  await actions.closeGames({ discord: true });
  assert.deepEqual(killed, [101, 102, 103, 201, 202]);
});

test('macOS ignores already exited targets but reports permission failures', async () => {
  const actions = new MacActions({ platform: 'darwin', uid: 501, run: async () => ({ stdout: ps }), kill: () => { throw Object.assign(new Error(), { code: 'ESRCH' }); } });
  await actions.closeGames({ discord: false });
  actions.kill = () => { throw Object.assign(new Error(), { code: 'EPERM' }); };
  await assert.rejects(actions.closeGames({ discord: false }));
});

test('macOS shutdown uses one fixed command with OS administrator authorization', async () => {
  let call;
  const actions = new MacActions({ platform: 'darwin', uid: 501, run: async (...args) => { call = args; } });
  await actions.shutdown();
  assert.equal(call[0], '/usr/bin/osascript');
  assert.deepEqual(call[1], ['-e', 'do shell script "/sbin/shutdown -h now" with administrator privileges']);
  assert.ok(call[2].signal);
});

test('macOS adapter refuses other platforms without launching commands', async () => {
  const run = async () => assert.fail('unexpected OS command');
  const actions = new MacActions({ platform: 'win32', uid: 501, run });
  await assert.rejects(actions.closeGames({ discord: true }), /macOS/);
  await assert.rejects(actions.shutdown(), /macOS/);
  await assert.rejects(discoverLeagueProcesses({ platform: 'win32', uid: 501, run }), /macOS/);
});

test('disposing the macOS adapter aborts an outstanding authorization request', async () => {
  let signal;
  const actions = new MacActions({ platform: 'darwin', uid: 501, run: async (_file, _args, opts) => { signal = opts.signal; } });
  await actions.shutdown();
  actions.dispose();
  assert.equal(signal.aborted, true);
});
