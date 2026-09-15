const { spawn } = require('node:child_process');
const path = require('node:path');
const target = { darwin: 'macos', win32: 'windows' }[process.platform];
if (!target) {
  console.error('macOS와 Windows에서 실행할 수 있습니다.');
  process.exitCode = 1;
} else {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(require('electron'), [path.join(__dirname, '..', 'apps', target), ...process.argv.slice(2)], { stdio: 'inherit', env });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code) => { process.exitCode = code ?? 1; });
}
