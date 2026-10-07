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
