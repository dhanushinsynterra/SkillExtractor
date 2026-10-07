# SkillExtractor

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
- **Reports**: written by a Gemini text model from the transcript, the skill notes, the code-review result and the integrity events. If generation fails, it can be retried from the report page.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Server on :8787 and web on :5173 (proxied) |
| `npm run build` | Builds the web app into `web/dist` |
| `npm start` | Runs the server, which also serves `web/dist` |
| `npm run typecheck` | Typechecks server and web |

## Notes

- Use headphones. Speaker echo can be picked up as candidate speech in open-speaker setups.
- Browsers only allow mic and camera on `localhost` or HTTPS. Put production behind TLS.
- Face detection loads MediaPipe from jsDelivr and its model from Google Cloud Storage. If those are blocked, the interview continues and the report records that checks were unavailable.
- Interviews are stored as JSON files in `server/data/` (gitignored). Use a database before running at scale.
- Candidate audio and video are personal data under India's DPDP Act, 2023. Consent is collected on the first screen, and audio is streamed, not recorded. Add a retention policy before production use.
