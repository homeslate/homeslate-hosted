import type { AlarmToneId } from './types';

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let timeouts: ReturnType<typeof setTimeout>[] = [];
let sessionId = 0;

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

function scheduleBeep(session: number, delayMs: number, frequency: number, durationMs: number, gainValue?: number): void {
  const handle = setTimeout(() => {
    if (session !== sessionId) return;
    beep(frequency, durationMs, gainValue);
  }, delayMs);
  timeouts.push(handle);
}

function playPattern(toneId: AlarmToneId, session: number): void {
  if (session !== sessionId) return;

  if (toneId === 'chime') {
    beep(880, 180);
    scheduleBeep(session, 200, 1174, 220);
  } else if (toneId === 'bell') {
    beep(660, 400, 0.2);
  } else {
    beep(440, 120);
    scheduleBeep(session, 140, 550, 120);
    scheduleBeep(session, 280, 660, 180);
  }
}

export async function startAlarmTone(toneId: AlarmToneId): Promise<void> {
  stopAlarmTone();
  const session = sessionId;

  const ac = getCtx();
  if (ac.state === 'suspended') {
    try {
      await ac.resume();
    } catch {
      return;
    }
  }

  if (session !== sessionId) return;

  playPattern(toneId, session);
  timer = setInterval(() => playPattern(toneId, session), 1200);
}

export function stopAlarmTone(): void {
  sessionId += 1;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  for (const handle of timeouts) {
    clearTimeout(handle);
  }
  timeouts = [];
}
