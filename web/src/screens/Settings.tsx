import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink, KeyRound, Loader2 } from 'lucide-react';
import type { AdminSettingsView, ModelOption } from '../../../shared/types';
import { AdminShell } from '../components/AdminShell';
import { api } from '../lib/api';

function SettingsView() {
  const [s, setS] = useState<AdminSettingsView | null>(null);
  const [models, setModels] = useState<{ live: ModelOption[]; text: ModelOption[] } | null>(null);
  const [modelsErr, setModelsErr] = useState<string | null>(null);
  const [key, setKey] = useState('');
  const [form, setForm] = useState({ liveModel: '', reportModel: '', voice: '' });
  const [busy, setBusy] = useState<'key' | 'prefs' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadModels = () => {
    setModelsErr(null);
    api
      .models()
      .then(setModels)
      .catch((e) => setModelsErr(e.message));
  };

  useEffect(() => {
    api.settings().then((v) => {
      setS(v);
      setForm({ liveModel: v.liveModel, reportModel: v.reportModel, voice: v.voice });
      if (v.hasKey) loadModels();
    });
  }, []);

  async function saveKey(e: React.FormEvent) {
    e.preventDefault();
    setBusy('key');
    setMsg(null);
    try {
      const v = await api.saveSettings({ apiKey: key });
      setS(v);
      setKey('');
      setMsg({ ok: true, text: 'API key verified and saved.' });
      loadModels();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    setBusy('prefs');
    setMsg(null);
    try {
      setS(await api.saveSettings(form));
      setMsg({ ok: true, text: 'Settings saved. New interviews will use them.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!s)
    return (
      <main className="app-main center-block">
        <Loader2 className="spin" size={18} />
      </main>
    );

  const withCurrent = (list: ModelOption[] | undefined, current: string) =>
    list && !list.some((m) => m.id === current) && current ? [{ id: current, label: `${current} (current)` }, ...list] : (list ?? []);

  return (
    <main className="app-main narrow">
      <div className="dash-head">
        <div>
          <h1 data-route-focus tabIndex={-1}>
            Settings
          </h1>
          <p className="muted">Gemini connection and interviewer voice.</p>
        </div>
      </div>

      {msg && (
        <div className={`notice ${msg.ok ? 'notice--ok' : 'notice--warn'}`} role="status">
          {msg.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{msg.text}</span>
        </div>
      )}
      {!s.authRequired && (
        <div className="notice notice--warn">
          <AlertTriangle size={16} />
          <span>
            The admin console has no password. Set <code>ADMIN_PASSWORD</code> in <code>server/.env</code> before exposing this server.
          </span>
        </div>
      )}

      <form className="card settings-card" onSubmit={saveKey}>
        <div className="settings-head">
          <h3>
            <KeyRound size={15} /> Gemini API key
          </h3>
          {s.hasKey ? (
            <span className="status status--ok">
              Connected {s.keyHint} {s.keySource === 'env' && '· from environment'}
            </span>
          ) : (
            <span className="status status--warn">Not configured</span>
          )}
        </div>
        <p className="muted small">
          Powers the live voice interview and report writing. The key is stored on the server and never sent to candidates.{' '}
          <a className="link" href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
            Get a key <ExternalLink size={12} />
          </a>
        </p>
        <div className="inline-field">
          <label htmlFor="key" className="sr-only">
            API key
          </label>
          <input id="key" type="password" autoComplete="off" placeholder={s.hasKey ? 'Enter a new key to replace it' : 'Paste your Gemini API key'} value={key} onChange={(e) => setKey(e.target.value)} />
          <button className="btn btn--primary" disabled={!key.trim() || busy === 'key'}>
            {busy === 'key' && <Loader2 size={14} className="spin" />} Verify and save
          </button>
        </div>
      </form>

      <form className="card settings-card" onSubmit={savePrefs}>
        <div className="settings-head">
          <h3>Interview</h3>
          {modelsErr && <span className="status status--warn">Could not list models</span>}
        </div>
        <div className="settings-grid">
          <div className="field">
            <label htmlFor="voice">Interviewer voice</label>
            <select id="voice" value={form.voice} onChange={(e) => setForm({ ...form, voice: e.target.value })}>
              {s.voices.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="live">Live voice model</label>
            <select id="live" value={form.liveModel} onChange={(e) => setForm({ ...form, liveModel: e.target.value })} disabled={!models}>
              {withCurrent(models?.live, form.liveModel).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              {!models && <option value={form.liveModel}>{form.liveModel}</option>}
            </select>
          </div>
          <div className="field">
            <label htmlFor="report">Report model</label>
            <select id="report" value={form.reportModel} onChange={(e) => setForm({ ...form, reportModel: e.target.value })} disabled={!models}>
              {withCurrent(models?.text, form.reportModel).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
              {!models && <option value={form.reportModel}>{form.reportModel}</option>}
            </select>
          </div>
        </div>
        <p className="muted small">
          {models
            ? 'Models listed are the ones your API key can access. Pick a native-audio model for the most natural voice.'
            : s.hasKey
              ? modelsErr ?? 'Loading models…'
              : 'Add an API key to choose models.'}
        </p>
        <div className="settings-actions">
          <button className="btn btn--primary" disabled={busy === 'prefs'}>
            {busy === 'prefs' && <Loader2 size={14} className="spin" />} Save
          </button>
        </div>
      </form>
    </main>
  );
}

export default function Settings() {
  return (
    <AdminShell>
      <SettingsView />
    </AdminShell>
  );
}
