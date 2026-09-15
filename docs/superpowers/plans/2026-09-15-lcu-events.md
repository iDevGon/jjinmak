# LCU event monitoring

Goal: Replace periodic session reads with WebSocket events, retaining same-game termination safeguards.

Design agreed in conversation: authenticate locally, subscribe before initial state read, consume session events, and confirm an ended tracked game with a fresh HTTP read after 1.5 seconds. Duplicate events cannot substitute for that read. Disconnects reset confirmation and retry discovery after four seconds. Stop sockets and timers on app exit. No UI or OS-action changes.

Implementation and verification:
- [x] Add failing LCU subscription, initial-read ordering, reconnect, stale-response and disposal tests.
- [x] Add failing controller tests for duplicate ends, disconnect during confirmation, and cancellation.
- [x] Implement LCU watch lifecycle and controller event handling; remove desktop polling loop.
- [x] Include the ws runtime dependency in packaged apps and describe monitoring in README.
- [x] Run npm test, npm run test:ui, and a package build. Actual League compatibility remains a manual check.

Protocol references: https://pengu.dev/guide/lcu-request#lcu-websocket and https://github.com/websockets/ws/blob/master/doc/ws.md

Validation: 41 unit/integration tests passed; both platform demo entrypoints passed UI smoke tests; macOS arm64 packaging passed; packaged Electron loaded LCU and ws successfully. Real League Client testing has not been performed.
