# OS 시작 자동 실행 옵션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Windows/macOS 로그인 시 찐막을 자동 실행하고 창을 표시할지 사용자가 앱 설정 스위치로 선택할 수 있게 한다.

**Architecture:** OS 로그인 항목의 읽기·쓰기는 Electron 의존성을 주입받는 작은 정책 모듈로 분리해 단위 테스트한다. 공통 Electron 실행기는 `startupEnabled` 상태와 `set-startup` IPC를 소유하고, preload/UI는 기존 격리 브리지와 renderer 요청 패턴을 따른다. 데모 모드에서는 실제 OS 로그인 항목을 건드리지 않고 메모리 상태만 바꾼다.

**Tech Stack:** Node.js 22, Electron 44 `app.getLoginItemSettings`/`app.setLoginItemSettings`, Node built-in test runner, Playwright Electron smoke test.

---

### Task 1: OS 시작 설정 정책의 실패 테스트 작성

**Files:**
- Create: `test/startup.test.cjs`
- Create: `packages/desktop/src/startup.cjs` (다음 작업에서 구현)

- [ ] **Step 1: 실제 모드 읽기, 쓰기, 데모 격리, 입력 검증 테스트를 작성한다.**

`test/startup.test.cjs`에 다음 내용을 작성한다.

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getStartupEnabled, setStartupEnabled } = require('../packages/desktop/src/startup.cjs');

test('reads openAtLogin in real mode', () => {
  let reads = 0;
  const enabled = getStartupEnabled({
    demo: false,
    getLoginItemSettings: () => { reads += 1; return { openAtLogin: true }; },
  });

  assert.equal(enabled, true);
  assert.equal(reads, 1);
});

test('demo mode does not read OS login settings', () => {
  const enabled = getStartupEnabled({
    demo: true,
    getLoginItemSettings: () => assert.fail('demo must not query OS settings'),
  });

  assert.equal(enabled, false);
});

test('writes login settings with a visible startup window and reads the resulting state', () => {
  let stored = false;
  let options;
  const getLoginItemSettings = () => ({ openAtLogin: stored });
  const setLoginItemSettings = (value) => { options = value; stored = value.openAtLogin; };

  const enabled = setStartupEnabled({
    demo: false,
    enabled: true,
    launchOptions: { path: '/path/to/electron', args: ['/path/to/app'] },
    setLoginItemSettings,
    getLoginItemSettings,
  });

  assert.equal(enabled, true);
  assert.deepEqual(options, {
    path: '/path/to/electron',
    args: ['/path/to/app'],
    openAtLogin: true,
    openAsHidden: false,
  });
});

test('demo mode changes only memory state and does not write OS settings', () => {
  const enabled = setStartupEnabled({
    demo: true,
    enabled: true,
    setLoginItemSettings: () => assert.fail('demo must not write OS settings'),
    getLoginItemSettings: () => assert.fail('demo must not read OS settings'),
  });

  assert.equal(enabled, true);
});

test('startup setting rejects non-boolean values', () => {
  assert.throws(() => setStartupEnabled({ demo: true, enabled: 'true' }), /boolean/);
});
```

- [ ] **Step 2: 새 테스트가 구현 부재로 실패하는지 확인한다.**

Run:

```sh
node --test test/startup.test.cjs
```

Expected: FAIL because `packages/desktop/src/startup.cjs` does not exist yet.

- [ ] **Step 3: 실패 테스트를 커밋한다.**

```sh
git add test/startup.test.cjs
git commit -m "test: define startup login setting policy"
```

### Task 2: OS 로그인 설정 정책과 main-process IPC 연결

**Files:**
- Create: `packages/desktop/src/startup.cjs`
- Modify: `packages/desktop/src/main.cjs`

- [ ] **Step 1: 테스트를 통과시키는 OS 설정 정책 모듈을 만든다.**

Create `packages/desktop/src/startup.cjs` with:

```js
function getStartupEnabled({ demo, getLoginItemSettings }) {
  if (demo) return false;
  return Boolean(getLoginItemSettings()?.openAtLogin);
}

