import type {
  AdminSettingsView,
  CandidateInfo,
  ModelOption,
  PublicStatus,
  SessionRecord,
  SessionSummary,
} from '../../../shared/types';

const ADMIN_KEY = 'se-admin-key';

export function adminKey(): string {
  try {
    return sessionStorage.getItem(ADMIN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setAdminKey(k: string) {
  try {
    sessionStorage.setItem(ADMIN_KEY, k);
  } catch {
    /* storage unavailable */
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function req<T>(path: string, init: RequestInit & { admin?: boolean; token?: string } = {}): Promise<T> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.admin) headers['x-admin-key'] = adminKey();
  if (init.token) headers['x-session-token'] = init.token;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Check that it is running.', 0);
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (res.status >= 502 || (res.status === 500 && !body.error)) throw new ApiError('Cannot reach the interview server. Check that it is running.', res.status);
  if (!res.ok) throw new ApiError(body.error ?? `Request failed (${res.status})`, res.status);
  return body as T;
}

export const api = {
  status: () => req<PublicStatus>('/api/status'),
  createSession: (c: CandidateInfo) => req<{ id: string; token: string }>('/api/sessions', { method: 'POST', body: JSON.stringify(c) }),
  feedback: (id: string, token: string) =>
    req<{ status: SessionRecord['reportStatus']; strengths: string[]; practise: { title: string; why: string }[] }>(
      `/api/sessions/${id}/feedback`,
      { token },
    ),

  adminAuth: () => req<{ required: boolean }>('/api/admin/auth'),
  adminLogin: () => req<{ ok: true }>('/api/admin/login', { method: 'POST', admin: true }),
  settings: () => req<AdminSettingsView>('/api/admin/settings', { admin: true }),
  saveSettings: (patch: Partial<{ apiKey: string; liveModel: string; reportModel: string; voice: string }>) =>
    req<AdminSettingsView>('/api/admin/settings', { method: 'PUT', body: JSON.stringify(patch), admin: true }),
  models: () => req<{ live: ModelOption[]; text: ModelOption[] }>('/api/admin/models', { admin: true }),
  sessions: () => req<{ sessions: SessionSummary[]; live: number }>('/api/admin/sessions', { admin: true }),
  session: (id: string) => req<SessionRecord>(`/api/admin/sessions/${id}`, { admin: true }),
  regenerate: (id: string) => req<SessionRecord>(`/api/admin/sessions/${id}/report`, { method: 'POST', admin: true }),
  deleteSession: (id: string) => req<void>(`/api/admin/sessions/${id}`, { method: 'DELETE', admin: true }),
};
