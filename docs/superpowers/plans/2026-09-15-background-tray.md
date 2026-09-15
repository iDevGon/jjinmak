# 백그라운드 트레이 유지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows와 macOS에서 창의 닫기 버튼을 눌러도 찐막과 게임 감시가 백그라운드에서 유지되고, 트레이/메뉴바 메뉴로 다시 열거나 실제 종료할 수 있게 한다.

**Architecture:** 공통 Electron 실행기인 `packages/desktop/src/main.cjs`가 창, 인라인 트레이 아이콘, 메뉴, 실제 종료 플래그를 소유한다. 창 닫기 이벤트의 순수 정책은 별도 모듈로 분리해 Electron을 띄우지 않고 단위 테스트한다. Windows/macOS 진입점과 OS별 프로세스 어댑터는 수정하지 않는다.

**Tech Stack:** Node.js 22, Electron 44, Node built-in test runner, Playwright Electron smoke test.

---

### Task 1: 창 닫기 정책의 실패 테스트 작성

**Files:**
- Create: `test/desktop.test.cjs`
- Create: `packages/desktop/src/window-policy.cjs` (다음 작업에서 구현)

- [ ] **Step 1: 닫기 이벤트 정책을 검증하는 테스트를 작성한다.**

`test/desktop.test.cjs`에 다음 내용을 추가한다.

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interceptWindowClose } = require('../packages/desktop/src/window-policy.cjs');

test('ordinary window close is intercepted and hides the window', () => {
  let prevented = 0;
  let hidden = 0;
  const handled = interceptWindowClose({
    event: { preventDefault: () => { prevented += 1; } },
    window: { hide: () => { hidden += 1; } },
    quitting: false,
  });

  assert.equal(handled, true);
  assert.equal(prevented, 1);
  assert.equal(hidden, 1);
});

test('window close is allowed during an intentional app quit', () => {
  let prevented = 0;
  let hidden = 0;
  const handled = interceptWindowClose({
    event: { preventDefault: () => { prevented += 1; } },
    window: { hide: () => { hidden += 1; } },
    quitting: true,
  });

  assert.equal(handled, false);
  assert.equal(prevented, 0);
  assert.equal(hidden, 0);
});
```

- [ ] **Step 2: 새 테스트가 구현 부재로 실패하는지 확인한다.**

Run:

```sh
node --test test/desktop.test.cjs
```

Expected: FAIL because `packages/desktop/src/window-policy.cjs` does not exist yet.

- [ ] **Step 3: 실패 테스트를 커밋한다.**

```sh
git add test/desktop.test.cjs
git commit -m "test: define background window close policy"
```

### Task 2: 공통 Electron 트레이와 창 수명주기 구현

**Files:**
- Create: `packages/desktop/src/window-policy.cjs`
- Modify: `packages/desktop/src/main.cjs`

- [ ] **Step 1: 테스트를 통과시키는 최소 정책 모듈을 만든다.**

`packages/desktop/src/window-policy.cjs`를 다음 내용으로 만든다.

```js
function interceptWindowClose({ event, window, quitting }) {
  if (quitting) return false;
  event.preventDefault();
  window.hide();
  return true;
}

module.exports = { interceptWindowClose };
```

Run:

```sh
node --test test/desktop.test.cjs
```

Expected: `2` tests pass.

- [ ] **Step 2: Electron 모듈과 정책 모듈을 공통 실행기에 연결한다.**

`packages/desktop/src/main.cjs`의 Electron import와 require를 다음처럼 바꾼다.

```js
const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, protocol, net, session, nativeTheme } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { interceptWindowClose } = require('./window-policy.cjs');
```

`startDesktop` 내부의 상태 변수에 `tray`와 `quitting`을 추가한다.

```js
let window;
let tray;
let controller;
let pollTimer;
let tickTimer;
let quitting = false;
let stopping = false;
```

기존 `let window;`부터 시작하는 선언부에 있는 중복 `let pollTimer`, `let tickTimer`, `let stopping`은 위 선언으로 교체하고, 나머지 상태 변수(`countdownVisible`, `demoGame`, `demoSnapshot`)는 그대로 둔다.

- [ ] **Step 3: 창 표시, 인라인 트레이 아이콘, 메뉴 생성 함수를 추가한다.**

`state()`와 `sendState()`보다 앞에 다음 함수를 추가한다.

```js
function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

function createTrayImage() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1.5v5.25M4.1 3.75a5.5 5.5 0 1 0 7.8 0" fill="none" stroke="#f0f5f3" stroke-width="1.5" stroke-linecap="round"/></svg>';
  const image = nativeImage.createFromDataURL(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  if (platform === 'darwin') image.setTemplateImage(true);
  return image;
}

