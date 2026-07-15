import type { AlarmToneId } from './types';

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function beep(frequency: number, durationMs: number, gainValue = 0.15): void {
  const ac = getCtx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.value = gainValue;
  osc.connect(gain);
  gain.connect(ac.destination);
  const now = ac.currentTime;
  osc.start(now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
  osc.stop(now + durationMs / 1000);
}

function playPattern(toneId: AlarmToneId): void {
  if (toneId === 'chime') {
    beep(880, 180);
    setTimeout(() => beep(1174, 220), 200);
  } else if (toneId === 'bell') {
    beep(660, 400, 0.2);
  } else {
    beep(440, 120);
    setTimeout(() => beep(550, 120), 140);
    setTimeout(() => beep(660, 180), 280);
  }
}

export async function startAlarmTone(toneId: AlarmToneId): Promise<void> {
  stopAlarmTone();
  const ac = getCtx();
  if (ac.state === 'suspended') {
    try {
      await ac.resume();
    } catch {
      return;
    }
  }
  playPattern(toneId);
  timer = setInterval(() => playPattern(toneId), 1200);
}

export function stopAlarmTone(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
