import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { CreateSessionResponse } from '@skillx/shared';
import { config } from '../config.js';
import { buildHeuristicReport } from '../report/generate.js';
import { withModelNarrative } from '../report/narrative.js';
import { SUPPORTED_DOMAINS } from '../skills/catalog.js';
import { summarize, type SessionStore } from '../sessions/store.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(80),
  domain: z.string().trim().min(1).max(40),
});

/** Reports are for the manager, HR and the tech team; never for the candidate's browser. */
function requireReviewer(req: Request, res: Response, next: NextFunction) {
  if (!config.reviewerKey) return next();
  const key = req.header('x-reviewer-key') ?? req.query.key;
  if (key === config.reviewerKey) return next();
  res.status(401).json({ error: 'Reviewer key required.' });
}

export function apiRouter(store: SessionStore): Router {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({ ok: true, mock: config.mock, model: config.mock ? 'mock' : config.liveModel });
  });

  router.get('/domains', (_req, res) => {
    res.json(SUPPORTED_DOMAINS);
  });

  router.post('/sessions', (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request', issues: parsed.error.issues });
      return;
    }
    const session = store.create(parsed.data);
    const body: CreateSessionResponse = { sessionId: session.id, resumeToken: session.resumeToken };
    res.status(201).json(body);
  });

  router.get('/sessions', requireReviewer, (_req, res) => {
    res.json(store.list().map(summarize));
  });

  router.get('/sessions/:id', (req: Request<{ id: string }>, res) => {
    const session = store.authorize(req.params.id, req.header('x-resume-token'));
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    res.json(summarize(session));
  });

  router.get('/sessions/:id/report', requireReviewer, async (req: Request<{ id: string }>, res: Response) => {
    const session = store.get(req.params.id);
    if (!session) {
      res.status(404).json({ error: 'Session not found.' });
      return;
    }
    const finished = session.status === 'completed' || session.status === 'terminated';
    if (finished && session.report) {
      res.json(session.report);
      return;
    }

    let report = buildHeuristicReport(session);
    if (finished && req.query.narrative !== '0') {
      try {
        report = await withModelNarrative(report);
      } catch (err) {
        console.warn(`[report ${session.id}] narrative failed, using heuristic text`, err);
      }
      session.report = report;
    }
    res.json(report);
  });

  return router;
}
