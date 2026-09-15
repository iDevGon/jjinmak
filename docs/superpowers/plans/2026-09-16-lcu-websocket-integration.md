# LCU WebSocket Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add event-driven LCU session monitoring to the v0.2.0 application while preserving existing tray, startup, icon, shutdown, and release behavior.

**Architecture:** `LcuClient.watch()` owns the authenticated local WebSocket lifecycle and keeps `read()` for point-in-time HTTP reads. `Controller.handleSnapshot()` consumes events, starts a delayed confirmation read for a tracked game's end, and rejects stale reads using snapshot revisions. Electron keeps the v0.2.0 runtime wiring and replaces only its recurring LCU poll start/stop path.

**Tech Stack:** Node.js CommonJS modules, Electron 44, `ws` 8.21.3, Node built-in test runner, local TLS HTTPS/WebSocket integration tests, Playwright Electron smoke tests.

---

### Task 1: Add failing LCU watcher tests

**Files:**
- Create: `test/lcu-events.test.cjs`
- Create: `test/lcu-integration.test.cjs`

- [ ] **Step 1: Add unit tests for watcher behavior**

Use an `EventEmitter` socket double to test subscription frame `[5, 'OnJsonApiEvent']`, one initial HTTP read, normalized session event delivery, unrelated URI filtering, no idle polling, event buffering during the initial read, four-second reconnect, stale-read isolation, disposal, malformed messages, and Delete handling.

- [ ] **Step 2: Add local TLS integration coverage**

Create a self-signed local HTTPS server with `WebSocketServer({ server })`. Assert Basic authentication, the `wamp` protocol, the subscription frame, the initial session read, and one fresh HTTPS confirmation after two end events. Put all server/socket cleanup in `t.after()`.

- [ ] **Step 3: Run the new tests and verify the expected red state**

Run:

```sh
node --test test/lcu-events.test.cjs test/lcu-integration.test.cjs
```

Expected: FAIL because `LcuClient.watch()` and event-driven delivery do not exist on `main`.

### Task 2: Add failing controller event tests

**Files:**
- Modify: `test/controller.test.cjs`

- [ ] **Step 1: Add event-confirmation tests**

Cover one end event plus duplicates not closing early, delayed fresh confirmation closing exactly once, disconnect invalidating a pending response, disarm cancelling confirmation, and mismatched/non-ended confirmation never closing applications.

- [ ] **Step 2: Run the focused tests and verify the expected red state**

Run:

```sh
node --test test/controller.test.cjs
```

Expected: FAIL because `Controller.handleSnapshot()` and delayed confirmation do not exist on `main`.

### Task 3: Add the runtime dependency

**Files:**
- Modify: `packages/core/package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add the exact dependency without changing versions**

Add:

```json
"dependencies": {
  "ws": "8.21.3"
}
```

to `packages/core/package.json`, leaving all package versions at `0.2.0`.

- [ ] **Step 2: Refresh the lockfile**

Run `npm install --package-lock-only`. Confirm that only the `ws@8.21.3` dependency graph is added and v0.2.0 metadata remains unchanged.

### Task 4: Implement the LCU WebSocket lifecycle

**Files:**
- Modify: `packages/core/src/lcu.cjs`

- [ ] **Step 1: Implement the minimal loopback watcher**

Open `wss://127.0.0.1:<port>/` with the `wamp` subprotocol, Basic auth, the existing 2 MiB payload limit, and the existing 2.5-second timeout. Reuse `parseCredentials`, `discoverCredentials`, `requestLocal`, and `normalizeSession`.

- [ ] **Step 2: Implement ordering and filtering**

Send `[5, 'OnJsonApiEvent']` on open, read the current session over HTTPS, emit that snapshot first, then flush buffered `/lol-gameflow/v1/session` `Create`, `Update`, and `Delete` events. Ignore malformed JSON, unrelated message types/URIs, and invalid event data.

- [ ] **Step 3: Implement reconnect and disposal**

