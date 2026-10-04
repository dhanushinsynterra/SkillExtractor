/**
 * Types shared by the server and the web client: domain models plus the
 * WebSocket protocol spoken between the browser and the session orchestrator.
 */

// ---------------------------------------------------------------------------
// Candidate & session
// ---------------------------------------------------------------------------

export interface CandidateProfile {
  name: string;
  /** Role the candidate is being assessed for, e.g. "Backend Engineer". */
  role: string;
  /** Core domain the conversation starts from, e.g. "backend", "frontend". */
  domain: string;
}

export type SessionStatus = 'created' | 'active' | 'paused' | 'completed' | 'terminated';

/** Conversation phases, mirroring the onboarding flow from the requirements. */
export type AssessmentPhase =
  | 'introduction'
  | 'ice_breaker'
  | 'domain_exploration'
  | 'collaborative_problem'
  | 'code_card'
  | 'wrap_up';

export const PHASES: readonly AssessmentPhase[] = [
  'introduction',
  'ice_breaker',
  'domain_exploration',
  'collaborative_problem',
  'code_card',
  'wrap_up',
];

export interface CreateSessionRequest extends CandidateProfile {}

export interface CreateSessionResponse {
  sessionId: string;
  /** Opaque secret the client presents to (re)attach to the session socket. */
  resumeToken: string;
}

export interface SessionSummary {
  sessionId: string;
  candidate: CandidateProfile;
  status: SessionStatus;
  phase: AssessmentPhase;
  createdAt: string;
  endedAt?: string;
}

// ---------------------------------------------------------------------------
// Skill tracking (knowledge graph)
// ---------------------------------------------------------------------------

export type SkillKind = 'core' | 'related' | 'tool';

/** 0 = not demonstrated … 4 = expert-level depth. */
export type SkillDepth = 0 | 1 | 2 | 3 | 4;

export const DEPTH_LABELS: Record<SkillDepth, string> = {
  0: 'Not demonstrated',
  1: 'Aware',
  2: 'Working knowledge',
  3: 'Proficient',
  4: 'Expert',
};

export interface SkillEvidence {
  at: string;
  /** Short quote or paraphrase of what the candidate said or did. */
  note: string;
  depth: SkillDepth;
  source: 'conversation' | 'code_card' | 'problem_solving';
}

export interface SkillNode {
  id: string;
  name: string;
  kind: SkillKind;
  /** Current best estimate of depth (max of evidence, damped by confidence). */
  depth: SkillDepth;
  /** 0..1, grows with corroborating evidence. */
  confidence: number;
  /** Whether the AI has already asked about this skill. */
  probed: boolean;
  evidence: SkillEvidence[];
}

export interface SkillEdge {
  from: string;
  to: string;
  relation: 'uses' | 'related_to' | 'part_of';
}

export interface SkillGraphSnapshot {
  nodes: SkillNode[];
  edges: SkillEdge[];
}

// ---------------------------------------------------------------------------
// Integrity (proctoring) & affect
// ---------------------------------------------------------------------------

export type IntegrityEventType =
  | 'gaze_away'
  | 'phone_detected'
  | 'multiple_faces'
  | 'no_face'
  | 'voice_change'
  | 'tab_hidden';

export interface IntegrityEvent {
  type: IntegrityEventType;
  at: string;
  /** For duration-based signals (gaze, no face, tab hidden). */
  durationMs?: number;
  /** True while the condition is still ongoing (periodic update). */
  ongoing?: boolean;
  /** Detector confidence 0..1. */
  confidence?: number;
  detail?: string;
}

export type IntegrityVerdict = 'ignored' | 'logged' | 'warning' | 'terminate';

export interface IntegrityRecord extends IntegrityEvent {
  verdict: IntegrityVerdict;
}

/** Acoustic features computed client-side over a short window of speech. */
export interface AffectSample {
  at: string;
  /** Approximate syllables per second. */
  speechRate: number;
  /** Mean fundamental frequency (Hz) over voiced frames. */
  pitchMean: number;
  /** Standard deviation of F0 (Hz). */
  pitchStd: number;
  /** Mean RMS energy (0..1). */
  energy: number;
  /** Fraction of the window that was voiced. */
  voicedRatio: number;
}

// ---------------------------------------------------------------------------
// Code cards (stealth debugging / voice-controlled correction)
// ---------------------------------------------------------------------------

export interface CodeCardView {
  id: string;
  title: string;
  language: string;
  /** Short framing shown to the candidate (never reveals the bug). */
  prompt: string;
  lines: string[];
  solved: boolean;
  edits: number;
}

export interface CodeEdit {
  action: 'replace' | 'insert_after' | 'delete';
  /** 1-based line number. For insert_after, 0 inserts at the top. */
  line: number;
  content?: string;
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

export interface TranscriptEntry {
  role: 'candidate' | 'ai' | 'system';
  text: string;
  at: string;
}

// ---------------------------------------------------------------------------
// WebSocket protocol
// ---------------------------------------------------------------------------

/** Audio sent by the client: 16 kHz mono PCM16, base64. */
export const INPUT_SAMPLE_RATE = 16000;
/** Audio sent by the model: 24 kHz mono PCM16, base64. */
export const OUTPUT_SAMPLE_RATE = 24000;

export type ClientMessage =
  | { type: 'audio'; data: string }
  | { type: 'audio_end' }
  | { type: 'text'; text: string }
  | { type: 'integrity'; event: IntegrityEvent }
  | { type: 'affect'; sample: AffectSample }
  | { type: 'end' };

export type ServerMessage =
  | { type: 'ready'; sessionId: string; resumed: boolean; mock: boolean; phase: AssessmentPhase }
  | { type: 'audio'; data: string }
  | { type: 'transcript'; role: 'candidate' | 'ai'; text: string }
  | { type: 'turn_complete' }
  | { type: 'interrupted' }
  | { type: 'phase'; phase: AssessmentPhase }
  | { type: 'skills'; graph: SkillGraphSnapshot }
  | { type: 'code_card'; card: CodeCardView | null }
  | { type: 'warning'; message: string; violations: number; maxViolations: number }
  | { type: 'terminated'; reason: string }
  | { type: 'ended'; sessionId: string }
  | { type: 'error'; message: string };

// ---------------------------------------------------------------------------
// Report (consumed by manager, HR and the technical team)
// ---------------------------------------------------------------------------

export type Recommendation = 'strong_yes' | 'yes' | 'lean_yes' | 'lean_no' | 'no' | 'insufficient_data';

export interface AssessmentReport {
  sessionId: string;
  candidate: CandidateProfile;
  generatedAt: string;
  status: SessionStatus;
  durationMinutes: number;
  narrativeSource: 'model' | 'heuristic';
  manager: {
    headline: string;
    recommendation: Recommendation;
    overallScore: number; // 0..100
    strengths: string[];
    risks: string[];
  };
  hr: {
    communication: string;
    composure: string;
    nervousnessEpisodes: number;
    reassurancesGiven: number;
    integrity: {
      verdict: 'clean' | 'minor_flags' | 'serious_flags' | 'terminated';
      warnings: number;
      events: IntegrityRecord[];
    };
  };
  technical: {
    skills: SkillNode[];
    coverage: { probed: number; total: number };
    codeCard?: {
      title: string;
      solved: boolean;
      edits: number;
      finalLines: string[];
    };
    notes: string[];
  };
  transcript: TranscriptEntry[];
}
