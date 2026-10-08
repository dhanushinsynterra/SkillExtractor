import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import type { AdminSettingsView, ModelOption } from '../../shared/types';

export const DATA_DIR = path.resolve(process.env.DATA_DIR ?? 'data');
const FILE = path.join(DATA_DIR, 'settings.json');

export const VOICES = [
  'Kore', 'Aoede', 'Charon', 'Puck', 'Fenrir', 'Leda', 'Orus', 'Zephyr', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi',
  'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird',
  'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat',
];

interface Stored {
  apiKey?: string;
  liveModel?: string;
  reportModel?: string;
  voice?: string;
}

const DEFAULT_LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';
const DEFAULT_REPORT_MODEL = 'gemini-2.5-flash';

let stored: Stored = {};
try {
  stored = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch {
  /* first run */
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(stored, null, 2), { mode: 0o600 });
}

export function apiKey(): string | null {
  return stored.apiKey || process.env.GEMINI_API_KEY || null;
}

export function settings() {
  return {
    liveModel: stored.liveModel || process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL,
    reportModel: stored.reportModel || process.env.GEMINI_REPORT_MODEL || DEFAULT_REPORT_MODEL,
    voice: stored.voice || process.env.GEMINI_VOICE || 'Kore',
  };
}

export function client(): GoogleGenAI {
  const key = apiKey();
  if (!key) throw new Error('Gemini API key is not configured');
  return new GoogleGenAI({ apiKey: key });
}

export const adminPassword = () => process.env.ADMIN_PASSWORD || '';

export function view(): AdminSettingsView {
  const key = apiKey();
  return {
    hasKey: Boolean(key),
    keyHint: key ? `…${key.slice(-4)}` : null,
    keySource: stored.apiKey ? 'settings' : key ? 'env' : null,
    ...settings(),
    voices: VOICES,
    authRequired: Boolean(adminPassword()),
  };
}

/** Lists models usable for live voice and for report writing. */
export async function listModels(key = apiKey()): Promise<{ live: ModelOption[]; text: ModelOption[] }> {
  if (!key) throw new Error('Gemini API key is not configured');
  const ai = new GoogleGenAI({ apiKey: key });
  const live: ModelOption[] = [];
  const text: ModelOption[] = [];
  const pager = await ai.models.list({ config: { pageSize: 200 } });
  for await (const m of pager) {
    const id = (m.name ?? '').replace(/^models\//, '');
    const actions = m.supportedActions ?? [];
    const opt = { id, label: m.displayName ? `${m.displayName} (${id})` : id };
    if (actions.includes('bidiGenerateContent')) live.push(opt);
    else if (actions.includes('generateContent') && /^gemini/.test(id) && !/tts|image|embedding/.test(id)) text.push(opt);
  }
  return { live, text };
}

export async function update(patch: Stored): Promise<void> {
  if (patch.apiKey !== undefined) {
    const key = patch.apiKey.trim();
    if (key) {
      try {
        await listModels(key);
      } catch (e) {
        throw new Error(`Gemini rejected this key: ${friendlyError(e)}`);
      }
    }
    stored.apiKey = key || undefined;
  }
  if (patch.liveModel) stored.liveModel = patch.liveModel;
  if (patch.reportModel) stored.reportModel = patch.reportModel;
  if (patch.voice) {
    if (!VOICES.includes(patch.voice)) throw new Error('Unknown voice');
    stored.voice = patch.voice;
  }
  save();
}

/** Extracts the human-readable message from Gemini API errors (which embed JSON). */
export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  try {
    const parsed = JSON.parse(raw.slice(raw.indexOf('{')));
    return parsed?.error?.message ?? raw;
  } catch {
    return raw;
  }
}

// ---------------------------------------------------------------------------
// Model resolution: Gemini model IDs are retired over time (sometimes still
// listed but refused with 404), so pick the newest suitable model unless the
// admin chose one, and skip any model that has been refused.
// ---------------------------------------------------------------------------

let modelCache: { at: number; live: ModelOption[]; text: ModelOption[] } | null = null;
const MODEL_CACHE_MS = 10 * 60_000;
const refused = new Set<string>();

const version = (id: string) => Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0);

function liveScore(id: string) {
  if (/transcribe|translate|robotics|tts/.test(id)) return -100;
  return (/thinking/.test(id) ? -2 : 0) + (/preview|exp/.test(id) ? -1 : 0) + (/latest/.test(id) ? -0.5 : 0);
}

function textScore(id: string) {
  if (/nano|image|omni|customtools|embedding|tts|robotics/.test(id)) return -100;
  return (/flash/.test(id) ? 4 : 0) + (/lite/.test(id) ? -3 : 0) + (/preview|exp/.test(id) ? -1 : 0) + (/latest/.test(id) ? -2 : 0);
}

function best(list: ModelOption[], score: (id: string) => number) {
  return list
    .filter((m) => !refused.has(m.id) && score(m.id) > -100)
    .sort((a, b) => score(b.id) - score(a.id) || version(b.id) - version(a.id))[0]?.id;
}

/** Marks a model as refused by the API so it is never picked again. */
export function markRefused(model: string) {
  refused.add(model);
  if (stored.liveModel === model) stored.liveModel = undefined;
  if (stored.reportModel === model) stored.reportModel = undefined;
  save();
}

/** Returns working live and report models, choosing the newest when unset. */
export async function ensureModels(force = false): Promise<{ liveModel: string; reportModel: string; voice: string }> {
  if (force || !modelCache || Date.now() - modelCache.at > MODEL_CACHE_MS) {
    try {
      modelCache = { at: Date.now(), ...(await listModels()) };
    } catch (e) {
      console.warn('Could not list Gemini models:', friendlyError(e));
      return settings();
    }
  }
  const { live, text } = modelCache;
  const chosenLive = stored.liveModel || process.env.GEMINI_LIVE_MODEL;
  const chosenReport = stored.reportModel || process.env.GEMINI_REPORT_MODEL;
  let changed = false;

  if (!chosenLive || refused.has(chosenLive) || !live.some((m) => m.id === chosenLive)) {
    const next = best(live, liveScore);
    if (next && next !== stored.liveModel) {
      console.log(`Live voice model: ${next}`);
      stored.liveModel = next;
      changed = true;
    }
  }
  if (!chosenReport || refused.has(chosenReport) || !text.some((m) => m.id === chosenReport)) {
    const next = best(text, textScore);
    if (next && next !== stored.reportModel) {
      console.log(`Report model: ${next}`);
      stored.reportModel = next;
      changed = true;
    }
  }
  if (changed) save();
  return settings();
}
