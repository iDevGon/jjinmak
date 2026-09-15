import { packager } from '@electron/packager';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { copyFile, cp, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = process.argv[2];
const platform = { windows: 'win32', macos: 'darwin' }[target];
if (!platform) throw new Error('빌드 대상을 windows 또는 macos로 지정하세요.');
if (platform === 'darwin' && process.platform !== 'darwin') throw new Error('Mac 앱 패키징과 개발용 서명은 macOS에서 실행하세요.');
const arch = process.argv[3] || (platform === 'win32' ? 'x64' : 'arm64');
if (!['arm64', 'x64'].includes(arch)) throw new Error('지원 아키텍처: arm64, x64');
const manifest = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const staging = await mkdtemp(path.join(os.tmpdir(), 'jjinmak-package-'));
try {
  await cp(path.join(root, 'apps', target), staging, { recursive: true, filter: (source) => path.basename(source) !== 'node_modules' });
  const scope = path.join(staging, 'node_modules', '@jjinmak');
  await mkdir(scope, { recursive: true });
  for (const name of ['core', 'desktop']) {
    await cp(path.join(root, 'packages', name), path.join(scope, name), { recursive: true, filter: (source) => path.basename(source) !== 'node_modules' });
  }
  const outputs = await packager({
    dir: staging, name: '찐막', executableName: '찐막', platform, arch,
    electronVersion: manifest.devDependencies.electron,
    out: path.join(root, 'release', target),
    icon: path.join(root, 'assets', platform === 'win32' ? 'jjinmak.ico' : 'jjinmak.icns'),
    appBundleId: 'com.idevgon.jjinmak',
    asar: true, overwrite: true, prune: false,
    ...(platform === 'win32'
      ? { win32metadata: { ProductName: '찐막', FileDescription: '찐막 · 마지막 한 판 종료 도우미' } }
      : {
          osxSign: {
            identity: '-', identityValidation: false, preAutoEntitlements: false, continueOnError: false,
            // Development builds have no Team ID. Clear inherited runtime flags explicitly.
            optionsForFile: () => ({ hardenedRuntime: false, signatureFlags: '0', timestamp: 'none', entitlements: ['com.apple.security.cs.allow-jit'] }),
          },
        }),
  });
  for (const output of outputs) await copyFile(path.join(root, 'README.md'), path.join(output, '사용설명.md'));
  console.log(`${target} ${arch} 실행 폴더:`, outputs.join('\n'));
} finally {
  // Only remove the uniquely created build staging directory, never a workspace path.
  await rm(staging, { recursive: true, force: true });
}