On discovery, HTTP, or socket failure emit `null`, clear credentials, terminate the current socket, and retry discovery after four seconds. `dispose()` must cancel timers, invalidate the generation, terminate the socket, and prevent stale callbacks from affecting a replacement watcher.

- [ ] **Step 4: Run the LCU tests**

Run `node --test test/lcu-events.test.cjs test/lcu-integration.test.cjs`. Expected: all LCU tests pass with zero failures.

### Task 5: Implement controller snapshot handling

**Files:**
- Modify: `packages/core/src/controller.cjs`

- [ ] **Step 1: Add snapshot revisions and confirmation timer state**

Add a monotonically increasing snapshot revision and one confirmation timer. `handleSnapshot(snapshot)` updates `snapshot`/`connected`, resets duplicate-event confirmation, and delegates to `SessionGuard` only when not arming, executing, or counting down.

- [ ] **Step 2: Add delayed fresh confirmation**

When the guard observes the first matching ended snapshot, schedule a 1.5-second timer. The timer calls `poll()`, which captures generation and snapshot revision, performs one fresh `read()`, ignores stale results, and lets only the existing guard action call `perform()`.

- [ ] **Step 3: Cancel invalid confirmation**

Clear the timer on disarm, disconnect, a different game, a non-ended phase, or an unsupported/missing snapshot. Preserve existing messages, options, shutdown, and `SessionGuard` semantics.

- [ ] **Step 4: Run controller and full unit tests**

Run `node --test test/controller.test.cjs` and `npm test`. Expected: all new and existing tests pass with zero failures.

### Task 6: Connect the watcher to the existing v0.2.0 desktop runtime

**Files:**
- Modify: `packages/desktop/src/main.cjs`
- Modify: `scripts/package.mjs`
- Modify: `README.md`

- [ ] **Step 1: Replace only the LCU polling path**

Keep v0.2.0 imports and behavior for `Menu`, `Tray`, `nativeImage`, `interceptWindowClose`, startup IPC/state, app icon, single-instance handling, close interception, tray cleanup, and `before-quit`. Remove only the recurring LCU poll timer. Start `lcu.watch((snapshot) => controller.handleSnapshot(snapshot))` in real mode and use `handleSnapshot(demoSnapshot)` in demo mode.

- [ ] **Step 2: Keep packaged dependencies and icons**

Copy the installed root `node_modules/ws` directory into the Electron staging directory while retaining current Windows/macOS native icon settings.

- [ ] **Step 3: Update only monitoring documentation**

Describe WebSocket monitoring, delayed HTTP confirmation, and four-second reconnects. Do not change `0.2.0` versions, release links, or unrelated feature documentation.

- [ ] **Step 4: Run the UI smoke tests**

Run `npm run test:ui`. Expected: both platform demos pass startup controls, tray/window behavior, game completion, shutdown confirmation/cancel, compact layout, and renderer-error checks.

### Task 7: Verify and merge the integrated branch

**Files:**
- Modify only files required by Tasks 1–6.

- [ ] **Step 1: Run the complete verification set**

Run:

```sh
npm test
npm run test:ui
npm run package:mac
```

Expected: all tests pass, both UI smoke flows pass, and the macOS arm64 package is produced with the current icon and `ws` available.

- [ ] **Step 2: Inspect scope and preserved behavior**

Run:

```sh
git diff --check main...HEAD
git diff --stat main...HEAD
git diff --name-status main...HEAD
```

Confirm no v0.2.0 files, icon assets, startup/window-policy modules, or existing regression tests are deleted or versioned backward.

- [ ] **Step 3: Request independent code review**

Review the final branch against `main`, prioritizing WebSocket lifecycle races, end-game false positives, package completeness, and preservation of v0.2.0 desktop behavior. Resolve all Critical/Important findings before merging.

- [ ] **Step 4: Merge and verify the result**

Merge `codex/icu-websocket-integration` into local `main`, then run `npm test` and `npm run test:ui` on the merged result. Keep the merge commit and do not delete the remote candidate branch.
