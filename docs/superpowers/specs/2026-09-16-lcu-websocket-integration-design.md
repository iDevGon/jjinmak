# LCU WebSocket integration design

## Goal

Replace the desktop app's periodic LCU session polling with an event-driven local WebSocket watcher while preserving the existing v0.2.0 tray, startup, icon, game-safety, and shutdown behavior.

## Scope

- Subscribe to the LCU `OnJsonApiEvent` stream over the local TLS WebSocket.
- Perform an authenticated HTTP session read after connecting and use it as the initial snapshot.
- Buffer session events received during that initial read so an older HTTP response cannot overwrite newer state.
- Re-discover credentials and reconnect after disconnects, reporting the disconnected state immediately.
- Keep the existing HTTP reader for activation and end-of-game confirmation.
- Require a delayed fresh HTTP confirmation after an end event before closing applications.
- Add unit/integration coverage for subscription, ordering, reconnect, stale reads, disposal, and controller confirmation.

## Compatibility constraints

- Do not merge the stale release/version changes from `origin/feat/lcu-websocket`.
- Preserve the current `main` implementation of tray behavior, close interception, startup login settings, app icons, v0.2.0 metadata, and their tests.
- Keep the existing `SessionGuard` semantics: only the tracked game may trigger termination, unsupported modes remain excluded, and duplicate WebSocket events are not independent confirmation.
- Keep the existing packaged app entry points and ensure the `ws` runtime dependency is present in the packaged staging directory.

## Data flow

1. `LcuClient.watch()` discovers the current port/token and opens `wss://127.0.0.1:<port>/` with the `wamp` subprotocol.
2. On `open`, it sends `[5, "OnJsonApiEvent"]`, then reads `/lol-gameflow/v1/session` over HTTPS.
3. The normalized HTTP snapshot is emitted first; buffered session events are emitted in arrival order afterward.
4. Subsequent session `Create`, `Update`, and `Delete` events are normalized and emitted. Malformed or unrelated events are ignored.
5. A socket failure emits a disconnected snapshot, clears credentials, and schedules credential discovery again after four seconds. `dispose()` cancels timers and terminates the socket.
6. `Controller.handleSnapshot()` updates connection state and observes events. The first end observation starts a 1.5-second timer; the timer uses a fresh HTTP read, and only a matching second observation performs the existing close action.

## Error handling

- Local TLS certificate validation remains disabled only for loopback LCU traffic.
- Failed reads invalidate only the credentials/socket generation that they belong to, so a late old request cannot tear down a replacement connection.
- A disconnect or non-matching confirmation resets end confirmation and never closes applications.
- No UI or platform-action semantics change.

## Verification

- Existing `npm test` and `npm run test:ui` must remain green.
- New local TLS WebSocket integration coverage must verify authentication, subscription, event handling, and one fresh end confirmation.
- Packaging must load the `ws` runtime dependency while retaining current platform icon configuration.
- Real League Client compatibility remains a manual follow-up because the LCU interface is unofficial and is not available in CI.

## Out of scope

- Changing the v0.2.0 version or release documentation.
- Reworking the tray, startup, icon, process termination, shutdown, or UI behavior.
- Adding a fallback polling loop in the desktop runtime.
