import type { IntegrityEvent, IntegrityRecord, IntegrityVerdict } from '@skillx/shared';

export interface IntegrityPolicyOptions {
  /** Violations tolerated with a warning before the session is terminated. */
  maxViolations: number;
  /** Floor and ceiling for the adaptive gaze-away threshold. */
  gazeMinThresholdMs: number;
  gazeMaxThresholdMs: number;
  /** Detector confidence below which events are ignored. */
  minConfidence: number;
  /** Do not count two violations of the same type closer than this. */
  dedupeWindowMs: number;
}

export const DEFAULT_INTEGRITY_OPTIONS: IntegrityPolicyOptions = {
  maxViolations: 3,
  gazeMinThresholdMs: 3000,
  gazeMaxThresholdMs: 8000,
  minConfidence: 0.5,
  dedupeWindowMs: 15000,
};

export interface IntegrityDecision {
  verdict: IntegrityVerdict;
  /** Gentle, non-accusatory line for the AI to say (warnings only). */
  message?: string;
  violations: number;
}

/**
 * Warn-first proctoring policy.
 *
 * Gaze tracking is adaptive: brief natural glances away are recorded to build
 * a per-candidate baseline, and only glances well beyond that baseline (within
 * fixed bounds) count as violations. Phone detection, extra faces and voice
 * changes are violations directly. The first violations produce a subtle
 * warning; termination is reserved for repeated violations.
 */
export class IntegrityPolicy {
  private readonly options: IntegrityPolicyOptions;
  private glanceDurations: number[] = [];
  private lastViolationAt = new Map<string, number>();
  private violations = 0;
  readonly records: IntegrityRecord[] = [];

  constructor(options: Partial<IntegrityPolicyOptions> = {}, initial?: { records: IntegrityRecord[]; violations: number }) {
    this.options = { ...DEFAULT_INTEGRITY_OPTIONS, ...options };
    if (initial) {
      this.records.push(...initial.records);
      this.violations = initial.violations;
      for (const r of initial.records) {
        if (r.type === 'gaze_away' && r.verdict === 'logged' && r.durationMs) this.glanceDurations.push(r.durationMs);
      }
    }
  }

  get violationCount(): number {
    return this.violations;
  }

  get maxViolations(): number {
    return this.options.maxViolations;
  }

  /** Current adaptive threshold for a gaze-away to count as a violation. */
  gazeThresholdMs(): number {
    const { gazeMinThresholdMs, gazeMaxThresholdMs } = this.options;
    if (this.glanceDurations.length < 3) return gazeMinThresholdMs;
    const sorted = [...this.glanceDurations].sort((a, b) => a - b);
    const p90 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))];
    return Math.round(Math.min(gazeMaxThresholdMs, Math.max(gazeMinThresholdMs, p90 * 1.5)));
  }

  evaluate(event: IntegrityEvent, now = Date.now()): IntegrityDecision {
    const verdict = this.classify(event, now);
    this.records.push({ ...event, verdict });
    if (this.records.length > 500) this.records.splice(0, this.records.length - 500);

    if (verdict === 'warning' || verdict === 'terminate') {
      return { verdict, violations: this.violations, message: verdict === 'warning' ? warningLine(event) : undefined };
    }
    return { verdict, violations: this.violations };
  }

  private classify(event: IntegrityEvent, now: number): IntegrityVerdict {
    if ((event.confidence ?? 1) < this.options.minConfidence) return 'ignored';

    let isViolation = false;
    switch (event.type) {
      case 'gaze_away': {
        const duration = event.durationMs ?? 0;
        const threshold = this.gazeThresholdMs();
        if (duration < threshold) {
          // A completed natural glance feeds the baseline.
          if (!event.ongoing && duration > 0) {
            this.glanceDurations.push(duration);
            if (this.glanceDurations.length > 50) this.glanceDurations.shift();
          }
          return 'logged';
        }
        isViolation = true;
        break;
      }
      case 'no_face':
      case 'tab_hidden':
        isViolation = (event.durationMs ?? 0) >= this.options.gazeMaxThresholdMs;
        if (!isViolation) return 'logged';
        break;
      case 'phone_detected':
      case 'multiple_faces':
      case 'voice_change':
        isViolation = true;
        break;
    }

    if (!isViolation) return 'logged';

    const last = this.lastViolationAt.get(event.type);
    if (last !== undefined && now - last < this.options.dedupeWindowMs) return 'logged';
    this.lastViolationAt.set(event.type, now);

    this.violations += 1;
    return this.violations > this.options.maxViolations ? 'terminate' : 'warning';
  }
}

function warningLine(event: IntegrityEvent): string {
  switch (event.type) {
    case 'phone_detected':
      return 'It looks like there might be a phone nearby — mind setting it aside so we can keep this just between us?';
    case 'multiple_faces':
      return 'I think I can see someone else in the frame — this chat needs to be just you, if that is okay.';
    case 'voice_change':
      return 'I want to make sure I am hearing just you — could you keep it to your own voice for the rest of our chat?';
    case 'tab_hidden':
      return 'Looks like you stepped away from the window for a bit — let us keep this tab in focus while we talk.';
    case 'no_face':
      return 'I lost sight of you for a moment — could you stay in view of the camera?';
    case 'gaze_away':
    default:
      return 'Quick friendly reminder — try to keep your attention here with me; no other notes or screens, please.';
  }
}
