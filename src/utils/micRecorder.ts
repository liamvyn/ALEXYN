import { apiUrl, formatConnectionError, isFileProtocolWithoutServer, parseJsonResponseSafe } from './apiBase';
import {
  classifyMicAccessError,
  queryDevicePermissionState,
  type DevicePermissionState,
  type PermissionGuidance,
} from './devicePermissions';

export type MicCaptureStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'stopped'
  | 'error';

export interface MicNoticeDetail {
  text: string;
  isPermissionDenied: boolean;
  canRetry: boolean;
  guidance: PermissionGuidance | null;
}

export interface MicSessionCallbacks {
  onStatusChange: (status: MicCaptureStatus) => void;
  onTranscript: (spokenText: string) => void;
  onNotice: (message: string | null) => void;
  onNoticeDetail?: (detail: MicNoticeDetail | null) => void;
}

interface SpeechRecognitionAlt {
  transcript?: string;
}

interface SpeechRecognitionResultItem {
  isFinal?: boolean;
  [index: number]: SpeechRecognitionAlt;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<SpeechRecognitionResultItem> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export interface ActiveMicHandle {
  stop: () => void;
}

export function describeMicPermissionError(
  err: unknown,
  permissionState: DevicePermissionState = 'unknown'
): string {
  return classifyMicAccessError(err, permissionState).message;
}

async function transcribeAudioBlob(
  blob: Blob,
  languageCode: string
): Promise<string> {
  if (isFileProtocolWithoutServer()) {
    throw new Error(formatConnectionError(new Error('offline')));
  }
  const base64Audio = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      resolve(dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl);
    };
    reader.onerror = () => reject(new Error('Could not read recorded microphone audio.'));
    reader.readAsDataURL(blob);
  });

  if (!base64Audio || base64Audio.length < 40) {
    throw new Error('No clear speech audio was captured. Speak closer to the microphone and try again.');
  }

  const resp = await fetch(apiUrl('/api/speech/transcribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      audioBase64: base64Audio,
      audioMimeType: blob.type || 'audio/webm',
      language: languageCode,
    }),
  });
  const data = await parseJsonResponseSafe<{ transcript?: string }>(resp);
  if (!resp.ok) {
    throw new Error(data.error || 'Could not transcribe recorded speech.');
  }
  return String(data.transcript || '').trim();
}

/**
 * Starts built-in microphone dictation ONLY when explicitly triggered by the user.
 * Checks device/browser permission state first so denied permissions do not silently loop;
 * prefers Web SpeechRecognition when live and supported, and falls back cleanly
 * to getUserMedia + MediaRecorder -> /api/speech/transcribe on WebViews/browsers
 * without Web Speech Recognition. Always stops MediaStream tracks cleanly on stop.
 */
