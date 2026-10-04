import { INPUT_SAMPLE_RATE, type AffectSample, type IntegrityEvent } from '@skillx/shared'

const FRAME = 512 // 32 ms at 16 kHz
const WINDOW_MS = 3000
const MIN_F0 = 70
const MAX_F0 = 400
const VOICED_RMS = 0.015

/** Autocorrelation pitch estimate for one frame; 0 when unvoiced. */
export function estimatePitch(frame: Float32Array, sampleRate = INPUT_SAMPLE_RATE): number {
  const minLag = Math.floor(sampleRate / MAX_F0)
  const maxLag = Math.min(frame.length - 1, Math.ceil(sampleRate / MIN_F0))
  let energy = 0
  for (const s of frame) energy += s * s
  if (energy === 0) return 0

  let bestLag = 0
  let best = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0
    for (let i = 0; i + lag < frame.length; i++) corr += frame[i] * frame[i + lag]
    const norm = corr / energy
    if (norm > best) {
      best = norm
      bestLag = lag
    }
  }
  return best > 0.45 && bestLag ? sampleRate / bestLag : 0
}

function rms(frame: Float32Array): number {
  let sum = 0
  for (const s of frame) sum += s * s
  return Math.sqrt(sum / frame.length)
}

interface FrameStat {
  rms: number
  f0: number
}

/**
 * Turns the 16 kHz mic stream into AffectSamples every few seconds (speech
 * rate, pitch, energy), plus a coarse voice-consistency check: a sustained
 * shift in pitch and timbre away from the candidate's baseline is reported as a
 * possible different speaker. This is a lightweight heuristic, not biometrics.
 */
export class AffectAnalyzer {
  private pending = new Float32Array(0)
  private frames: FrameStat[] = []
  private windowStart = performance.now()
  private baselinePitches: number[] = []
  private baseline = 0
  private driftStreak = 0

  private readonly onSample: (s: AffectSample) => void
  private readonly onIntegrity: (e: IntegrityEvent) => void

  constructor(onSample: (s: AffectSample) => void, onIntegrity: (e: IntegrityEvent) => void) {
    this.onSample = onSample
    this.onIntegrity = onIntegrity
  }

  push(chunk: Float32Array): void {
    const merged = new Float32Array(this.pending.length + chunk.length)
    merged.set(this.pending)
    merged.set(chunk, this.pending.length)
    let offset = 0
    for (; offset + FRAME <= merged.length; offset += FRAME) {
      const frame = merged.subarray(offset, offset + FRAME)
      const r = rms(frame)
      this.frames.push({ rms: r, f0: r > VOICED_RMS ? estimatePitch(frame) : 0 })
    }
    this.pending = merged.slice(offset)

    if (performance.now() - this.windowStart >= WINDOW_MS) this.flushWindow()
  }

  private flushWindow(): void {
    const frames = this.frames
    this.frames = []
    this.windowStart = performance.now()
    if (frames.length < 10) return

    const voiced = frames.filter((f) => f.f0 > 0)
    const voicedRatio = voiced.length / frames.length
    if (voicedRatio < 0.15) return

    const pitches = voiced.map((f) => f.f0)
    const pitchMean = pitches.reduce((a, b) => a + b, 0) / pitches.length
    const pitchStd = Math.sqrt(pitches.reduce((a, p) => a + (p - pitchMean) ** 2, 0) / pitches.length)
    const energy = frames.reduce((a, f) => a + f.rms, 0) / frames.length

    // Syllable nuclei ~ local peaks in the energy envelope during voiced speech.
    let peaks = 0
    for (let i = 1; i < frames.length - 1; i++) {
      const f = frames[i]
      if (f.f0 > 0 && f.rms > frames[i - 1].rms && f.rms >= frames[i + 1].rms && f.rms > energy * 1.1) peaks++
    }
    const voicedSeconds = (voiced.length * FRAME) / INPUT_SAMPLE_RATE
    const speechRate = voicedSeconds > 0 ? peaks / voicedSeconds : 0

    this.onSample({
      at: new Date().toISOString(),
      speechRate: Number(speechRate.toFixed(2)),
      pitchMean: Math.round(pitchMean),
      pitchStd: Math.round(pitchStd),
      energy: Number(energy.toFixed(4)),
      voicedRatio: Number(voicedRatio.toFixed(2)),
    })
    this.checkVoice(pitchMean, voicedRatio)
  }

  private checkVoice(pitchMean: number, voicedRatio: number): void {
    if (voicedRatio < 0.3) return
    if (this.baselinePitches.length < 5) {
      this.baselinePitches.push(pitchMean)
      if (this.baselinePitches.length === 5) {
        const sorted = [...this.baselinePitches].sort((a, b) => a - b)
        this.baseline = sorted[2]
      }
      return
    }
    const drift = Math.abs(pitchMean - this.baseline) / this.baseline
    this.driftStreak = drift > 0.35 ? this.driftStreak + 1 : 0
    if (this.driftStreak === 3) {
      this.onIntegrity({
        type: 'voice_change',
        at: new Date().toISOString(),
        confidence: Math.min(1, 0.5 + drift),
        detail: `Pitch moved from ~${Math.round(this.baseline)} Hz to ~${Math.round(pitchMean)} Hz for ~9 s`,
      })
    }
  }
}
