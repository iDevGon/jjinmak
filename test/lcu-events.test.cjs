const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { LcuClient } = require('@jjinmak/core/lcu');
const flush = () => new Promise((resolve) => setImmediate(resolve));
const session = (phase, gameId = 1) => ({ phase, gameData: { gameId } });

function setup(t, request = async () => session('Lobby')) {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const sockets = [];
  const snapshots = [];
  let discoveries = 0;
  const client = new LcuClient({
    discover: async () => ({ port: 5000 + discoveries++, token: 'secret' }),
    request,
    connect: (credentials) => {
      const socket = new EventEmitter();
      socket.credentials = credentials;
      socket.sent = [];
      socket.send = (data) => socket.sent.push(JSON.parse(data));
      socket.terminate = () => socket.emit('close');
      sockets.push(socket);
      return socket;
    },
  });
  client.watch((s) => snapshots.push(s));
  t.after(() => client.dispose());
  const emit = (socket, value, uri = '/lol-gameflow/v1/session', eventType = 'Update') => {
    socket.emit('message', Buffer.from(JSON.stringify([8, 'OnJsonApiEvent', { uri, eventType, data: value }])));
  };
  return { client, sockets, snapshots, emit };
}

test('subscribes before initial read, consumes session events and does not poll while idle', async (t) => {
  let reads = 0;
  const f = setup(t, async () => { reads++; return session('Lobby'); });
  await flush();
  f.sockets[0].emit('open');
  await flush();
  assert.deepEqual(f.sockets[0].sent, [[5, 'OnJsonApiEvent']]);
  assert.equal(f.snapshots[0].phase, 'Lobby');
  f.emit(f.sockets[0], session('InProgress'));
  assert.equal(f.snapshots.at(-1).gameId, '1');
  assert.equal(f.snapshots.at(-1).phase, 'InProgress');
  f.emit(f.sockets[0], session('EndOfGame'), '/unrelated');
  assert.equal(f.snapshots.length, 2);
  t.mock.timers.tick(60000);
  await flush();
  assert.equal(reads, 1);
});

test('buffers events during initial read so an older response cannot overwrite them', async (t) => {
  let resolve;
  const f = setup(t, () => new Promise((r) => { resolve = r; }));
  await flush();
  f.sockets[0].emit('open');
  f.emit(f.sockets[0], session('InProgress'));
  resolve(session('Lobby'));
  await flush();
  assert.deepEqual(f.snapshots.map((s) => s.phase), ['Lobby', 'InProgress']);
});

test('disconnect invalidates old reads and credentials, reconnects after four seconds and stops on dispose', async (t) => {
  let resolve;
  const f = setup(t, () => new Promise((r) => { resolve = r; }));
  await flush();
  const old = f.sockets[0];
  old.emit('open');
  old.emit('error', new Error('offline'));
  resolve(session('EndOfGame'));
  await flush();
  assert.deepEqual(f.snapshots, [null]);
  t.mock.timers.tick(4000);
  await flush();
  assert.equal(f.sockets.length, 2);
  assert.notEqual(old.credentials.port, f.sockets[1].credentials.port);
  f.emit(old, session('EndOfGame'));
  assert.deepEqual(f.snapshots, [null]);
  f.client.dispose();
  t.mock.timers.tick(4000);
  await flush();
  assert.equal(f.sockets.length, 2);
});

test('deleted sessions become disconnected and malformed messages do not trigger an end', async (t) => {
  const f = setup(t);
  await flush();
  const socket = f.sockets[0];
  socket.emit('open');
  await flush();
  socket.emit('message', Buffer.from('invalid json'));
  f.emit(socket, {}, '/lol-gameflow/v1/session');
  assert.equal(f.snapshots.at(-1).phase, 'Lobby');
  f.emit(socket, null, '/lol-gameflow/v1/session', 'Delete');
  assert.equal(f.snapshots.at(-1), null);
});

test('a failed old HTTP read cannot disconnect a replacement websocket', async (t) => {
  let reject;
  let failNext = false;
  const f = setup(t, async () => {
    if (failNext) return new Promise((_resolve, r) => { reject = r; });
    return session('Lobby');
  });
  await flush();
  f.sockets[0].emit('open');
  await flush();
  failNext = true;
  const read = f.client.read();
  f.sockets[0].emit('close');
  t.mock.timers.tick(4000);
  await flush();
  const replacement = f.client.credentials;
  reject(new Error('old request failed'));
  await assert.rejects(read);
  assert.equal(f.client.credentials, replacement);
});
