import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { WebSocketServer } from 'ws';
import { TRACKS, type CandidateInfo, type PublicStatus, type TrackId } from '../../shared/types';
import { activeCount, attach } from './live';
import { generateReport } from './report';
import * as settings from './settings';
import * as store from './store';

const PORT = Number(process.env.SERVER_PORT ?? 8787);
const app = express();
app.use(express.json({ limit: '100kb' }));

// ---------------------------------------------------------------------------
// Candidate API
// ---------------------------------------------------------------------------

app.get('/api/status', (_req, res) => {
  res.json({ ready: Boolean(settings.apiKey()) } satisfies PublicStatus);
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/api/sessions', (req, res) => {
  if (!settings.apiKey()) return res.status(503).json({ error: 'Interviews are not configured yet.' });
  const { name, email, track } = req.body ?? {};
  const candidate: CandidateInfo = {
    name: String(name ?? '').trim().slice(0, 120),
    email: String(email ?? '').trim().slice(0, 200),
    track: String(track) as TrackId,
  };
  if (candidate.name.length < 2) return res.status(400).json({ error: 'Name is required.' });
  if (!EMAIL_RE.test(candidate.email)) return res.status(400).json({ error: 'A valid email is required.' });
  if (!TRACKS.some((t) => t.id === candidate.track)) return res.status(400).json({ error: 'Unknown track.' });
  const { record, token } = store.create(candidate);
  res.status(201).json({ id: record.id, token });
});

/** Candidate-facing feedback once the report is ready. */
app.get('/api/sessions/:id/feedback', (req, res) => {
  const s = store.authorize(String(req.params.id), req.header('x-session-token'));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json({
    status: s.reportStatus,
    strengths: s.report?.strengths ?? [],
    practise: s.report?.practise ?? [],
  });
});

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const pw = settings.adminPassword();
  if (!pw) return next();
  const given = Buffer.from(req.header('x-admin-key') ?? '');
  const want = Buffer.from(pw);
  if (given.length === want.length && crypto.timingSafeEqual(given, want)) return next();
  res.status(401).json({ error: 'Admin password required' });
}

app.get('/api/admin/auth', (_req, res) => res.json({ required: Boolean(settings.adminPassword()) }));
app.post('/api/admin/login', requireAdmin, (_req, res) => res.json({ ok: true }));

app.get('/api/admin/settings', requireAdmin, (_req, res) => res.json(settings.view()));

app.put('/api/admin/settings', requireAdmin, async (req, res) => {
  try {
    await settings.update(req.body ?? {});
    res.json(settings.view());
  } catch (e) {
    res.status(400).json({ error: settings.friendlyError(e) });
  }
});

app.get('/api/admin/models', requireAdmin, async (_req, res) => {
  try {
    res.json(await settings.listModels());
  } catch (e) {
    res.status(400).json({ error: settings.friendlyError(e) });
  }
});

app.get('/api/admin/sessions', requireAdmin, (_req, res) => {
  res.json({ sessions: store.summaries(), live: activeCount() });
});

app.get('/api/admin/sessions/:id', requireAdmin, (req, res) => {
  const s = store.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(store.publicRecord(s));
});

app.post('/api/admin/sessions/:id/report', requireAdmin, async (req, res) => {
  const s = store.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.status === 'active' || s.status === 'created') return res.status(409).json({ error: 'Interview has not finished.' });
  await generateReport(s);
  res.json(store.publicRecord(s));
});

app.delete('/api/admin/sessions/:id', requireAdmin, (req, res) => {
  const s = store.get(String(req.params.id));
  if (!s) return res.status(404).json({ error: 'Not found' });
  if (s.status === 'active') return res.status(409).json({ error: 'Interview is in progress.' });
  store.remove(s.id);
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Static web build (production)
// ---------------------------------------------------------------------------

const webDist = path.resolve(import.meta.dirname, '../../web/dist');
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

// ---------------------------------------------------------------------------
// WebSocket: /ws/sessions/:id?token=…
// ---------------------------------------------------------------------------

const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '', 'http://localhost');
  const m = url.pathname.match(/^\/ws\/sessions\/([\w-]+)$/);
  const record = m ? store.authorize(m[1], url.searchParams.get('token')) : undefined;
  if (!record) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => attach(ws, record));
});

server.listen(PORT, () => {
  console.log(`SkillExtractor server on http://localhost:${PORT}`);
  if (!settings.apiKey()) console.log('No Gemini API key yet: set GEMINI_API_KEY or add it in Admin → Settings.');
  if (!settings.adminPassword()) console.log('ADMIN_PASSWORD is not set: the admin console is open to anyone who can reach this server.');
});
