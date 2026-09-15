const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const path = require('node:path');
const runFile = promisify(execFile);
const systemRoot = process.env.SystemRoot || 'C:\\Windows';
const powershell = path.win32.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
const executionOptions = { windowsHide: true, timeout: 10000, maxBuffer: 1024 * 1024 };

async function runPowerShell(script, run = runFile) {
  return run(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], executionOptions);
}

async function discoverLeagueProcesses() {
  if (process.platform !== 'win32') throw new Error('Windows에서 롤에 연결할 수 있어요.');
  const { stdout } = await runPowerShell(`
    $ErrorActionPreference = 'Stop'
    [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
    $sid = (Get-Process -Id $PID).SessionId
    @(Get-CimInstance Win32_Process -Filter "Name='LeagueClientUx.exe' OR Name='LeagueClient.exe'" |
      Where-Object { $_.SessionId -eq $sid } |
      Select-Object CommandLine) | ConvertTo-Json -Compress
  `);
  const parsed = JSON.parse(stdout.trim().replace(/^\uFEFF/, '') || '[]');
  return (Array.isArray(parsed) ? parsed : [parsed]).map((p) => p?.CommandLine || '');
}

class WindowsActions {
  constructor({ platform = process.platform, run = runFile } = {}) {
    this.platform = platform;
    this.run = run;
  }
  assertWindows() {
    if (this.platform !== 'win32') throw new Error('실제 종료 기능은 Windows에서만 사용할 수 있어요.');
  }
  async closeGames({ discord }) {
    this.assertWindows();
    const names = ['LeagueClient', 'LeagueClientUx', 'LeagueClientUxRender'];
    if (discord) names.push('Discord', 'DiscordPTB', 'DiscordCanary');
    const result = await runPowerShell(`
      $ErrorActionPreference = 'Stop'
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $sid = (Get-Process -Id $PID).SessionId
      $names = @(${names.map((name) => `'${name}'`).join(',')})
      $failed = @()
      Get-Process | Where-Object { $_.SessionId -eq $sid -and $names -contains $_.ProcessName } |
        ForEach-Object {
          $target = $_
          try { $target | Stop-Process -Force -ErrorAction Stop }
          catch { if (Get-Process -Id $target.Id -ErrorAction SilentlyContinue) { $failed += $target.ProcessName } }
        }
      if ($failed.Count -gt 0) { throw ('Cannot close: ' + ($failed -join ', ')) }
    `, this.run);
    return result;
  }
  async shutdown() {
    this.assertWindows();
    return this.run(path.win32.join(systemRoot, 'System32', 'shutdown.exe'), ['/s', '/f', '/t', '0'], executionOptions);
  }
}

module.exports = { WindowsActions, discoverLeagueProcesses };
