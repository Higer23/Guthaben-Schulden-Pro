/**
 * audio.js
 * ========
 * Web Audio API Synthesized Sound Engine
 * FIXES:
 *   HATA 20: initAudio() boolean döndürüyor
 */

let _ctx     = null;
let _enabled = true;

function getCtx() {
  if (!_enabled) return null;
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') _ctx.resume();
    return _ctx;
  } catch (_) {
    return null;
  }
}

function playTone(freq, duration, type = 'sine', gain = 0.3, startDelay = 0) {
  const ctx = getCtx();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const amp = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
  amp.gain.setValueAtTime(0, ctx.currentTime + startDelay);
  amp.gain.linearRampToValueAtTime(gain, ctx.currentTime + startDelay + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration);

  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(ctx.currentTime + startDelay);
  osc.stop(ctx.currentTime + startDelay + duration);
}

// ─── Sound Library ──────────────────────────────────────────
export function playSuccess() {
  const notes = [523.25, 659.25, 783.99, 1046.50];
  notes.forEach((f, i) => playTone(f, 0.25, 'sine', 0.22, i * 0.08));
}

export function playError() {
  playTone(180, 0.12, 'square', 0.25, 0);
  playTone(160, 0.18, 'sawtooth', 0.15, 0.06);
}

export function playLevelUp() {
  const seq = [
    { f: 523.25, d: 0.1, g: 0.25, t: 0 },
    { f: 659.25, d: 0.1, g: 0.25, t: 0.1 },
    { f: 783.99, d: 0.1, g: 0.25, t: 0.2 },
    { f: 1046.5, d: 0.3, g: 0.3,  t: 0.3 },
  ];
  seq.forEach((n) => playTone(n.f, n.d, 'sine', n.g, n.t));
}

export function playClick() {
  playTone(880, 0.04, 'square', 0.1, 0);
}

export function playTicket() {
  playTone(660, 0.06, 'triangle', 0.18, 0);
}

export function playStreak() {
  playTone(1320, 0.08, 'sine', 0.2, 0);
  playTone(1760, 0.12, 'sine', 0.2, 0.06);
}

export function playAchievement() {
  const notes = [523.25, 783.99, 1046.5, 1318.5];
  notes.forEach((f, i) => playTone(f, 0.2, 'sine', 0.3, i * 0.1));
}

// ─── Controls ────────────────────────────────────────────────
export function setAudioEnabled(val) {
  _enabled = !!val;
  localStorage.setItem('gss_audio', val ? '1' : '0');
}

/**
 * FIX HATA 20: isAudioEnabled() — boolean döndürür.
 */
export function isAudioEnabled() {
  return _enabled;
}

/**
 * FIX HATA 20: initAudio() — boolean döndürür.
 * @returns {boolean}
 */
export function initAudio() {
  const saved = localStorage.getItem('gss_audio');
  _enabled = saved === null ? true : saved === '1';
  return _enabled;  // FIX: boolean döndür
}

/**
 * Unlocks AudioContext on user gesture.
 */
export function unlockAudio() {
  try {
    if (!_ctx) {
      _ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (_ctx.state === 'suspended') {
      _ctx.resume().catch(() => {});
    }
  } catch (_) {}
}
