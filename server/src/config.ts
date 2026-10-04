import 'dotenv/config';

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: int('PORT', 8787),
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  /** Native-audio Live model used for the conversation. */
  liveModel: process.env.GEMINI_LIVE_MODEL ?? 'gemini-2.5-flash-native-audio-preview-09-2025',
  /** Text model used to write the report narrative. */
  textModel: process.env.GEMINI_TEXT_MODEL ?? 'gemini-2.5-flash',
  voiceName: process.env.GEMINI_VOICE ?? 'Aoede',
  /** Comma-separated list of allowed browser origins (empty = same-origin only). */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  /** How long a disconnected session stays resumable. */
  resumeGraceMs: int('RESUME_GRACE_MS', 10 * 60 * 1000),
  maxViolations: int('MAX_INTEGRITY_VIOLATIONS', 3),
  /** Run with a scripted model when no API key is configured. */
  get mock(): boolean {
    return process.env.MOCK_LIVE === '1' || !this.geminiApiKey;
  },
};
