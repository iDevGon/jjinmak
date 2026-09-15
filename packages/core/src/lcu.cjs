const https = require('node:https');
const WebSocket = require('ws');

function connectLocal({ port, token }) {
  return new WebSocket(`wss://127.0.0.1:${port}/`, 'wamp', {
    headers: { Authorization: `Basic ${Buffer.from(`riot:${token}`).toString('base64')}` },
    rejectUnauthorized: false, handshakeTimeout: 2500, maxPayload: 2 * 1024 * 1024,
  });
}

function parseCredentials(commandLine) {
  const port = Number(commandLine.match(/(?:^|[\s"])--app-port=(\d+)(?=[\s"]|$)/)?.[1]);
  const token = commandLine.match(/(?:^|[\s"])--remoting-auth-token=([^\s"]+)/)?.[1];
  return Number.isInteger(port) && port > 0 && port <= 65535 && token ? { port, token } : null;
}

function normalizeSession(session) {
  if (!session || typeof session.phase !== 'string') throw new Error('롤 상태 응답을 읽을 수 없어요.');
  const data = session.gameData || {};
  const id = data.gameId;
  const validId = (typeof id === 'number' && Number.isSafeInteger(id) && id > 0) ||
    (typeof id === 'string' && /^[1-9]\d*$/.test(id));
  return {
    phase: session.phase,
    gameId: validId ? String(id) : null,
    supported: !session.phase.startsWith('Watch') && !data.isSpectating && data.queue?.gameMode !== 'TFT',
  };
}

async function discoverCredentials(discoverProcesses) {
  for (const commandLine of await discoverProcesses()) {
    const credentials = parseCredentials(commandLine);
    if (credentials) return credentials;
  }
  throw new Error('롤 클라이언트를 실행하면 자동으로 연결해요.');
}

function requestLocal(credentials, endpoint) {
  return new Promise((resolve, reject) => {
    // LCU uses a self-signed certificate. This exception is only for this loopback request.
    const req = https.get({
      hostname: '127.0.0.1', port: credentials.port, path: endpoint,
      auth: `riot:${credentials.token}`, rejectUnauthorized: false,
      agent: false, timeout: 2500,
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`롤 연결 응답 오류 (${res.statusCode})`));
        return;
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        body += chunk;
        if (body.length > 2 * 1024 * 1024) req.destroy(new Error('롤 응답이 너무 커요.'));
      });
      res.on('error', reject);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { reject(new Error('롤 응답 형식을 확인할 수 없어요.')); }
      });
    });
    req.on('timeout', () => req.destroy(new Error('롤 연결 시간이 초과됐어요.')));
    req.on('error', reject);
  });
}

class LcuClient {
  constructor({ discover: find, request = requestLocal, connect = connectLocal }) {
    this.discover = find;
    this.request = request;
    this.credentials = null;
    this.connect = connect;
    this.watchGeneration = 0;
  }
  async read() {
    let credentials;
    try {
      this.credentials ||= await this.discover();
      credentials = this.credentials;
      return normalizeSession(await this.request(credentials, '/lol-gameflow/v1/session'));
    } catch (error) {
      if (this.credentials === credentials) {
        this.credentials = null;
        this.disconnect?.();
      }
      throw error;
    }
  }
  watch(onSnapshot) {
    this.dispose();
    const generation = this.watchGeneration;
    const attempt = async () => {
      let socket;
      let failed = false;
      let ready = false;
      const pending = [];
      const current = () => generation === this.watchGeneration && !failed;
      const disconnect = () => {
        if (!current()) return;
        failed = true;
        this.credentials = null;
        this.disconnect = null;
        socket?.terminate();
        onSnapshot(null);
        this.retryTimer = setTimeout(attempt, 4000);
      };
      try {
        const credentials = await this.discover();
        if (!current()) return;
        this.credentials = credentials;
        socket = this.connect(credentials);
        this.socket = socket;
        this.disconnect = disconnect;
        socket.on('error', disconnect);
        socket.on('close', disconnect);
        socket.on('message', (raw) => {
          if (!current()) return;
          let snapshot;
          try {
            const message = JSON.parse(raw.toString());
            if (!Array.isArray(message) || message[0] !== 8) return;
            const event = message[2];
            if (event?.uri !== '/lol-gameflow/v1/session') return;
            if (!['Create', 'Update', 'Delete'].includes(event.eventType)) return;
            snapshot = event.eventType === 'Delete' ? null : normalizeSession(event.data);
          } catch { return; }
          if (ready) onSnapshot(snapshot); else pending.push(snapshot);
        });
        socket.on('open', async () => {
          if (!current()) return;
          try {
            socket.send(JSON.stringify([5, 'OnJsonApiEvent']));
            const snapshot = normalizeSession(await this.request(credentials, '/lol-gameflow/v1/session'));
            if (!current()) return;
            onSnapshot(snapshot);
            for (const value of pending) onSnapshot(value);
            pending.length = 0;
            ready = true;
          } catch { disconnect(); }
        });
      } catch { disconnect(); }
    };
    void attempt();
  }
  dispose() {
    ++this.watchGeneration;
    clearTimeout(this.retryTimer);
    this.disconnect = null;
    this.socket?.terminate();
    this.socket = null;
    this.credentials = null;
  }
}

module.exports = { parseCredentials, normalizeSession, LcuClient, requestLocal, discoverCredentials };
