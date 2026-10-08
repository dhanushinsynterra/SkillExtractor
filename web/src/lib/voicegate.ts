/**
 * Decides, chunk by chunk, which microphone audio reaches the interviewer.
 *
 * - Background voices and noise: audio well below the candidate's calibrated
 *   speaking level is replaced with silence (a short hangover keeps word
 *   endings and natural pauses intact).
 * - The interviewer's own voice: while it plays on speakers, part of it leaks
 *   into the mic. The gate learns that leak level and only lets through audio
 *   clearly louder than it, which is the candidate talking over the interviewer.
 */

/** Default gate level when the candidate skipped calibration (about -38 dBFS). */
export const DEFAULT_THRESHOLD = 0.012;

const HANGOVER_CHUNKS = 7; // ~700 ms of 100 ms chunks
const BARGE_IN_CHUNKS = 2; // ~200 ms of clear speech over the interviewer

export function rmsOf(pcm: Int16Array) {
  let sum = 0;
  for (let i = 0; i < pcm.length; i++) {
    const v = pcm[i] / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / Math.max(1, pcm.length));
}

export interface GateResult {
  /** Audio to send: the original chunk, or silence of the same length. */
  out: ArrayBuffer;
  /** The candidate appears to be speaking right now. */
  speech: boolean;
  /** The candidate started talking over the interviewer. */
  bargeIn: boolean;
}

export class VoiceGate {
  private hang = 0;
  private overAi = 0;
  /** Learned ratio of mic level to interviewer output level (speaker leak). */
  private echoRatio = 0.6;

  constructor(
    private threshold: number,
    private fullDuplex: boolean,
  ) {}

  process(chunk: ArrayBuffer, aiRms: number, aiActive: boolean): GateResult {
    const pcm = new Int16Array(chunk);
    const rms = rmsOf(pcm);
    const silent = () => new Int16Array(pcm.length).buffer;

    if (aiActive && !this.fullDuplex) {
      const echo = aiRms * this.echoRatio;
      const loudEnough = rms > Math.max(this.threshold * 1.5, echo * 3);
      this.overAi = loudEnough ? this.overAi + 1 : 0;
      if (this.overAi >= BARGE_IN_CHUNKS) {
        this.hang = HANGOVER_CHUNKS;
        return { out: chunk, speech: true, bargeIn: this.overAi === BARGE_IN_CHUNKS };
      }
      // Not the candidate: refine the leak estimate and send silence.
      if (!loudEnough && aiRms > 0.005) {
        const ratio = Math.min(2, Math.max(0.02, rms / aiRms));
        this.echoRatio = this.echoRatio * 0.9 + ratio * 0.1;
      }
      this.hang = 0;
      return { out: silent(), speech: false, bargeIn: false };
    }

    this.overAi = 0;
    if (rms >= this.threshold) this.hang = HANGOVER_CHUNKS;
    else if (this.hang > 0) this.hang--;
    const open = this.hang > 0;
    return { out: open ? chunk : silent(), speech: open, bargeIn: false };
  }
}

/**
 * Turns level samples recorded while the candidate read the test phrase into
 * a gate threshold: well under their speaking level, well over the room.
 */
export function calibrate(levels: number[]): number | null {
  const speech = levels.filter((l) => l > 0.02).sort((a, b) => a - b);
  if (speech.length < 8) return null;
  const voice = speech[Math.floor(speech.length / 2)];
  const all = [...levels].sort((a, b) => a - b);
  const noise = all[Math.floor(all.length * 0.2)] ?? 0;
  return Math.min(0.05, Math.max(0.006, noise * 2.5, voice * 0.25));
}
