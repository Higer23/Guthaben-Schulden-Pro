/**
 * audio.js
 * ========
 * Audio-Engine mit Web Audio API (keine externen Dateien nötig)
 */

let _audioCtx   = null;
let _enabled    = true;
let _masterGain = null;
const AUDIO_KEY  = 'gss_audio_v2';

// ─── Initialisierung ─────────────────────────────────────────────────────────
export function initAudio() {
  const saved = localStorage.getItem(AUDIO_KEY);
  _enabled    = saved !== 'false';

  try {
    _audioCtx    = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain  = _audioCtx.createGain();
    _masterGain.gain.value = 0.3;
    _masterGain.connect(_audioCtx.destination);
  } catch (_) {
    _audioCtx = null;
  }
  return _enabled;
}

export function unlockAudio() {
  if (_audioCtx?.state === 'suspended') _audioCtx.resume();
}

export function setAudioEnabled(on) {
  _enabled = on;
  try { localStorage.setItem(AUDIO_KEY, String(on)); } catch (_) {}
}

export function isAudioEnabled() { return _enabled; }

// ─── Ton erzeugen ────────────────────────────────────────────────────────────
function playTone(frequency, duration, type = 'sine', volume = 0.3, delay = 0) {
  if (!_enabled || !_audioCtx) return;
  try {
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_masterGain);
    osc.type             = type;
    osc.frequency.value  = frequency;
    gain.gain.value      = volume;
    const start = _audioCtx.currentTime + delay;
    osc.start(start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.stop(start + duration + 0.1);
  } catch (_) {}
}

// ─── Sound-Effekte ───────────────────────────────────────────────────────────
export function playSuccess() {
  playTone(523.25, 0.1, 'sine', 0.3);
  playTone(659.25, 0.1, 'sine', 0.3, 0.1);
  playTone(783.99, 0.2, 'sine', 0.3, 0.2);
}

export function playError() {
  playTone(220, 0.1, 'sawtooth', 0.2);
  playTone(196, 0.2, 'sawtooth', 0.15, 0.1);
}

export function playLevelUp() {
  const notes = [261.63, 329.63, 392, 523.25, 659.25];
  notes.forEach((freq, i) => playTone(freq, 0.15, 'sine', 0.25, i * 0.12));
}

export function playAchievement() {
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, i) => playTone(freq, 0.2, 'triangle', 0.3, i * 0.1));
}

export function playClick() {
  playTone(880, 0.05, 'sine', 0.1);
}

export function playDailyReward() {
  const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  notes.forEach((freq, i) => playTone(freq, 0.25, 'sine', 0.25, i * 0.08));
}

export function playGameOver() {
  playTone(392, 0.15, 'sawtooth', 0.2);
  playTone(349.23, 0.15, 'sawtooth', 0.2, 0.15);
  playTone(329.63, 0.3, 'sawtooth', 0.2, 0.3);
}

export function playChatMessage() {
  playTone(880, 0.05, 'sine', 0.15);
  playTone(1109.73, 0.1, 'sine', 0.12, 0.06);
}