function setStartupEnabled({ demo, enabled, launchOptions = {}, setLoginItemSettings, getLoginItemSettings }) {
  if (typeof enabled !== 'boolean') throw new TypeError('시작 설정은 boolean이어야 해요.');
  if (demo) return enabled;
  setLoginItemSettings({ ...launchOptions, openAtLogin: enabled, openAsHidden: false });
  return getStartupEnabled({ demo: false, getLoginItemSettings });
}

module.exports = { getStartupEnabled, setStartupEnabled };
```

Run:

```sh
node --test test/startup.test.cjs
```

Expected: all five startup policy tests pass.

- [ ] **Step 2: main process에 startup 상태와 OS 실행 경로를 추가한다.**

Add the policy import beside the existing controller imports:

```js
const { getStartupEnabled, setStartupEnabled } = require('./startup.cjs');
```

Add `let startupEnabled = false;` beside the existing `tray`/`countdownVisible` state. Add these helpers beside `state()`:

```js
function launchOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] };
}
function readStartupEnabled() {
  return getStartupEnabled({ demo, getLoginItemSettings: () => app.getLoginItemSettings() });
}
function writeStartupEnabled(enabled) {
  startupEnabled = setStartupEnabled({
    demo,
    enabled,
    launchOptions: launchOptions(),
    setLoginItemSettings: (options) => app.setLoginItemSettings(options),
    getLoginItemSettings: () => app.getLoginItemSettings(),
  });
  return startupEnabled;
}
```

Update `state()` to include `startupEnabled`:

```js
function state() { return { ...controller.state(), demo, platform, startupEnabled }; }
```

- [ ] **Step 3: 앱 준비 시 OS 설정을 읽고 `set-startup` IPC를 등록한다.**

After the `Controller` is created and before renderer requests can arrive, initialize the state:

```js
startupEnabled = readStartupEnabled();
```

Register this handler beside the existing `set-options` handler:

```js
ipcMain.handle('set-startup', (event, enabled) => {
  trusted(event);
  writeStartupEnabled(enabled);
  return state();
});
```

The fresh state is returned only after `writeStartupEnabled` succeeds. If Electron throws, `startupEnabled` remains unchanged and the rejected IPC request is handled by the existing renderer error path.

- [ ] **Step 4: policy and main-process tests pass without regressions.**

Run:

```sh
node --test test/startup.test.cjs test/desktop.test.cjs
npm test
```

Expected: five startup tests, two close-policy tests, and all existing tests pass with zero failures.

- [ ] **Step 5: main-process changes를 커밋한다.**

```sh
git add packages/desktop/src/startup.cjs packages/desktop/src/main.cjs test/startup.test.cjs
git commit -m "feat: connect startup login setting to desktop app"
```

### Task 3: preload 브리지와 앱 설정 UI 연결

**Files:**
- Modify: `packages/desktop/src/preload.cjs`
- Modify: `packages/desktop/src/ui/index.html`
- Modify: `packages/desktop/src/ui/renderer.js`

- [ ] **Step 1: preload에 startup IPC 메서드를 노출한다.**

Add this property to the existing `contextBridge.exposeInMainWorld('jjinmak', { ... })` object:

```js
setStartup: (enabled) => ipcRenderer.invoke('set-startup', enabled),
```

- [ ] **Step 2: 기존 게임 옵션과 분리된 앱 설정 행을 추가한다.**

After the existing `</section>` for the `게임이 끝나면` options and before the error paragraph, add:

```html
<section class="options app-options" aria-labelledby="app-options-title">
  <h2 id="app-options-title">앱 설정</h2>
  <label class="option-row" for="startup">
    <svg class="option-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 12h8M12 8l4 4-4 4"/></svg>
    <span class="option-copy"><strong>컴퓨터를 켜면 찐막 시작</strong><span>로그인할 때 찐막을 열고 창을 보여줘요</span></span>
    <input id="startup" type="checkbox" role="switch" disabled><span class="switch" aria-hidden="true"></span>
  </label>
