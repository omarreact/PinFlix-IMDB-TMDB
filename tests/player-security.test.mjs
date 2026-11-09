import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPlaybackSecurity, RESTRICTED_SANDBOX, providerForIndex } from '../assets/js/services/player-security.js';

function fakeFrame() {
  const attributes = new Map();
  return {
    attributes,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: (key) => attributes.delete(key)
  };
}
test('restricted mode sets a sandbox without popup or top-navigation permissions', () => {
  const frame = fakeFrame();
  applyPlaybackSecurity(frame);
  assert.equal(frame.attributes.get('sandbox'), RESTRICTED_SANDBOX);
  assert.equal(RESTRICTED_SANDBOX.includes('allow-popups'), false);
  assert.equal(RESTRICTED_SANDBOX.includes('allow-top-navigation'), false);
});
test('compatibility is explicitly enabled, then restores the sandbox', () => {
  const frame = fakeFrame();
  applyPlaybackSecurity(frame, true);
  assert.equal(frame.attributes.has('sandbox'), false);
  applyPlaybackSecurity(frame, false);
  assert.equal(frame.attributes.get('sandbox'), RESTRICTED_SANDBOX);
});
test('backup provider is optional; primary remains default', () => {
  assert.equal(providerForIndex('https://primary.test', 'https://backup.test', 0), 'https://primary.test');
  assert.equal(providerForIndex('https://primary.test', 'https://backup.test', 1), 'https://backup.test');
  assert.equal(providerForIndex('https://primary.test', '', 1), 'https://primary.test');
  assert.equal(providerForIndex('', 'https://backup.test'), 'https://backup.test');
});
