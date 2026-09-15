const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const runFile = promisify(execFile);
const processOptions = { timeout: 10000, maxBuffer: 4 * 1024 * 1024 };
const leagueNames = new Set(['LeagueClient', 'LeagueClientUx', 'LeagueClientUx Helper', 'LeagueClientUx Helper (GPU)', 'LeagueClientUx Helper (Renderer)']);
const discordNames = new Set(['Discord', 'Discord PTB', 'Discord Canary', 'Discord Helper', 'Discord Helper (GPU)', 'Discord Helper (Renderer)', 'Discord PTB Helper', 'Discord PTB Helper (GPU)', 'Discord PTB Helper (Renderer)', 'Discord Canary Helper', 'Discord Canary Helper (GPU)', 'Discord Canary Helper (Renderer)']);

function assertMac(platform) {
  if (platform !== 'darwin') throw new Error('이 기능은 macOS에서만 사용할 수 있어요.');
}

function parseProcesses(output, uid) {
  return output.split('\n').flatMap((line) => {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/);
    if (!match || Number(match[1]) !== uid || Number(match[2]) <= 1) return [];
    return [{ pid: Number(match[2]), executable: match[3], name: path.posix.basename(match[3]) }];
  });
}

async function listProcesses(run, uid) {
  const { stdout } = await run('/bin/ps', ['-ww', '-ax', '-o', 'uid=', '-o', 'pid=', '-o', 'comm='], processOptions);
  return parseProcesses(stdout, uid);
}

async function discoverLeagueProcesses({ platform = process.platform, uid = process.getuid?.(), run = runFile } = {}) {
  assertMac(platform);
  const processes = await listProcesses(run, uid);
  const commands = [];
  for (const process of processes.filter((p) => p.name === 'LeagueClient' || p.name === 'LeagueClientUx')) {
    try {
      const { stdout } = await run('/bin/ps', ['-ww', '-p', String(process.pid), '-o', 'args='], processOptions);
      commands.push(stdout.trim());
    } catch (error) {
      // ps exits with status 1 if the selected process exited between queries.
      if (error.code !== 1) throw error;
    }
  }
  return commands;
}

class MacActions {
  constructor({ platform = process.platform, uid = process.getuid?.(), run = runFile, kill = process.kill.bind(process) } = {}) {
    this.platform = platform;
    this.uid = uid;
    this.run = run;
    this.kill = kill;
    this.authorization = new AbortController();
  }
  async closeGames({ discord }) {
    assertMac(this.platform);
    const processes = await listProcesses(this.run, this.uid);
    const failures = [];
    for (const target of processes) {
      if (!leagueNames.has(target.name) && !(discord && discordNames.has(target.name))) continue;
      try { this.kill(target.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') failures.push(target.name); }
    }
    if (failures.length) throw new Error(`앱 종료 권한을 확인해 주세요: ${failures.join(', ')}`);
  }
  async shutdown() {
    assertMac(this.platform);
    return this.run('/usr/bin/osascript', ['-e', 'do shell script "/sbin/shutdown -h now" with administrator privileges'], {
      timeout: 120000, maxBuffer: 65536, signal: this.authorization.signal,
    });
  }
  dispose() { this.authorization.abort(); }
}

module.exports = { MacActions, parseProcesses, discoverLeagueProcesses };
