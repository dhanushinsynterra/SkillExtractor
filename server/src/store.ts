import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { CandidateInfo, SessionRecord, SessionSummary } from '../../shared/types';
import { DATA_DIR } from './settings';

/**
 * File-backed session store: one JSON file per interview, loaded into memory
 * at startup and written through (debounced) on every change.
 */

const DIR = path.join(DATA_DIR, 'sessions');
fs.mkdirSync(DIR, { recursive: true });

interface Stored extends SessionRecord {
  tokenHash: string;
}

const sessions = new Map<string, Stored>();
const timers = new Map<string, NodeJS.Timeout>();

for (const f of fs.readdirSync(DIR)) {
  if (!f.endsWith('.json')) continue;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Stored;
    // Anything that was mid-interview when the server stopped can't resume.
    if (s.status === 'active' || s.status === 'created') s.status = 'abandoned';
    if (s.reportStatus === 'pending') s.reportStatus = 'failed';
    sessions.set(s.id, s);
  } catch (e) {
    console.error(`Skipping unreadable session file ${f}:`, e);
  }
}

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');

function writeNow(id: string) {
  const s = sessions.get(id);
  if (!s) return;
  const file = path.join(DIR, `${id}.json`);
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(s));
  fs.renameSync(`${file}.tmp`, file);
}

export function persist(id: string, immediate = false) {
  clearTimeout(timers.get(id));
  if (immediate) return writeNow(id);
  timers.set(
    id,
    setTimeout(() => writeNow(id), 500),
  );
}

export function create(candidate: CandidateInfo): { record: SessionRecord; token: string } {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  const record: Stored = {
    id,
    tokenHash: hash(token),
    candidate,
    status: 'created',
    phase: 'hello',
    createdAt: new Date().toISOString(),
    transcript: [],
    evidence: [],
    integrity: [],
    reportStatus: 'none',
  };
  sessions.set(id, record);
  persist(id, true);
  return { record, token };
}

export function get(id: string): SessionRecord | undefined {
  return sessions.get(id);
}

export function authorize(id: string, token: string | null | undefined): SessionRecord | undefined {
  const s = sessions.get(id);
  if (!s || !token) return undefined;
  const a = Buffer.from(s.tokenHash);
  const b = Buffer.from(hash(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? s : undefined;
}

export function remove(id: string) {
  sessions.delete(id);
  fs.rmSync(path.join(DIR, `${id}.json`), { force: true });
}

/** Strips the token hash before a record leaves the server. */
export function publicRecord(s: SessionRecord): SessionRecord {
  const { tokenHash: _omit, ...rest } = s as Stored;
  return rest;
}

export function summaries(): SessionSummary[] {
  return [...sessions.values()]
    .map((s) => ({
      id: s.id,
      candidate: s.candidate,
      status: s.status,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
      durationMin:
        s.startedAt && s.endedAt ? Math.max(1, Math.round((Date.parse(s.endedAt) - Date.parse(s.startedAt)) / 60000)) : undefined,
      verdict: s.report?.verdict,
      score: s.report?.score,
      flags: s.integrity.filter((e) => e.severity === 'warn').length,
      reportStatus: s.reportStatus,
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
