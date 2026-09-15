const https = require('node:https');

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
  constructor({ discover: find, request = requestLocal }) {
    this.discover = find;
    this.request = request;
    this.credentials = null;
  }
  async read() {
    try {
      this.credentials ||= await this.discover();
      return normalizeSession(await this.request(this.credentials, '/lol-gameflow/v1/session'));
    } catch (error) {
      this.credentials = null;
      throw error;
    }
  }
}

module.exports = { parseCredentials, normalizeSession, LcuClient, requestLocal, discoverCredentials };
