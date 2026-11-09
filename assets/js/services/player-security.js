// Third-party players sometimes refuse a sandboxed embed.
// Compatibility mode is explicit, session-only, and may permit ads/popups/redirects.
export const RESTRICTED_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';

export function applyPlaybackSecurity(frame, compatibilityMode = false) {
  if (compatibilityMode) frame.removeAttribute('sandbox');
  else frame.setAttribute('sandbox', RESTRICTED_SANDBOX);
}

export function providerForIndex(primary, backup, index = 0) {
  if (index === 1 && backup) return backup;
  return primary || backup || '';
}
