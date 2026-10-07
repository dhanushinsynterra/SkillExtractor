# SkillExtractor — product plan

A voice-based AI interviewer ("Aria") that assesses a candidate's real skill depth through conversation, with a separate admin console for the hiring team.

## Surfaces

| Route | Who | What |
| --- | --- | --- |
| `/` | Candidate | Welcome and details (name, email, track, consent) |
| `/check` | Candidate | Microphone level meter, camera preview, speaker test, network check, audio-only option |
| `/session` | Candidate | Live interview: voice orb, stage progress, live transcript, code-review card, typed fallback |
| `/done` | Candidate | Confirmation, personal feedback summary, next steps |
| `/admin` | Hiring team | Openings with progress, KPIs, candidate list with filters and search |
| `/admin/report/:id` | Hiring team | Report with Manager, HR and Tech views |

UI is dark-only, built with React + TypeScript + Vite.

## Interview stages

Introduction → Warm-up → Experience (two questions per track) → Problem solving (collaborative scenario plus a follow-up) → Code review (the candidate dictates line edits, which are applied verbatim) → Wrap-up.

Tracks: Frontend, Backend, Data & AI, Mobile, Quality engineering.

## Product principles

1. **A conversation, not an exam.** Empathetic tone, reassurance when answers are hesitant, no trick questions.
2. **Humans decide.** Integrity signals (gaze, phone, voice change, reconnects) are shown to reviewers as raw events. The AI never rejects anyone automatically.
3. **Resilient sessions.** Sessions save continuously and resume after drops. Audio-only mode and typing keep things working on weak connections.
4. **Feedback for every candidate.** Every candidate gets a short summary of strengths and areas to practise.
5. **Evidence-based reports.** Every skill score is backed by a quote from the candidate.

## Compliance note

India has no GDPR-style regime, but the **Digital Personal Data Protection Act, 2023** still applies to candidate audio and video. The onboarding screen collects explicit consent. The backend phase should add a retention period, a deletion route and a notice that names the purpose of processing.

## Build phases

1. **UI with a scripted demo engine** (done). Real mic meter and camera, browser speech synthesis and recognition when available, typed fallback, seeded admin data.
2. **Backend.** Express + WebSockets, a Gemini Live bridge, a session store with resume, skill knowledge-graph tools, the code-card engine and admin authentication.
3. **Signals.** Acoustic nervousness detection leading to reassurance, webcam gaze and phone detection, a voice-consistency flag.
4. **Admin operations.** Real openings, invite links, CSV export, roles and audit log.
