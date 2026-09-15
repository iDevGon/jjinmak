const { test } = require('node:test');
const assert = require('node:assert/strict');
const { interceptWindowClose } = require('../packages/desktop/src/window-policy.cjs');

test('intercepts window close by hiding the window while not quitting', () => {
  let preventDefaultCalls = 0;
  let hideCalls = 0;
  const event = { preventDefault: () => { preventDefaultCalls += 1; } };
  const window = { hide: () => { hideCalls += 1; } };

  const result = interceptWindowClose({ event, window, quitting: false });

  assert.equal(result, true);
  assert.equal(preventDefaultCalls, 1);
  assert.equal(hideCalls, 1);
});

test('allows window close while quitting', () => {
  let preventDefaultCalls = 0;
  let hideCalls = 0;
  const event = { preventDefault: () => { preventDefaultCalls += 1; } };
  const window = { hide: () => { hideCalls += 1; } };

  const result = interceptWindowClose({ event, window, quitting: true });

  assert.equal(result, false);
  assert.equal(preventDefaultCalls, 0);
  assert.equal(hideCalls, 0);
});
