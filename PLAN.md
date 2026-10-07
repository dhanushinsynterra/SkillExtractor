# Synterra — product plan

A voice-based AI interviewer ("Aria") that assesses a candidate's real skill depth through conversation, with a separate admin console for the hiring team.

## Surfaces

| Route | Who | What |
| --- | --- | --- |
| `/` | Candidate | Welcome and details (name, email, track, consent) |
| `/check` | Candidate | Mic level meter, camera preview, face detection, speaker test, network check, audio-only option |
| `/session` | Candidate | Gemini Live voice interview: waveform, stage progress, live transcript, code-review card, typed fallback, presence alerts |
| `/done` | Candidate | Confirmation, personal feedback summary, next steps |
| `/admin` | Hiring team | Live and past interviews, KPIs, filters and search, candidate link |
| `/admin/settings` | Hiring team | Gemini API key, interviewer voice, live and report models |
| `/admin/report/:id` | Hiring team | Report with Manager, HR, Tech and Transcript views; retry or delete |

UI is dark-only, built with React + TypeScript + Vite. The server is Express + ws, and the voice runs on Gemini Live.

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

1. **UI** (done). Dark candidate flow and admin console.
2. **Backend** (done). Express + WebSockets, Gemini Live voice bridge, interviewer tools (phases, skill notes, code card), file-based session store, AI-written reports, admin settings for the API key, voice and models.
3. **Signals** (partly done). Webcam face presence and multiple-face detection, plus tab switching, with the interviewer reacting live. Still to do: acoustic nervousness cues and a voice-consistency check.
4. **Admin operations.** Openings and invite links per role, CSV export, roles and audit log, a database instead of JSON files.