function createTray() {
  const instance = new Tray(createTrayImage());
  instance.setToolTip('찐막');
  instance.setContextMenu(Menu.buildFromTemplate([
    { label: '찐막 열기', click: showWindow },
    { type: 'separator' },
    { label: '앱 종료', click: () => { quitting = true; app.quit(); } },
  ]));
  instance.on('click', showWindow);
  return instance;
}
```

This keeps the icon independent from packaging assets and marks the same icon as a macOS template image.

- [ ] **Step 4: 기존 상태 전송과 단일 인스턴스 동작을 `showWindow`로 통합한다.**

In `sendState()`, replace the three lines that restore, show, and focus the window with a single call:

```js
if (value.seconds !== null && !countdownVisible) {
  showWindow();
  window.flashFrame(true);
}
```

In the `second-instance` handler, replace the conditional restore/focus block with:

```js
app.on('second-instance', () => {
  showWindow();
});
```

- [ ] **Step 5: 창 닫기를 숨김으로 가로채고 앱 준비 시 트레이를 만든다.**

Immediately after the `BrowserWindow` construction and before `loadURL`, add:

```js
window.on('close', (event) => {
  interceptWindowClose({ event, window, quitting });
});
tray = createTray();
```

After `app.whenReady()` starts, register macOS activation through the same helper before creating the window:

```js
app.on('activate', showWindow);
```

The existing `ready-to-show` handler remains unchanged so the first window still opens normally.

- [ ] **Step 6: 기존 자동 종료 경로를 제거하고 의도적 종료 시에만 정리한다.**

Delete this existing handler:

```js
app.on('window-all-closed', () => app.quit());
```

Update the existing `before-quit` handler to set the intentional quit flag and destroy the tray before the existing controller/action cleanup:

```js
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
```

- [ ] **Step 7: 공통 단위 테스트와 기존 테스트를 실행한다.**

Run:

```sh
node --test test/desktop.test.cjs
npm test
```

Expected: the two desktop policy tests and all existing project tests pass with zero failures. If dependencies are absent, run `npm ci` once before these commands.

- [ ] **Step 8: 수명주기 구현을 커밋한다.**

```sh
git add packages/desktop/src/window-policy.cjs packages/desktop/src/main.cjs test/desktop.test.cjs
git commit -m "feat: keep desktop app alive after window close"
```

### Task 3: 사용자 안내 문구를 백그라운드 동작에 맞춘다

**Files:**
- Modify: `packages/desktop/src/ui/index.html:57`
- Modify: `README.md:55`

- [ ] **Step 1: 앱 하단 안내 문구를 변경한다.**

Replace the existing footer:

```html
<footer>최소화하면 계속 지켜봐요.<br>창을 닫으면 찐막도 종료돼요.</footer>
```

with:

```html
<footer>창을 닫아도 아이콘 메뉴에서 계속 지켜봐요.<br>앱을 끝내려면 아이콘 메뉴에서 앱 종료를 선택하세요.</footer>
```

- [ ] **Step 2: README의 실행 동작 설명을 갱신한다.**

Replace:

```md
최소화하면 감시가 유지됩니다. 창을 닫으면 앱과 감시가 종료되며 앱 내 PC 종료 예약도 취소됩니다.
```

with:

```md
최소화하거나 창을 닫아도 앱과 감시는 계속 실행됩니다. Windows에서는 하단 트레이, Mac에서는 상단 메뉴바 아이콘의 `찐막 열기`로 창을 다시 표시할 수 있습니다. 실제 앱 종료와 앱 내 PC 종료 예약 취소는 아이콘 메뉴의 `앱 종료`에서 수행합니다.
```

- [ ] **Step 3: 문서 변경을 커밋한다.**

```sh
git add packages/desktop/src/ui/index.html README.md
git commit -m "docs: explain background tray behavior"
```

### Task 4: 두 플랫폼의 UI 스모크 테스트에 창 닫기와 트레이를 포함한다

**Files:**
- Modify: `scripts/smoke-ui.cjs` near the compact layout assertions

- [ ] **Step 1: 모의 실행에서 트레이가 생성되었는지 확인한다.**

After the initial state assertions, add this assertion:

```js
assert.equal(await app.evaluate(({ Tray }) => Tray.getAllTrays().length), 1);
```

- [ ] **Step 2: 창 닫기 후 프로세스와 감시 창 객체가 살아 있는지 확인한다.**

After the compact layout assertion and before `assert.deepEqual(errors, []);`, add:

```js
await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
await page.waitForFunction(() => document.hidden);
assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isDestroyed()), false);
assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), false);

await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
await page.waitForFunction(() => !document.hidden);
assert.equal(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isVisible()), true);
```

This verifies the close event hides rather than destroys the window for both the macOS and Windows entry points. The explicit `show()` models the `찐막 열기` menu action without relying on native menu automation in CI.

- [ ] **Step 3: UI smoke test를 실행한다.**

Run:

```sh
npm run test:ui
```

Expected: `PASS (macos)` and `PASS (windows)` with no page errors, and both targets complete their existing interaction checks.

- [ ] **Step 4: 스모크 테스트 변경을 커밋한다.**

```sh
git add scripts/smoke-ui.cjs
git commit -m "test: verify tray app survives window close"
```

### Task 5: 최종 회귀 검증

**Files:**
- Verify only; no source changes expected.

- [ ] **Step 1: 변경된 파일과 공백 오류를 확인한다.**

Run:

```sh
git diff --check HEAD~4..HEAD
git status --short --branch
```

Expected: no whitespace errors; only intentional commits are present, and the pre-existing untracked `.superpowers/` directory remains untouched.

- [ ] **Step 2: 전체 Node 테스트를 실행한다.**

Run:

```sh
npm test
```

Expected: every test passes.

- [ ] **Step 3: 두 플랫폼 데모 UI를 실행해 전체 흐름을 확인한다.**

Run:

```sh
npm run test:ui
```

Expected: both platform targets pass sandbox, toggles, game completion, shutdown confirmation/cancel, compact layout, tray creation, and window-close retention checks.

- [ ] **Step 4: 최종 상태를 확인한다.**

Run:

```sh
git status --short --branch
```

Expected: no uncommitted feature changes remain; the existing `.superpowers/` untracked directory is not added or modified.