export async function startBuiltInMicDictation(
  languageCode: string,
  callbacks: MicSessionCallbacks
): Promise<ActiveMicHandle | null> {
  callbacks.onNotice(null);
  callbacks.onNoticeDetail?.(null);

  const emitClassifiedError = (err: unknown, state: DevicePermissionState = 'unknown') => {
    const info = classifyMicAccessError(err, state);
    callbacks.onStatusChange('error');
    callbacks.onNotice(info.message);
    callbacks.onNoticeDetail?.({
      text: info.message,
      isPermissionDenied: info.isPermissionDenied,
      canRetry: info.canRetry,
      guidance: info.guidance,
    });
  };

  const permState = await queryDevicePermissionState('microphone');
  if (permState === 'denied') {
    emitClassifiedError(null, 'denied');
    return null;
  }

  const SpeechRec =
    typeof window !== 'undefined'
      ? (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
          .webkitSpeechRecognition
      : undefined;

  let disposed = false;
  let rec: SpeechRecognitionLike | null = null;
  let mediaRecorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: Blob[] = [];
  let speechDeliveredResult = false;
  let fallbackStarted = false;
  let transitioningToFallback = false;
  let terminalErrorEmitted = false;

  const releaseMediaStream = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore track cleanup failures
        }
      });
      mediaStream = null;
    }
  };

  const startMediaRecorderMode = async (): Promise<boolean> => {
    if (disposed || fallbackStarted) return false;
    fallbackStarted = true;
    transitioningToFallback = true;

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      transitioningToFallback = false;
      terminalErrorEmitted = true;
      emitClassifiedError(new Error('unsupported'));
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposed) {
        transitioningToFallback = false;
        stream.getTracks().forEach((t) => t.stop());
        return false;
      }
      mediaStream = stream;
      chunks = [];
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : '';
      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunks.push(ev.data);
        }
      };

      recorder.onerror = () => {
        releaseMediaStream();
        mediaRecorder = null;
        transitioningToFallback = false;
        terminalErrorEmitted = true;
        emitClassifiedError(new DOMException('Microphone recording failed', 'NotReadableError'));
      };

      recorder.onstop = () => {
        releaseMediaStream();
        mediaRecorder = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        chunks = [];
        if (blob.size < 250) {
          callbacks.onStatusChange('stopped');
          const msg = 'No clear speech was detected. Tap the mic and speak closer to your device.';
          callbacks.onNotice(msg);
          callbacks.onNoticeDetail?.({
            text: msg,
            isPermissionDenied: false,
            canRetry: true,
            guidance: null,
          });
          return;
        }
        callbacks.onStatusChange('transcribing');
        void transcribeAudioBlob(blob, languageCode)
          .then((transcript) => {
            if (transcript) {
              callbacks.onTranscript(transcript);
              callbacks.onStatusChange('stopped');
            } else {
              callbacks.onStatusChange('stopped');
              const msg = 'No spoken words heard. Tap Retry or type directly below.';
              callbacks.onNotice(msg);
              callbacks.onNoticeDetail?.({
                text: msg,
                isPermissionDenied: false,
                canRetry: true,
                guidance: null,
              });
            }
          })
          .catch((err) => {
            callbacks.onStatusChange('error');
            const errText = formatConnectionError(err, 'Could not transcribe recorded audio.');
            callbacks.onNotice(errText);
            callbacks.onNoticeDetail?.({
              text: errText,
              isPermissionDenied: false,
              canRetry: true,
              guidance: null,
            });
          });
      };

      mediaRecorder = recorder;
      transitioningToFallback = false;
      recorder.start();
      callbacks.onStatusChange('listening');
      return true;
    } catch (err) {
      transitioningToFallback = false;
      terminalErrorEmitted = true;
      releaseMediaStream();
      const postState = await queryDevicePermissionState('microphone');
      emitClassifiedError(err, postState);
      return false;
    }
  };

  if (SpeechRec) {
    try {
      const instance = new SpeechRec();
      rec = instance;
      instance.lang = languageCode || 'en-US';
      instance.continuous = true;
      instance.interimResults = true;

      instance.onresult = (event) => {
        if (disposed) return;
        speechDeliveredResult = true;
        const finals: string[] = [];
        const interims: string[] = [];
        for (let i = 0; i < event.results.length; i += 1) {
          const item = event.results[i];
          const piece = item?.[0]?.transcript?.trim();
          if (!piece) continue;
          if (item.isFinal) {
            if (finals[finals.length - 1] !== piece) finals.push(piece);
          } else {
            interims.push(piece);
          }
        }
        const spoken = [...finals, ...interims].join(' ').replace(/\s+/g, ' ').trim();
        callbacks.onTranscript(spoken);
      };

      instance.onerror = (ev) => {
        if (disposed) return;
        const code = ev?.error || '';
        if (code === 'not-allowed') {
          terminalErrorEmitted = true;
          void queryDevicePermissionState('microphone').then((postState) => {
            if (!disposed) {
              emitClassifiedError(new DOMException(code, 'NotAllowedError'), postState);
            }
          });
          return;
        }
        if (code === 'service-not-allowed') {
          if (!speechDeliveredResult) {
            // Some WebViews block remote Google Speech service but allow local MediaRecorder
            transitioningToFallback = true;
            void startMediaRecorderMode();
            return;
          }
          terminalErrorEmitted = true;
          emitClassifiedError(new DOMException(code, 'NotAllowedError'), permState);
          return;
        }
        if (
          (code === 'audio-capture' || code === 'network' || code === 'language-not-supported') &&
          !speechDeliveredResult
        ) {
          transitioningToFallback = true;
          void startMediaRecorderMode();
          return;
        }
        if (code === 'no-speech') {
          terminalErrorEmitted = true;
          callbacks.onStatusChange('stopped');
          const msg = 'No speech detected. Tap Retry or the mic to speak again.';
          callbacks.onNotice(msg);
          callbacks.onNoticeDetail?.({
            text: msg,
            isPermissionDenied: false,
            canRetry: true,
            guidance: null,
          });
        } else if (code && code !== 'aborted') {
          terminalErrorEmitted = true;
          callbacks.onStatusChange('stopped');
          callbacks.onNotice('Microphone stopped. Review your text or tap the mic to continue.');
          callbacks.onNoticeDetail?.({
            text: 'Microphone stopped. Review your text or tap Retry Mic to continue.',
            isPermissionDenied: false,
            canRetry: true,
            guidance: null,
          });
        }
      };

      instance.onend = () => {
        if (!disposed && !mediaRecorder && !transitioningToFallback && !terminalErrorEmitted) {
          callbacks.onStatusChange('stopped');
        }
      };

      callbacks.onStatusChange('listening');
      instance.start();

      return {
        stop: () => {
          disposed = true;
          try {
            rec?.stop();
          } catch {
            // ignore
          }
          if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            try {
              mediaRecorder.stop();
            } catch {
              releaseMediaStream();
            }
          } else {
            releaseMediaStream();
          }
          callbacks.onStatusChange('stopped');
        },
      };
    } catch {
      // Fall back to MediaRecorder audio capture if SpeechRec fails synchronously
    }
  }

  const started = await startMediaRecorderMode();
  if (!started) return null;

  return {
    stop: () => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        try {
          mediaRecorder.stop();
        } catch {
          disposed = true;
          releaseMediaStream();
          callbacks.onStatusChange('stopped');
        }
      } else {
        disposed = true;
        releaseMediaStream();
        callbacks.onStatusChange('stopped');
      }
    },
  };
}

