import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  AssessmentPhase,
  AssessmentReport,
  CandidateProfile,
  SessionStatus,
  SessionSummary,
  TranscriptEntry,
} from '@skillx/shared';
import { NervousnessDetector } from '../affect/nervousness.js';
import type { CodeCardState } from '../codecards/cards.js';
import { IntegrityPolicy } from '../integrity/policy.js';
import { SkillGraph } from '../skills/graph.js';

export interface AssessmentSession {
  id: string;
  resumeToken: string;
  candidate: CandidateProfile;
  status: SessionStatus;
  phase: AssessmentPhase;
  createdAt: Date;
  startedAt?: Date;
  endedAt?: Date;
  endReason?: string;
  /** Last time a client socket was attached or sent data. */
  lastSeenAt: Date;
  transcript: TranscriptEntry[];
  skills: SkillGraph;
  integrity: IntegrityPolicy;
  affect: NervousnessDetector;
  codeCard?: CodeCardState;
  usedCardIds: string[];
  /** Gemini Live session-resumption handle (valid for a limited time). */
  resumptionHandle?: string;
  report?: AssessmentReport;
}

/**
 * Keeps conversation context on the backend so a dropped socket (or a Live
 * API GoAway) can be resumed without losing the candidate's progress.
 */
export class SessionStore {
  private sessions = new Map<string, AssessmentSession>();

  constructor(private readonly options: { maxViolations: number }) {}

  create(candidate: CandidateProfile): AssessmentSession {
    const now = new Date();
    const session: AssessmentSession = {
      id: randomUUID(),
      resumeToken: randomBytes(24).toString('base64url'),
      candidate,
      status: 'created',
      phase: 'introduction',
      createdAt: now,
      lastSeenAt: now,
      transcript: [],
      skills: SkillGraph.forDomain(candidate.domain),
      integrity: new IntegrityPolicy({ maxViolations: this.options.maxViolations }),
      affect: new NervousnessDetector(),
      usedCardIds: [],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): AssessmentSession | undefined {
    return this.sessions.get(id);
  }

  authorize(id: string, token: string | undefined): AssessmentSession | undefined {
    const session = this.sessions.get(id);
    if (!session || !token) return undefined;
    const a = Buffer.from(session.resumeToken);
    const b = Buffer.from(token);
    return a.length === b.length && timingSafeEqual(a, b) ? session : undefined;
  }

  list(): AssessmentSession[] {
    return [...this.sessions.values()].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /** Mark sessions whose client vanished longer than the grace period as completed. */
  expireIdle(graceMs: number, now = Date.now()): AssessmentSession[] {
    const expired: AssessmentSession[] = [];
    for (const s of this.sessions.values()) {
      if (s.status === 'paused' && now - s.lastSeenAt.getTime() > graceMs) {
        finish(s, 'completed', 'Candidate disconnected and did not return.');
        expired.push(s);
      }
    }
    return expired;
  }
}

export function appendTranscript(session: AssessmentSession, role: TranscriptEntry['role'], text: string): void {
  const trimmed = text.trim();
  if (!trimmed) return;
  const last = session.transcript.at(-1);
  // Live transcription arrives in fragments; merge consecutive pieces from the same speaker.
  if (last && last.role === role && Date.now() - Date.parse(last.at) < 15_000) {
    last.text = joinFragment(last.text, trimmed);
    return;
  }
  session.transcript.push({ role, text: trimmed, at: new Date().toISOString() });
}

function joinFragment(prev: string, next: string): string {
  if (/^[,.!?;:')\]]/.test(next) || /[(\['-]$/.test(prev)) return prev + next;
  return `${prev} ${next}`;
}

export function finish(session: AssessmentSession, status: 'completed' | 'terminated', reason?: string): void {
  if (session.status === 'completed' || session.status === 'terminated') return;
  session.status = status;
  session.endedAt = new Date();
  session.endReason = reason;
  session.phase = 'wrap_up';
  session.report = undefined;
}

export function summarize(session: AssessmentSession): SessionSummary {
  return {
    sessionId: session.id,
    candidate: session.candidate,
    status: session.status,
    phase: session.phase,
    createdAt: session.createdAt.toISOString(),
    endedAt: session.endedAt?.toISOString(),
  };
}
