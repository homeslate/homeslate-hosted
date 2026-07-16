import { useEffect, useRef, useState } from 'react';
import type { SnoozeMinutes } from '../alarms/types';
import { parseAlarmVoiceCommand } from './parseAlarmVoiceCommand';
import {
  SpeechRecognitionSession,
  isSpeechRecognitionSupported,
  type SpeechUnavailableReason,
} from './speechRecognition';

export type VoiceStatusReason = SpeechUnavailableReason | 'disabled';

export interface UseAlarmVoiceCommandsResult {
  listening: boolean;
  unavailableReason: VoiceStatusReason | null;
}

interface Options {
  active: boolean;
  enabled: boolean;
  onDismiss: () => void;
  onSnooze: (minutes: SnoozeMinutes) => void;
}

export function useAlarmVoiceCommands({
  active,
  enabled,
  onDismiss,
  onSnooze,
}: Options): UseAlarmVoiceCommandsResult {
  const [listening, setListening] = useState(false);
  const [unavailableReason, setUnavailableReason] = useState<VoiceStatusReason | null>(null);
  const handledRef = useRef(false);

  useEffect(() => {
    handledRef.current = false;

    if (!enabled) {
      setListening(false);
      setUnavailableReason(active ? 'disabled' : null);
      return;
    }

    if (!active) {
      setListening(false);
      setUnavailableReason(null);
      return;
    }

    if (!isSpeechRecognitionSupported()) {
      setListening(false);
      setUnavailableReason('unsupported');
      return;
    }

    const session = new SpeechRecognitionSession();
    setUnavailableReason(null);

    const started = session.start({
      onResult: (transcript) => {
        if (handledRef.current) return;
        const command = parseAlarmVoiceCommand(transcript);
        if (!command) return;
        handledRef.current = true;
        session.stop();
        setListening(false);
        if (command.type === 'dismiss') {
          onDismiss();
        } else {
          onSnooze(command.minutes);
        }
      },
      onError: (reason) => {
        setListening(false);
        setUnavailableReason(reason);
      },
      onEnd: () => {
        if (handledRef.current) {
          setListening(false);
        }
      },
    });

    setListening(started);

    return () => {
      session.stop();
      setListening(false);
    };
  }, [active, enabled, onDismiss, onSnooze]);

  return { listening, unavailableReason };
}
