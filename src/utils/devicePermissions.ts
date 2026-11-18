export type PermissionFeature = 'microphone' | 'camera' | 'notifications';

export type DevicePermissionState =
  | 'granted'
  | 'prompt'
  | 'denied'
  | 'unsupported'
  | 'unknown';

export const MIC_DISABLED_MESSAGE =
  'Microphone access is disabled. Please open your phone or app settings, allow microphone permission for ALEXYN, then try again.';

export interface PermissionGuidance {
  title: string;
  steps: string[];
  summary: string;
}

export interface MicErrorClassification {
  code:
    | 'permission-denied'
    | 'permission-blocked'
    | 'not-found'
    | 'busy'
    | 'insecure-context'
    | 'unsupported'
    | 'no-speech'
    | 'unknown';
  isPermissionDenied: boolean;
  canRetry: boolean;
  message: string;
  guidance: PermissionGuidance | null;
}

export function getPermissionSettingsGuidance(
  feature: PermissionFeature,
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : ''
): PermissionGuidance {
  const ua = userAgent.toLowerCase();
  const isAndroid = ua.includes('android');
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const featureLabel =
    feature === 'microphone'
      ? 'Microphone'
      : feature === 'camera'
      ? 'Camera'
      : 'Notifications';

  if (isAndroid) {
    return {
      title: `Enable ${featureLabel} on Android or Mobile Browser`,
      steps: [
        `Android App / WebView: Open Phone Settings → Apps → ALEXYN (or your browser app) → Permissions → ${featureLabel} → Allow.`,
        `Browser Site Setting: Tap the lock or settings icon next to the address bar → Permissions → ${featureLabel} → Allow.`,
        'Return to ALEXYN and tap Retry.',
      ],
      summary: `Open Android App Settings → Permissions → ${featureLabel} → Allow (or the browser address-bar site permissions), then tap Retry.`,
    };
  }

  if (isIOS) {
    return {
      title: `Enable ${featureLabel} on iPhone / iPad`,
      steps: [
        `Open iOS Settings → Safari / Browser (or ALEXYN) → ${featureLabel} → Allow.`,
        'In Safari, you can also tap the aA / settings icon in the address bar → Website Settings → Allow.',
        'Return here and tap Retry.',
      ],
      summary: `Open iOS Settings or Safari Website Settings → allow ${featureLabel}, then tap Retry.`,
    };
  }

  return {
    title: `Enable ${featureLabel} in Browser or App Settings`,
    steps: [
      `Click the lock or tune icon in the left side of your browser address bar → Site settings → set ${featureLabel} to Allow.`,
      `On mobile or WebView apps, open Device Settings → Apps → Permissions → ${featureLabel} → Allow.`,
      'Reload if prompted, or tap Retry below.',
    ],
    summary: `Open your browser Site Settings (lock/tune icon in address bar) or Device App Settings, allow ${featureLabel}, then tap Retry.`,
  };
}

export function classifyMicAccessError(
  err: unknown,
  permissionState: DevicePermissionState = 'unknown',
  userAgent?: string
): MicErrorClassification {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const rawMsg = err instanceof Error ? err.message : String(err || '');
  const low = `${name} ${rawMsg}`.toLowerCase();

  if (
    permissionState === 'denied' ||
    low.includes('notallowed') ||
    low.includes('permission') ||
    low.includes('not-allowed') ||
    low.includes('denied')
  ) {
    return {
      code: permissionState === 'denied' ? 'permission-blocked' : 'permission-denied',
      isPermissionDenied: true,
      canRetry: true,
      message: MIC_DISABLED_MESSAGE,
      guidance: getPermissionSettingsGuidance('microphone', userAgent),
    };
  }

  if (
    low.includes('notfound') ||
    low.includes('devicesnotfound') ||
    low.includes('no audio') ||
    low.includes('no microphone')
  ) {
    return {
      code: 'not-found',
      isPermissionDenied: false,
      canRetry: true,
      message:
        'No working built-in microphone was detected on this device. Connect or enable a microphone and try again, or type your message.',
      guidance: null,
    };
  }

  if (
    low.includes('notreadable') ||
    low.includes('trackstart') ||
    low.includes('in use') ||
    low.includes('abort')
  ) {
    return {
      code: 'busy',
      isPermissionDenied: false,
      canRetry: true,
      message:
        'Your device microphone is currently in use by another app. Close the other audio app and tap Retry.',
      guidance: null,
    };
  }

  if (low.includes('security') || low.includes('insecure') || low.includes('only secure origins')) {
    return {
      code: 'insecure-context',
      isPermissionDenied: false,
      canRetry: true,
      message:
        'Microphone capture requires HTTPS, localhost, or app-level microphone permission in this WebView.',
      guidance: getPermissionSettingsGuidance('microphone', userAgent),
    };
  }

  if (low.includes('unsupported') || low.includes('not supported')) {
    return {
      code: 'unsupported',
      isPermissionDenied: false,
      canRetry: false,
      message:
        'Voice recording is not supported in this browser or WebView. You can type your message directly below.',
      guidance: null,
    };
  }

  if (low.includes('no-speech')) {
    return {
      code: 'no-speech',
      isPermissionDenied: false,
      canRetry: true,
      message: 'No speech detected. Tap Retry or the mic button and speak clearly.',
      guidance: null,
    };
  }

  return {
    code: 'unknown',
    isPermissionDenied: false,
    canRetry: true,
    message:
      'Could not start the built-in microphone in this browser. Check your microphone settings and try again, or type directly.',
    guidance: getPermissionSettingsGuidance('microphone', userAgent),
  };
}

export async function queryDevicePermissionState(
  feature: PermissionFeature
): Promise<DevicePermissionState> {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'unsupported';
  }

  if (feature === 'notifications') {
    if (typeof Notification === 'undefined') return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return 'prompt';
  }

  try {
    if (navigator.permissions && typeof navigator.permissions.query === 'function') {
      const status = await navigator.permissions.query({
        name: feature as PermissionName,
      });
      if (status?.state === 'granted' || status?.state === 'denied' || status?.state === 'prompt') {
        return status.state;
      }
    }
  } catch {
    // Some browsers / Android WebViews throw on navigator.permissions.query({ name: 'microphone' })
  }

  return 'unknown';
}