</section>
```

The existing `.options`, `.option-row`, and `.switch` CSS applies; do not add a new styling system.

- [ ] **Step 3: renderer에 상태 렌더링과 안전한 toggle 요청을 추가한다.**

In `render(state)`, after the existing Discord/shutdown assignments, add:

```js
$('startup').checked = state.startupEnabled;
$('startup').disabled = busy;
```

Add this listener beside the existing option listeners. Capture the value before `request()` re-renders the current state while busy:

```js
$('startup').addEventListener('change', () => {
  const startupEnabled = $('startup').checked;
  void request(() => api.setStartup(startupEnabled));
});
```

- [ ] **Step 4: UI source checks pass.**

Run:

```sh
node --check packages/desktop/src/ui/renderer.js
rg -n "setStartup|startupEnabled|컴퓨터를 켜면 찐막 시작|set-startup" packages/desktop/src
```

Expected: the preload bridge, main state field/IPC, markup, and renderer listener are all present.

- [ ] **Step 5: preload/UI changes를 커밋한다.**

```sh
git add packages/desktop/src/preload.cjs packages/desktop/src/ui/index.html packages/desktop/src/ui/renderer.js
git commit -m "feat: add startup option to desktop settings"
```

### Task 4: 양 플랫폼 데모 스모크 테스트와 문서 갱신

**Files:**
- Modify: `scripts/smoke-ui.cjs`
- Modify: `README.md`

- [ ] **Step 1: 양 플랫폼에서 startup toggle의 OFF → ON → OFF 흐름을 검증한다.**

After the initial `state` assertions in `scripts/smoke-ui.cjs`, add:

```js
assert.equal(state.startupEnabled, false);
await page.locator('#startup').check();
await page.waitForFunction(async () => (await window.jjinmak.getState()).startupEnabled === true);
assert.equal(await page.locator('#startup').isChecked(), true);
await page.locator('#startup').uncheck();
await page.waitForFunction(async () => (await window.jjinmak.getState()).startupEnabled === false);
assert.equal(await page.locator('#startup').isChecked(), false);
```

The demo branch must satisfy this without changing the host OS login settings.

- [ ] **Step 2: README에 실제 사용 동작을 설명한다.**

After the existing background/tray paragraph near `README.md:55`, add:

```md
`컴퓨터를 켜면 찐막 시작`을 켜면 Windows 또는 Mac에 로그인할 때 찐막이 자동으로 실행되고 창이 열립니다. 다시 끄면 OS 시작 자동 실행도 해제됩니다.
```

- [ ] **Step 3: 데모 UI와 전체 테스트를 실행한다.**

Run:

```sh
npm run test:ui
npm test
```

Expected: both `PASS (macos)` and `PASS (windows)` appear; all unit tests pass, including the startup policy tests.

- [ ] **Step 4: 스모크/문서 변경을 커밋한다.**

```sh
git add scripts/smoke-ui.cjs README.md
git commit -m "test: verify startup option on both platforms"
```

### Task 5: 최종 회귀 검증

**Files:**
- Verify only; no source changes expected.

- [ ] **Step 1: 문법과 공백 검사를 실행한다.**

Run:

```sh
node --check packages/desktop/src/main.cjs
node --check packages/desktop/src/startup.cjs
node --check packages/desktop/src/preload.cjs
node --check packages/desktop/src/ui/renderer.js
git diff --check HEAD~4..HEAD
```

Expected: all commands exit successfully with no whitespace errors.

- [ ] **Step 2: 전체 Node 테스트와 양 플랫폼 UI 스모크를 실행한다.**

Run:

```sh
npm test
npm run test:ui
```

Expected: all unit tests pass and both demo targets pass existing game/tray behavior plus startup OFF → ON → OFF checks.

- [ ] **Step 3: 최종 상태를 확인한다.**

Run:

```sh
git status --short --branch
```

Expected: no uncommitted feature changes remain; unrelated existing work is untouched.
