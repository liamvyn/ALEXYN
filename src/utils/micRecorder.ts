import { apiUrl, formatConnectionError, isFileProtocolWithoutServer, parseJsonResponseSafe } from './apiBase';

export type MicCaptureStatus =
  | 'idle'
  | 'listening'
  | 'transcribing'
  | 'stopped'
  | 'error';

export interface MicSessionCallbacks {
  onStatusChange: (status: MicCaptureStatus) => void;
  onTranscript: (spokenText: string) => void;
  onNotice: (message: string | null) => void;
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

export function describeMicPermissionError(err: unknown): string {
  const name = err instanceof DOMException || err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  const low = `${name} ${msg}`.toLowerCase();

  if (low.includes('notallowed') || low.includes('permission') || low.includes('denied')) {
    return 'Microphone permission was denied. Allow microphone access in your browser/app permissions or type directly.';
  }
  if (low.includes('notfound') || low.includes('devicesnotfound') || low.includes('no audio')) {
    return 'No working microphone was detected on this device.';
  }
  if (low.includes('notreadable') || low.includes('trackstart') || low.includes('in use')) {
    return 'Microphone is currently busy in another app. Close the other recorder and try again.';
  }
  if (low.includes('security') || low.includes('insecure') || low.includes('only secure origins')) {
    return 'Microphone capture requires HTTPS, localhost, or app mic permission in this WebView.';
  }
  return 'Could not access the built-in microphone in this browser. Type your message directly or check app permissions.';
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
 * Prefers Web SpeechRecognition when live and supported, and falls back seamlessly
 * to getUserMedia + MediaRecorder -> /api/speech/transcribe on WebViews/browsers
 * without Web Speech Recognition. Always stops MediaStream tracks cleanly on stop.
 */
export async function startBuiltInMicDictation(
  languageCode: string,
  callbacks: MicSessionCallbacks
): Promise<ActiveMicHandle | null> {
  callbacks.onNotice(null);

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

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      callbacks.onStatusChange('error');
      callbacks.onNotice(
        'Voice input is unavailable in this browser or WebView. Type your message directly below.'
      );
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (disposed) {
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

      recorder.onstop = () => {
        releaseMediaStream();
        mediaRecorder = null;
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        chunks = [];
        if (blob.size < 250) {
          callbacks.onStatusChange('stopped');
          callbacks.onNotice('No speech detected. Hold or tap the mic and speak clearly.');
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
              callbacks.onNotice('No spoken words heard. Try again or type directly below.');
            }
          })
          .catch((err) => {
            callbacks.onStatusChange('error');
            callbacks.onNotice(formatConnectionError(err, 'Could not transcribe audio.'));
          });
      };

      mediaRecorder = recorder;
      recorder.start();
      callbacks.onStatusChange('listening');
      return true;
    } catch (err) {
      releaseMediaStream();
      callbacks.onStatusChange('error');
      callbacks.onNotice(describeMicPermissionError(err));
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
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          if (code === 'service-not-allowed' && !speechDeliveredResult) {
            // Some WebViews reject Google Speech service but allow MediaRecorder audio capture
            void startMediaRecorderMode();
            return;
          }
          callbacks.onStatusChange('error');
          callbacks.onNotice(
            'Microphone permission was denied. Allow microphone access or type directly.'
          );
          return;
        }
        if (
          (code === 'audio-capture' || code === 'network' || code === 'language-not-supported') &&
          !speechDeliveredResult
        ) {
          void startMediaRecorderMode();
          return;
        }
        if (code === 'no-speech') {
          callbacks.onStatusChange('stopped');
          callbacks.onNotice('No speech detected. Tap the mic to try again or edit below.');
        } else if (code && code !== 'aborted') {
          callbacks.onStatusChange('stopped');
          callbacks.onNotice('Microphone stopped. Review or edit your text below.');
        }
      };

      instance.onend = () => {
        if (!disposed && !mediaRecorder) {
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
