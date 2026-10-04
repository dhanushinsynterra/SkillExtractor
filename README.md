# SkillExtractor

A friendly, voice-based AI that gauges a candidate's domain and skill depth through natural conversation instead of a formal interview. Built from the decisions in [`minutes-2026-09-30.md`](minutes-2026-09-30.md).

- **Candidates** get a calm welcome screen, a mic/camera check, then a voice chat with *Sage*: introduction → ice-breaker → domain exploration → a collaborative problem → a "stealth debugging" code card they fix by dictating edits → wrap-up.
- **Reviewers** (manager, HR, technical team) get a report with a tab for each audience: recommendation and score, communication, composure and integrity, a per-skill depth breakdown with evidence, and the full transcript.

## Architecture

```
web/  (React + TypeScript, Vite)          server/  (Express + ws)                     Gemini Live
 ├─ mic → AudioWorklet → 16 kHz PCM16 ──►  /ws/sessions/:id  ── LiveBridge ──────────►  native-audio model
 ├─ 24 kHz PCM playback, barge-in   ◄──    ├─ tool calls → skill graph, code card ◄──   (tools, transcription,
 ├─ captions + typed fallback              ├─ integrity policy (warn → terminate)        session resumption)
 ├─ acoustic affect analysis ──────────►   ├─ nervousness detector → reassurance note
 └─ webcam proctor (MediaPipe) ────────►   └─ session store (resume after drops)
                                           /api  sessions, reviewer-only reports
shared/  types + WebSocket protocol used by both sides
```

| Decision in the minutes | Where it lives |
| --- | --- |
| Low-latency voice over WebSockets + Gemini Live | `server/src/live/gemini.ts`, `server/src/live/bridge.ts`, `web/src/audio/*` |
| Audio + text streaming with a transcript fallback | `outputAudioTranscription`/`inputAudioTranscription`, `web/src/components/Transcript.tsx` |
| Backend session persistence and resumption | `server/src/sessions/store.ts`. The bridge stores Live resumption handles and re-seeds from the transcript when no handle is available. The browser reconnects automatically. |
| Express backend for tokens and orchestration | The API key stays on the server. The browser only gets a per-session resume token. |
| Real-time skill tracking (knowledge graph) | `server/src/skills/graph.ts`, exposed to the model as `record_skill_evidence` / `get_skill_coverage` |
| Implicit validation through contextual questions | Domain catalogs with related skills and tools, plus `suggestNextProbes()` |
| Stealth debugging / voice-controlled code correction | `server/src/codecards/cards.ts`. Edits are applied verbatim, with no auto-correct. |
| Phone detection, warn first, adaptive gaze | `web/src/proctor/vision.ts` (detection), `server/src/integrity/policy.ts` (policy) |
| Voice verification | `web/src/audio/affect.ts` flags a sustained voice shift as `voice_change` |
| Acoustic emotion → empathetic reassurance | `web/src/audio/affect.ts` (features), `server/src/affect/nervousness.ts` (baseline-relative detection) |
| Calm UI (soft blues and greens, rounded, glowing mic) | `web/src/index.css`, `web/src/components/VoiceOrb.tsx` |

## Running locally

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env     # add GEMINI_API_KEY for the real model
npm run dev                             # server on :8787, web on :5173
```

Open http://localhost:5173 for the candidate flow, or http://localhost:5173/#/review for reviewers.

**Without an API key** the server runs a scripted *demo mode* model. It replies with text, advances through every phase, shows the code card and ends the session, so you can try the whole UI. In demo mode, speech is detected but not transcribed; type in the caption box to move the conversation along.

### Production

```bash
npm run build
REVIEWER_KEY=change-me GEMINI_API_KEY=... node server/dist/index.js
```

The server also serves `web/dist`, so a single process hosts everything. Put it behind HTTPS, because browsers only allow mic and camera access on secure origins.

### Configuration (`server/.env`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | – | Enables the real Live model (otherwise demo mode) |
| `GEMINI_LIVE_MODEL` | `gemini-2.5-flash-native-audio-preview-09-2025` | Voice model |
| `GEMINI_TEXT_MODEL` | `gemini-2.5-flash` | Writes the report narrative |
| `GEMINI_VOICE` | `Aoede` | Prebuilt voice |
| `REVIEWER_KEY` | – | Protects the session list and reports |
| `MAX_INTEGRITY_VIOLATIONS` | `3` | Warnings before the session is ended |
| `RESUME_GRACE_MS` | `600000` | How long a disconnected session can be resumed |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins |

## Scripts

```bash
npm test          # server unit tests (vitest)
npm run typecheck # all workspaces
npm run build     # server bundle (tsup) + web (vite)
```

## Known limitations

- Sessions are kept in memory. Restarting the server loses them, so add a database before real use.
- The voice-consistency check compares pitch with the candidate's baseline. It is a heuristic signal for reviewers, not voice biometrics, and it should never be the only basis for a decision.
- Gaze and phone detection load MediaPipe models from public CDNs at runtime. If those are blocked, the session continues without camera checks and the UI says so.
- Integrity and nervousness signals can misfire (for example, a candidate who looks away while thinking, or one who speaks fast naturally). The policy warns before it acts, and the report shows the raw events so a human can judge.
