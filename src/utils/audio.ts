/**
 * Audio helpers for Live API streaming, Text-to-Speech playback,
 * and game show sound effects using Web Audio API.
 */

// Convert Float32 buffer from Web Audio to 16-bit PCM Base64 for Gemini Live API
export function pcmFloat32ToBase64(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const bytes = new Uint8Array(int16Array.buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert 24kHz raw PCM little-endian Base64 from Gemini Live into Float32Array
export function base64ToFloat32Pcm(base64: string): Float32Array {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 32768.0;
  }
  return float32Array;
}

// Audio Player for Gemini Live 24kHz streaming with gapless queueing
export class LiveAudioPlayer {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  public analyser: AnalyserNode | null = null;

  constructor() {
    // 24kHz matching Gemini Live output
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      this.audioCtx = new AudioCtx({ sampleRate: 24000 });
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 64;
      this.analyser.connect(this.audioCtx.destination);
    }
  }

  async resume() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
  }

  playChunk(base64Pcm: string) {
    if (!this.audioCtx || !this.analyser) return;

    this.resume();

    const float32 = base64ToFloat32Pcm(base64Pcm);
    if (float32.length === 0) return;

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.analyser);

    const currentTime = this.audioCtx.currentTime;
    if (this.nextStartTime < currentTime) {
      this.nextStartTime = currentTime + 0.03; // slight lead buffer
    }

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;

    this.activeSources.push(source);
    source.onended = () => {
      const idx = this.activeSources.indexOf(source);
      if (idx !== -1) this.activeSources.splice(idx, 1);
    };
  }

  stopAll() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  close() {
    this.stopAll();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }
}

// Built-in Synthesized Game Show Sound Effects using Web Audio API
class SoundEffectsPlayer {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playCorrect() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 arpeggio
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0, now + idx * 0.08);
        gain.gain.linearRampToValueAtTime(0.25, now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.45);
      });
    } catch {}
  }

  playWrong() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      // Dissonant low buzz
      const freqs = [155.56, 146.83]; // Eb3 & D3 clash
      freqs.forEach((freq) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.8, now + 0.35);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + 0.45);
      });
    } catch {}
  }

  playTick() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {}
  }

  playLifeline() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }

  playFanfare() {
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99],
        [587.33, 739.99, 880.0],
        [659.25, 830.61, 987.77],
        [783.99, 987.77, 1174.66],
      ];
      chords.forEach((chord, chordIdx) => {
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + chordIdx * 0.15);
          gain.gain.setValueAtTime(0.12, now + chordIdx * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, now + chordIdx * 0.15 + 0.5);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + chordIdx * 0.15);
          osc.stop(now + chordIdx * 0.15 + 0.55);
        });
      });
    } catch {}
  }
}

export const sfx = new SoundEffectsPlayer();

// Browser SpeechSynthesis fallback when Gemini TTS is rate-limited
export function speakBrowserFallback(
  text: string,
  hostVoiceStyle?: { voiceName?: string; id?: string },
  onStart?: () => void,
  onEnd?: () => void
): boolean {
  if (typeof window === 'undefined' || !window.speechSynthesis) return false;

  try {
    window.speechSynthesis.cancel();

    // Strip vocal tags like <laugh>, <gasp>, |yeah|, |mhm|
    const cleanText = text.replace(/<[^>]+>|\|[^|]+\|/g, '').trim();
    if (!cleanText) return false;

    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (hostVoiceStyle?.id === 'nova') {
      utterance.rate = 1.15;
      utterance.pitch = 1.2;
    } else if (hostVoiceStyle?.id === 'barnaby') {
      utterance.rate = 0.9;
      utterance.pitch = 0.85;
    } else if (hostVoiceStyle?.id === 'gordon') {
      utterance.rate = 1.1;
      utterance.pitch = 1.05;
    } else if (hostVoiceStyle?.id === 'bodhi') {
      utterance.rate = 0.85;
      utterance.pitch = 0.95;
    } else {
      // Sarcasmo / Default
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
    }

    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) {
      if (
        hostVoiceStyle?.id === 'sarcasmo' ||
        hostVoiceStyle?.id === 'barnaby'
      ) {
        const ukVoice = voices.find(
          (v) =>
            v.lang.includes('en-GB') ||
            v.name.toLowerCase().includes('british') ||
            v.name.toLowerCase().includes('uk')
        );
        if (ukVoice) utterance.voice = ukVoice;
      } else if (hostVoiceStyle?.id === 'nova') {
        const femaleVoice = voices.find(
          (v) =>
            v.name.toLowerCase().includes('samantha') ||
            v.name.toLowerCase().includes('zira') ||
            v.name.toLowerCase().includes('female')
        );
        if (femaleVoice) utterance.voice = femaleVoice;
      }
    }

    if (onStart) utterance.onstart = onStart;
    if (onEnd) {
      utterance.onend = onEnd;
      utterance.onerror = onEnd;
    }

    window.speechSynthesis.speak(utterance);
    return true;
  } catch (err) {
    console.warn('SpeechSynthesis error:', err);
    if (onEnd) onEnd();
    return false;
  }
}

export function stopBrowserFallback() {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
}
