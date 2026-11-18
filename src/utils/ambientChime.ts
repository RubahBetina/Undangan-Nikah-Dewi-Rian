// Supports both custom uploaded/URL wedding music (MP3/M4A/OGG/WAV)
// and procedural Web Audio celesta/harp fallback when no custom track is set.
class AmbientWeddingMusic {
  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private trackUrl = '';
  private isPlaying = false;
  private step = 0;

  // Dreamy Fmaj9 -> Dm9 -> Bbmaj7 -> Csus4 pastel arpeggio frequencies
  private readonly notes = [
    349.23, 440.0, 523.25, 659.25, 783.99, 659.25, 523.25, 440.0,
    293.66, 349.23, 440.0, 523.25, 659.25, 523.25, 440.0, 349.23,
    233.08, 293.66, 349.23, 440.0, 587.33, 440.0, 349.23, 293.66,
    261.63, 349.23, 392.0, 523.25, 587.33, 523.25, 392.0, 349.23,
  ];

  setTrack(url: string): void {
    const clean = (url || '').trim();
    if (clean === this.trackUrl) return;
    const wasPlaying = this.isPlaying;
    if (wasPlaying) {
      this.stop();
    }
    this.trackUrl = clean;
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
    if (wasPlaying) {
      this.start(clean);
    }
  }

  private startProceduralLoop(): void {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    const playNote = () => {
      if (!this.isPlaying || !this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = this.notes[this.step % this.notes.length];
      this.step += 1;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.032, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 2.0);
    };

    playNote();
    this.timerId = window.setInterval(playNote, 680);
  }

  start(customUrl?: string): void {
    if (typeof customUrl === 'string') {
      const clean = customUrl.trim();
      if (clean !== this.trackUrl) {
        this.trackUrl = clean;
        if (this.audioEl) {
          this.audioEl.pause();
          this.audioEl = null;
        }
      }
    }

    if (this.isPlaying) return;
    this.isPlaying = true;

    if (this.trackUrl) {
      if (!this.audioEl) {
        const audio = new Audio(this.trackUrl);
        audio.loop = true;
        audio.volume = 0.65;
        audio.crossOrigin = 'anonymous';
        this.audioEl = audio;
      }
      this.audioEl.play().catch(() => {
        // Fallback smoothly to procedural melody if browser/URL playback fails
        if (this.isPlaying && this.timerId === null) {
          this.startProceduralLoop();
        }
      });
      return;
    }

    this.startProceduralLoop();
  }

  stop(): void {
    this.isPlaying = false;
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  toggle(customUrl?: string): boolean {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    this.start(customUrl);
    return true;
  }

  getPlaying(): boolean {
    return this.isPlaying;
  }
}

export const ambientMusic = new AmbientWeddingMusic();
