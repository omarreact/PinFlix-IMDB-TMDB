import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyPlaybackSecurity, RESTRICTED_SANDBOX } from '../assets/js/services/player-security.js';

function fakeFrame() {
  const attributes = new Map();
  return {
    attributes,
    setAttribute: (key, value) => attributes.set(key, value),
    removeAttribute: key => attributes.delete(key)
  };
}
test('initial HTML sandbox matches the runtime constant', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const iframe = html.match(/<iframe id="stream-frame"[^>]*>/)?.[0];
  assert.ok(iframe);
  assert.ok(iframe.includes(`sandbox="${RESTRICTED_SANDBOX}"`));
  assert.ok(!RESTRICTED_SANDBOX.includes('allow-popups'));
  assert.ok(!RESTRICTED_SANDBOX.includes('allow-top-navigation'));
});
test('restricted mode applies the same sandbox at runtime', () => {
  const frame = fakeFrame();
  applyPlaybackSecurity(frame);
  assert.equal(frame.attributes.get('sandbox'), RESTRICTED_SANDBOX);
});
test('compatibility removes the sandbox explicitly and allows returning to restricted mode', () => {
  const frame = fakeFrame();
  applyPlaybackSecurity(frame, true);
  assert.equal(frame.attributes.has('sandbox'), false);
  applyPlaybackSecurity(frame, false);
  assert.equal(frame.attributes.get('sandbox'), RESTRICTED_SANDBOX);
});
test('compatibility has a user confirmation and warning before enabling', async () => {
  const app = await readFile(new URL('../assets/js/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('window.confirm('));
  assert.ok(app.includes('ads, popups, or redirects'));
  assert.ok(app.includes('applyPlaybackSecurity(els.frame, state.compatibilityMode)'));
});
