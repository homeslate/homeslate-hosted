/** Minimal typings for the Web Speech API (not always in lib.dom). */
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly 0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  readonly error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export type SpeechUnavailableReason = 'unsupported' | 'denied' | 'error';

export interface SpeechRecognitionSessionHandlers {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (reason: SpeechUnavailableReason) => void;
  onEnd: () => void;
}

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getSpeechRecognitionConstructor() !== null;
}

export class SpeechRecognitionSession {
  private recognition: SpeechRecognitionLike | null = null;
  private wanted = false;

  start(handlers: SpeechRecognitionSessionHandlers): boolean {
    const Ctor = getSpeechRecognitionConstructor();
    if (!Ctor) {
      handlers.onError('unsupported');
      return false;
    }

    this.stop();
    this.wanted = true;

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (!result) return;
      const transcript = result[0]?.transcript ?? '';
      if (!transcript.trim()) return;
      handlers.onResult(transcript, result.isFinal);
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.wanted = false;
        handlers.onError('denied');
        return;
      }
      if (event.error === 'audio-capture') {
        this.wanted = false;
        handlers.onError('error');
        return;
      }
      // aborted, no-speech, network, etc. — onend restarts while still wanted
    };

    recognition.onend = () => {
      handlers.onEnd();
      if (this.wanted && this.recognition === recognition) {
        try {
          recognition.start();
        } catch {
          // Already started or unavailable — leave stopped
        }
      }
    };

    this.recognition = recognition;
    try {
      recognition.start();
      return true;
    } catch {
      this.wanted = false;
      this.recognition = null;
      handlers.onError('error');
      return false;
    }
  }

  stop(): void {
    this.wanted = false;
    const recognition = this.recognition;
    this.recognition = null;
    if (!recognition) return;
    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    try {
      recognition.abort();
    } catch {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    }
  }
}
