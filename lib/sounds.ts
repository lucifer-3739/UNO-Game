/**
 * Sound system using Web Audio API — no external files required.
 * All sounds are synthesized programmatically.
 */

let _ctx: AudioContext | null = null;
let _enabled = true;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_enabled) return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    } catch {
      return null;
    }
  }
  // Resume if suspended (browser autoplay policy)
  if (_ctx.state === "suspended") {
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

function gain(c: AudioContext, value: number, time?: number): GainNode {
  const g = c.createGain();
  g.gain.setValueAtTime(value, time ?? c.currentTime);
  return g;
}

export function setMuted(muted: boolean) {
  _enabled = !muted;
}

/* ── Card play — short click whoosh ────────────────── */
export function playCardPlay(color?: string | null) {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  // Base freq by color
  const freqMap: Record<string, number> = {
    red: 420, blue: 520, green: 580, yellow: 660,
  };
  const freq = (color && freqMap[color]) ? freqMap[color] : 460;

  // Click transient (noise burst)
  const buf = c.createBuffer(1, c.sampleRate * 0.05, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const noise = c.createBufferSource();
  noise.buffer = buf;
  const noiseGain = gain(c, 0.18, t);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
  noise.connect(noiseGain);
  noiseGain.connect(c.destination);
  noise.start(t);

  // Tone sweep
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.45, t + 0.18);
  const g2 = gain(c, 0.22, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(g2);
  g2.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/* ── Card draw — soft flip ──────────────────────────── */
export function playCardDraw() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  const buf = c.createBuffer(1, c.sampleRate * 0.06, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const env = Math.sin((i / data.length) * Math.PI);
    data[i] = (Math.random() * 2 - 1) * env * 0.7;
  }
  const src = c.createBufferSource();
  src.buffer = buf;

  // High-pass filter for papery sound
  const hp = c.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 2000;

  const g2 = gain(c, 0.25, t);
  src.connect(hp);
  hp.connect(g2);
  g2.connect(c.destination);
  src.start(t);
}

/* ── UNO call — rising arpeggio ─────────────────────── */
export function playUnoCall() {
  const c = ctx();
  if (!c) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.09;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const g2 = gain(c, 0, t);
    g2.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.25);
  });
}

/* ── Win fanfare ─────────────────────────────────────── */
export function playWin() {
  const c = ctx();
  if (!c) return;
  const melody = [523, 659, 784, 659, 784, 1047];
  const durations = [0.12, 0.12, 0.12, 0.08, 0.12, 0.35];
  let time = c.currentTime;
  melody.forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    const g2 = gain(c, 0, time);
    g2.gain.linearRampToValueAtTime(0.35, time + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(time);
    osc.stop(time + durations[i] + 0.05);
    time += durations[i] * 0.95;
  });
}

/* ── Lose sound ─────────────────────────────────────── */
export function playLose() {
  const c = ctx();
  if (!c) return;
  const notes = [392, 330, 294, 247];
  notes.forEach((freq, i) => {
    const t = c.currentTime + i * 0.12;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const g2 = gain(c, 0, t);
    g2.gain.linearRampToValueAtTime(0.28, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.28);
  });
}

/* ── Error / invalid play ───────────────────────────── */
export function playError() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(180, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
  const g2 = gain(c, 0.25, t);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(g2);
  g2.connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.2);
}

/* ── Wild card — magical shimmer ────────────────────── */
export function playWild() {
  const c = ctx();
  if (!c) return;
  [1047, 1319, 1568, 2093, 2637].forEach((freq, i) => {
    const t = c.currentTime + i * 0.06;
    const osc = c.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t);
    const g2 = gain(c, 0, t);
    g2.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

/* ── Challenge — dramatic impact ────────────────────── */
export function playChallenge() {
  const c = ctx();
  if (!c) return;
  const t = c.currentTime;

  // Low thud
  const low = c.createOscillator();
  low.type = "sine";
  low.frequency.setValueAtTime(80, t);
  low.frequency.exponentialRampToValueAtTime(40, t + 0.3);
  const gLow = gain(c, 0.5, t);
  gLow.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  low.connect(gLow);
  gLow.connect(c.destination);
  low.start(t);
  low.stop(t + 0.4);

  // High sparkle
  [2093, 3136].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t + i * 0.05);
    const g2 = gain(c, 0.15, t + i * 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2 + i * 0.05);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(t + i * 0.05);
    osc.stop(t + 0.25 + i * 0.05);
  });
}

/* ── Penalty / draw cards ───────────────────────────── */
export function playPenalty() {
  const c = ctx();
  if (!c) return;
  [330, 294, 247].forEach((freq, i) => {
    const t = c.currentTime + i * 0.1;
    const osc = c.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, t);
    const g2 = gain(c, 0.22, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.22);
  });
}

/* ── Shuffle sound ──────────────────────────────────── */
export function playShuffle() {
  const c = ctx();
  if (!c) return;
  for (let i = 0; i < 5; i++) {
    const t = c.currentTime + i * 0.07;
    const buf = c.createBuffer(1, c.sampleRate * 0.04, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let j = 0; j < data.length; j++) {
      data[j] = (Math.random() * 2 - 1) * (1 - j / data.length) * 0.6;
    }
    const src = c.createBufferSource();
    src.buffer = buf;
    const hp = c.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 1500;
    const g2 = gain(c, 0.2, t);
    src.connect(hp);
    hp.connect(g2);
    g2.connect(c.destination);
    src.start(t);
  }
}
