import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { LiveBridge } from './live/bridge.js';
import { connectGemini } from './live/gemini.js';
import { connectMock } from './live/mock.js';
import { apiRouter } from './routes/api.js';
import { SessionStore } from './sessions/store.js';

const store = new SessionStore({ maxViolations: config.maxViolations });
const connectModel = config.mock ? connectMock : connectGemini;

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  const origin = req.header('origin');
  if (origin && config.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Resume-Token, X-Reviewer-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});
app.use('/api', apiRouter(store));

// In production, serve the built web app from the same origin.
const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^\/(?!api|ws).*/, (_req, res) => res.sendFile(path.join(webDist, 'index.html')));
}

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true, maxPayload: 1 << 20 });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const match = url.pathname.match(/^\/ws\/sessions\/([\w-]+)$/);
  const session = match ? store.authorize(match[1], url.searchParams.get('token') ?? undefined) : undefined;
  if (!session || session.status === 'completed' || session.status === 'terminated') {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => LiveBridge.attach(session, ws, connectModel));
});

setInterval(() => {
  for (const s of store.expireIdle(config.resumeGraceMs)) console.info(`[session ${s.id}] expired after disconnect`);
}, 30_000).unref();

server.listen(config.port, () => {
  console.info(`SkillExtractor server on http://localhost:${config.port} (${config.mock ? 'MOCK model' : config.liveModel})`);
});
