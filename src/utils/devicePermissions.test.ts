import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyMicAccessError,
  getPermissionSettingsGuidance,
  MIC_DISABLED_MESSAGE,
} from './devicePermissions';

test('classifyMicAccessError returns exact required message and guidance on denial', () => {
  const err = new DOMException('Permission denied', 'NotAllowedError');
  const result = classifyMicAccessError(err, 'prompt', 'Mozilla/5.0 (Linux; Android 14)');
  assert.equal(result.isPermissionDenied, true);
  assert.equal(result.canRetry, true);
  assert.equal(result.message, MIC_DISABLED_MESSAGE);
  assert.ok(result.guidance);
  assert.match(result.guidance.title, /Android/i);
});

test('classifyMicAccessError treats permanently denied state as retryable with settings guidance', () => {
  const result = classifyMicAccessError(null, 'denied', 'Mozilla/5.0 (Windows NT 10.0)');
  assert.equal(result.code, 'permission-blocked');
  assert.equal(result.isPermissionDenied, true);
  assert.equal(result.canRetry, true);
  assert.equal(result.message, MIC_DISABLED_MESSAGE);
  assert.ok(result.guidance?.steps.some((s) => /Site settings/i.test(s)));
});

test('classifyMicAccessError handles missing microphone and busy microphone gracefully', () => {
  const missing = classifyMicAccessError(new DOMException('Requested device not found', 'NotFoundError'));
  assert.equal(missing.code, 'not-found');
  assert.equal(missing.isPermissionDenied, false);
  assert.match(missing.message, /No working built-in microphone/i);

  const busy = classifyMicAccessError(new DOMException('Device in use', 'NotReadableError'));
  assert.equal(busy.code, 'busy');
  assert.equal(busy.canRetry, true);
  assert.match(busy.message, /in use/i);
});

test('getPermissionSettingsGuidance keeps microphone, camera, and notifications independent', () => {
  const mic = getPermissionSettingsGuidance('microphone', 'Android');
  const cam = getPermissionSettingsGuidance('camera', 'Android');
  const notif = getPermissionSettingsGuidance('notifications', 'Android');

  assert.match(mic.title, /Microphone/);
  assert.match(cam.title, /Camera/);
  assert.match(notif.title, /Notifications/);
  assert.doesNotMatch(notif.summary, /Microphone/i);
  assert.doesNotMatch(mic.summary, /Notifications/i);
});
