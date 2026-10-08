# Synterra

A voice interview platform. Candidates have a spoken conversation with **Aria**, an AI interviewer running on Gemini Live, and the hiring team gets an evidence-based report.

- **Candidate** (`/`): details → device check (mic, camera, face detection, network) → live voice interview with transcript and a code-review exercise → feedback summary.
- **Admin** (`/#/admin`): real interviews with live status, filters and reports (Manager / HR / Tech / Transcript), plus **Settings** for the Gemini API key, voice and models.

## Setup

Requires Node 20+.

```bash
npm install
cp server/.env.example server/.env
npm run dev
```

Then open http://localhost:5173/#/admin/settings and paste a Gemini API key (from https://aistudio.google.com/apikey). It is verified, stored in `server/data/settings.json` and never sent to the browser. You can also set `GEMINI_API_KEY` in `server/.env`. Until a key is configured, candidates see "Interviews are not available yet".

Set `ADMIN_PASSWORD` in `server/.env` before running anywhere other than your own machine.

## How it works

```
browser                                   server (Express + ws)                    Gemini
mic → AudioWorklet → PCM16 16 kHz ─────►  /ws/sessions/:id  ── live.connect ─────► Live native-audio model
speaker ◄── PCM16 24 kHz ◄──────────────  transcript, tool calls ◄───────────────   (voice, transcription, tools)
face detection (MediaPipe) ─ integrity ►  proctoring notices → model
                                          on end → report model (JSON schema) → data/sessions/*.json
```

- **Voice**: Gemini Live native audio. Pick the voice and the model in Settings; the model list comes from what your key can access.
- **Tools the interviewer calls**: `set_phase`, `record_skill`, `show_code_card`, `apply_code_edit` (applies the candidate's dictated edit verbatim, no auto-correct) and `end_interview`.
- **Proctoring**: the browser runs face detection about 4 times a second. If no face is visible for 3 seconds, Aria pauses and asks whether the candidate is still there. When they come back, Aria welcomes them back and continues. More than one face, or switching tabs, triggers a polite reminder. Being away for over 2 minutes ends the interview. Every event is logged on the report's HR tab for a human to judge.
- **Reconnects**: if the browser connection drops, it reconnects automatically within 90 seconds and the interview continues.
- **Reports**: written by a Gemini text model from the transcript, the skill notes, the code-review result and the integrity events. If generation fails, it can be retried from the report page. Retired models are skipped automatically.
- **Echo**: on speakers, the mic pauses while Aria talks so the model never hears itself. Candidates who tick “I’m wearing headphones” can interrupt instead.

## Focus aids (ADHD-friendly)

- **One question at a time.** Aria keeps turns under about 40 words, asks a single concrete question and waits. The current question is pinned in its own card, with any lead-in shown smaller above it.
- **Help on demand.** **Repeat**, **Say it simpler** and **I need a moment** buttons are always visible. They are logged in the transcript, and the report is told never to count them against the candidate.
- **No clock pressure.** The timer is hidden by default; candidates see “Step 3 of 6” instead and can turn the timer on if they prefer.
- **Extra time to think.** This optional setting doubles the silence Aria waits for before replying (about 2.2 s instead of 1.2 s) and tells Aria to allow long pauses.
- **Fair scoring.** The report model is told not to penalise pauses, tangents, repeats or nerves.
- **Calm motion.** Animations are minimal and are switched off when the OS asks for reduced motion.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server on :8787 and web on :5173 (proxied) |
| `npm run build` | Builds the web app into `web/dist` |
| `npm start` | Runs the server, which also serves `web/dist` |
| `npm run typecheck` | Typechecks server and web |
| `npm test` | Server unit tests (vitest) |
| `npm run docker:up` | Builds and runs the app behind Nginx on http://localhost:8080 |

## Deploying behind Nginx

- **Docker:** `docker compose up --build` runs two containers. `app` is the Node server and keeps its data in a named volume. `nginx` serves the built web app and proxies `/api` and `/ws` to it. The compose file reads `server/.env`.
- **Host install with TLS:** use [`deploy/nginx/synterra.conf`](deploy/nginx/synterra.conf). It redirects HTTP to HTTPS, sets HSTS and lists the setup steps at the top of the file.
- **Shared config** in [`deploy/nginx/synterra.common.conf`](deploy/nginx/synterra.common.conf):
  - WebSocket upgrade with a 1-hour, unbuffered timeout for live audio.
  - Session creation limited to 10 per minute per IP (the server enforces this too).
  - Built assets cached for a year; the app shell always revalidated.
  - SPA fallback, gzip, and a security policy that still allows MediaPipe and the audio worklet.
- **TLS is required.** Browsers only grant camera and microphone on HTTPS or localhost.

## Notes

- Browsers only allow mic and camera on `localhost` or HTTPS. Put production behind TLS.
- Face detection loads MediaPipe from jsDelivr and its model from Google Cloud Storage. If those are blocked, the interview continues and the report records that checks were unavailable.
- Interviews are stored as JSON files in `server/data/` (gitignored). Use a database before running at scale.
- Candidate audio and video are personal data under India's DPDP Act, 2023. Consent is collected on the first screen, and audio is streamed, not recorded. Add a retention policy before production use.
