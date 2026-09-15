const { _electron: electron } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const target of ['macos', 'windows']) {
  const app = await electron.launch({ args: [path.join(__dirname, '..', 'apps', target), '--demo'], env });
  try {
    const page = await app.firstWindow();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.waitForFunction(() => document.querySelector('#main-toggle')?.disabled === false);
    assert.equal(await page.title(), '찐막');
    assert.equal(await page.evaluate(() => typeof window.require), 'undefined');
    const state = await page.evaluate(() => window.jjinmak.getState());
    assert.equal(state.platform, target === 'macos' ? 'darwin' : 'win32');
    assert.equal(state.demo, true);
    assert.equal(await app.evaluate(({ Tray }) => Tray.getAllTrays().length), 1);
    const dir = path.join(__dirname, '../.impeccable/review', target);
    await fs.mkdir(dir, { recursive: true });
    await page.screenshot({ path: path.join(dir, 'desktop-off.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#discord').check();
    await page.locator('#main-toggle').click();
    await page.waitForFunction(() => document.querySelector('#main-toggle').getAttribute('aria-pressed') === 'true');
    assert.ok(await page.locator('#discord').isDisabled());
    await page.locator('summary').click();
    await page.locator('[data-demo="start"]').click();
    await page.waitForFunction(() => document.querySelector('#status-title').textContent.includes('이 판이'));
    await page.screenshot({ path: path.join(dir, 'desktop-active.png'), fullPage: true, animations: 'disabled' });
    await page.locator('[data-demo="end"]').click();
    await page.waitForFunction(() => document.querySelector('#main-toggle').getAttribute('aria-pressed') === 'false');
    assert.match(await page.locator('#status-detail').innerText(), /디스코드/);
    await page.locator('#shutdown').click();
    assert.equal(await page.locator('#platform-shutdown-note').isVisible(), target === 'macos');
    await page.locator('#decline-shutdown').click();
    assert.equal(await page.locator('#shutdown').isChecked(), false);
    await page.locator('#shutdown').click();
    await page.locator('#confirm-shutdown').click();
    await page.waitForFunction(() => document.querySelector('#shutdown').checked);
    await page.locator('[data-demo="lobby"]').click();
    await page.locator('#main-toggle').click();
    await page.locator('[data-demo="start"]').click();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].minimize());
    await page.locator('[data-demo="end"]').click();
    await page.waitForFunction(() => !document.querySelector('#countdown').hidden);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized()), false);
    await page.screenshot({ path: path.join(dir, 'desktop-countdown.png'), fullPage: true, animations: 'disabled' });
    await page.locator('#cancel-shutdown').click();
    assert.ok(await page.locator('#countdown').isHidden());
    assert.match(await page.locator('#status-detail').innerText(), /취소/);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(420, 740));
    await page.locator('summary').click();
    await page.screenshot({ path: path.join(dir, 'compact.png'), fullPage: true, animations: 'disabled' });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    await page.waitForFunction(() => document.hidden);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isDestroyed()), false);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    await page.waitForFunction(() => !document.hidden);
    assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
    assert.deepEqual(errors, []);
    console.log(`PASS (${target}): sandbox, toggles, game completion, shutdown confirmation/cancel, compact layout.`);
  } finally { await app.close(); }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
