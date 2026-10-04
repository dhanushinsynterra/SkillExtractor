import type { AffectSample } from '@skillx/shared';

export interface NervousnessOptions {
  /** Samples used to establish the candidate's personal baseline. */
  baselineSamples: number;
  /** Composite z-score above which a sample reads as nervous. */
  threshold: number;
  /** Consecutive nervous samples required before acting. */
  sustain: number;
  /** Minimum gap between reassurances. */
  cooldownMs: number;
}

export const DEFAULT_NERVOUSNESS_OPTIONS: NervousnessOptions = {
  baselineSamples: 4,
  threshold: 1.6,
  sustain: 2,
  cooldownMs: 90_000,
};

interface Stats {
  mean: number;
  std: number;
}

export interface NervousnessState {
  score: number;
  nervous: boolean;
  /** True when the AI should offer reassurance now. */
  shouldReassure: boolean;
}

/**
 * Detects nervousness from acoustic changes relative to the candidate's own
 * baseline: faster speech, raised pitch, unstable pitch and long silences
 * (low voiced ratio) all push the composite score up.
 */
export class NervousnessDetector {
  private readonly options: NervousnessOptions;
  private samples: AffectSample[] = [];
  private baseline?: Record<'speechRate' | 'pitchMean' | 'pitchStd' | 'voicedRatio', Stats>;
  private streak = 0;
  private lastReassuranceAt = -Infinity;
  episodes = 0;
  reassurances = 0;

  constructor(options: Partial<NervousnessOptions> = {}) {
    this.options = { ...DEFAULT_NERVOUSNESS_OPTIONS, ...options };
  }

  push(sample: AffectSample, now = Date.now()): NervousnessState {
    // Ignore windows that are mostly silence or obviously broken readings.
    if (sample.voicedRatio < 0.15 || !Number.isFinite(sample.pitchMean) || sample.pitchMean <= 0) {
      return { score: 0, nervous: false, shouldReassure: false };
    }
    this.samples.push(sample);
    if (this.samples.length > 200) this.samples.shift();

    if (!this.baseline) {
      if (this.samples.length >= this.options.baselineSamples) this.baseline = this.computeBaseline();
      return { score: 0, nervous: false, shouldReassure: false };
    }

    const b = this.baseline;
    const z = (v: number, s: Stats) => (v - s.mean) / Math.max(s.std, s.mean * 0.08, 1e-3);
    const score =
      0.35 * Math.max(0, z(sample.speechRate, b.speechRate)) +
      0.3 * Math.max(0, z(sample.pitchMean, b.pitchMean)) +
      0.2 * Math.max(0, z(sample.pitchStd, b.pitchStd)) +
      0.15 * Math.max(0, -z(sample.voicedRatio, b.voicedRatio));

    const nervous = score >= this.options.threshold;
    if (nervous) {
      this.streak += 1;
      if (this.streak === this.options.sustain) this.episodes += 1;
    } else {
      this.streak = 0;
    }

    const shouldReassure =
      nervous && this.streak >= this.options.sustain && now - this.lastReassuranceAt >= this.options.cooldownMs;
    if (shouldReassure) {
      this.lastReassuranceAt = now;
      this.reassurances += 1;
    }
    return { score: Number(score.toFixed(2)), nervous, shouldReassure };
  }

  private computeBaseline() {
    const stats = (key: keyof AffectSample): Stats => {
      const values = this.samples.map((s) => s[key] as number);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
      return { mean, std: Math.sqrt(variance) };
    };
    return {
      speechRate: stats('speechRate'),
      pitchMean: stats('pitchMean'),
      pitchStd: stats('pitchStd'),
      voicedRatio: stats('voicedRatio'),
    };
  }
}
