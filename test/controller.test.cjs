const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Controller } = require('@jjinmak/core/controller');
const snapshot = (phase, gameId = null) => ({ phase, gameId, supported: true });

function setup() {
  let current = snapshot('Lobby');
  let now = 1000;
  const calls = [];
  const controller = new Controller({
    read: async () => current,
    closeGames: async (options) => calls.push(['close', options]),
    shutdown: async () => calls.push(['shutdown']),
    now: () => now,
  });
  return { controller, calls, set: (s) => { current = s; }, time: (n) => { now = n; } };
}

async function finish(f) {
  await f.controller.arm();
  f.set(snapshot('InProgress', '1'));
  await f.controller.poll();
  f.set(snapshot('EndOfGame', '1'));
  await f.controller.poll();
  await f.controller.poll();
}

test('end action is once and ordinary mode never shuts down the PC', async () => {
  const f = setup();
  await finish(f);
  await f.controller.poll();
  f.time(100000);
  await f.controller.tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0][0], 'close');
  assert.equal(f.controller.state().armed, false);
});

test('PC shutdown waits 30 seconds and runs only once', async () => {
  const f = setup();
  f.controller.setOptions({ discord: true, shutdown: true });
  await finish(f);
  assert.equal(f.controller.state().seconds, 30);
  f.time(30999);
  await f.controller.tick();
  assert.equal(f.calls.length, 1);
  f.time(31000);
  await f.controller.tick();
  await f.controller.tick();
  assert.deepEqual(f.calls, [['close', { discord: true, shutdown: true }], ['shutdown']]);
});

test('cancelling a pending shutdown prevents the OS call', async () => {
  const f = setup();
  f.controller.setOptions({ discord: false, shutdown: true });
  await finish(f);
  f.controller.cancelShutdown();
  f.time(90000);
  await f.controller.tick();
  assert.equal(f.calls.length, 1);
  assert.equal(f.controller.state().seconds, null);
});

test('disarm during an in-flight enable cannot be undone by the response', async () => {
  let resolve;
  const c = new Controller({ read: () => new Promise((r) => { resolve = r; }), closeGames: async () => {}, shutdown: async () => {} });
  const promise = c.arm();
  c.disarm();
  resolve(snapshot('Lobby'));
  await promise;
  assert.equal(c.state().armed, false);
});

test('options are locked while armed or counting down', async () => {
  const f = setup();
  f.controller.setOptions({ discord: false, shutdown: true });
  await f.controller.arm();
  assert.throws(() => f.controller.setOptions({ shutdown: false }), /해제/);
  f.controller.disarm();
  await finish(f);
  assert.throws(() => f.controller.setOptions({ shutdown: false }), /해제/);
});

test('action failure is reported without a shutdown or repeated termination', async () => {
  const f = setup();
  f.controller.closeGames = async () => { throw new Error('denied'); };
  f.controller.setOptions({ discord: false, shutdown: true });
  await finish(f);
  assert.match(f.controller.state().error, /종료/);
  assert.equal(f.controller.state().seconds, null);
  await f.controller.poll();
  assert.equal(f.calls.length, 0);
});

test('a missing session is disconnected, not a valid baseline', async () => {
  const f = setup();
  f.set(null);
  await f.controller.poll();
  assert.equal(f.controller.state().connected, false);
});
