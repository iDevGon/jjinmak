const { app, BrowserWindow, ipcMain, protocol, net, session, nativeTheme, Menu, Tray, nativeImage } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Controller } = require('@jjinmak/core/controller');
const { LcuClient, discoverCredentials } = require('@jjinmak/core/lcu');
const { interceptWindowClose } = require('./window-policy.cjs');

// Electron 44 reliably supports PNG/JPEG data URLs for nativeImage.
const TRAY_ICON_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAN0lEQVR4nGNgoCX48PXzfxAeNYDKBlBkIM1cRZLJtDMAJkmMAeSZTqwrYYpwYUIuxGkQ0RpJBQAFVaUeP1CEGQAAAABJRU5ErkJggg==';

function startDesktop({ platform, actions, discoverProcesses }) {
app.setName('찐막');
const demo = process.argv.includes('--demo');
if (!demo && process.platform !== platform) {
  console.error(`이 앱은 ${platform === 'darwin' ? 'macOS' : 'Windows'}용입니다. 화면 테스트는 --demo로 실행하세요.`);
  app.exit(1);
  return;
}
protocol.registerSchemesAsPrivileged([{ scheme: 'jjinmak', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

let window;
let controller;
let pollTimer;
let tickTimer;
let stopping = false;
let quitting = false;
let tray;
let countdownVisible = false;
let demoGame = 100;
let demoSnapshot = { phase: 'Lobby', gameId: null, supported: true };
const lcu = new LcuClient({ discover: () => discoverCredentials(discoverProcesses) });

function state() { return { ...controller.state(), demo, platform }; }
function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
function createTrayImage() {
  const image = nativeImage.createFromDataURL(TRAY_ICON_DATA_URL);
  if (platform === 'darwin') image.setTemplateImage(true);
  return image;
}
function createTray() {
  try {
    const createdTray = new Tray(createTrayImage());
    createdTray.setToolTip('찐막');
    createdTray.setContextMenu(Menu.buildFromTemplate([
      { label: '찐막 열기', click: showWindow },
      { type: 'separator' },
      { label: '앱 종료', click: () => { quitting = true; app.quit(); } },
    ]));
    createdTray.on('click', showWindow);
    tray = createdTray;
    return createdTray;
  } catch (error) {
    tray = null;
    console.error(`트레이를 만들지 못했습니다: ${error.message}`);
    return null;
  }
}
function sendState() {
  if (!window || window.isDestroyed()) return;
  const value = state();
  if (value.seconds !== null && !countdownVisible) {
    showWindow();
    window.flashFrame(true);
  }
  if (value.seconds === null && countdownVisible) window.flashFrame(false);
  countdownVisible = value.seconds !== null;
  window.webContents.send('state', value);
}
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== 'jjinmak://app/index.html') throw new Error('허용되지 않은 요청이에요.');
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    showWindow();
  });
  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'dark';
    const files = new Set(['/index.html', '/style.css', '/renderer.js']);
    protocol.handle('jjinmak', (request) => {
      const url = new URL(request.url);
      if (url.host !== 'app' || !files.has(url.pathname)) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(path.join(__dirname, 'ui', url.pathname.slice(1))).toString());
    });
    session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
    session.defaultSession.setPermissionCheckHandler(() => false);
    controller = new Controller({
      read: () => demo ? Promise.resolve(demoSnapshot) : lcu.read(),
      closeGames: (options) => demo ? Promise.resolve() : actions.closeGames(options),
      shutdown: () => demo ? Promise.resolve() : actions.shutdown(),
    });
    controller.on('change', sendState);
    ipcMain.handle('get-state', (event) => { trusted(event); return state(); });
    ipcMain.handle('set-armed', async (event, enabled) => {
      trusted(event);
      if (typeof enabled !== 'boolean') throw new Error('잘못된 요청이에요.');
      if (enabled) await controller.arm(); else controller.disarm();
      return state();
    });
    ipcMain.handle('set-options', (event, options) => { trusted(event); controller.setOptions(options); return state(); });
    ipcMain.handle('cancel-shutdown', (event) => { trusted(event); controller.cancelShutdown(); return state(); });
    ipcMain.handle('demo-event', async (event, kind) => {
      trusted(event);
      if (!demo) throw new Error('모의 실행에서만 사용할 수 있어요.');
      if (kind === 'start') demoSnapshot = { phase: 'InProgress', gameId: String(++demoGame), supported: true };
      else if (kind === 'end') demoSnapshot = { ...demoSnapshot, phase: 'EndOfGame' };
      else if (kind === 'disconnect') demoSnapshot = null;
      else if (kind === 'lobby') demoSnapshot = { phase: 'Lobby', gameId: null, supported: true };
      else throw new Error('잘못된 모의 이벤트예요.');
      await controller.poll();
      return state();
    });
    window = new BrowserWindow({
      title: '찐막', width: 480, height: 820, minWidth: 420, minHeight: 740,
      backgroundColor: '#121819', show: false, autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.setMenu(null);
    window.on('close', (event) => interceptWindowClose({ event, window, quitting }));
    createTray();
    app.on('activate', showWindow);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', (event) => event.preventDefault());
    window.webContents.on('will-attach-webview', (event) => event.preventDefault());
    window.once('ready-to-show', () => window.show());
    await window.loadURL('jjinmak://app/index.html');
    async function poll() {
      if (stopping) return;
      await controller.poll();
      if (!stopping) pollTimer = setTimeout(poll, controller.connected ? 1500 : 4000);
    }
    void poll();
    tickTimer = setInterval(() => void controller.tick(), 250);
  }).catch((error) => { console.error('앱을 시작하지 못했습니다:', error.message); app.quit(); });
}
app.on('before-quit', () => {
  quitting = true;
  stopping = true;
  clearTimeout(pollTimer);
  clearInterval(tickTimer);
  tray?.destroy();
  tray = null;
  controller?.disarm();
  controller?.cancelShutdown();
  actions.dispose?.();
});
}

module.exports = { startDesktop };
