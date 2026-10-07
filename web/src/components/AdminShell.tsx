import { useEffect, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { api, ApiError, adminKey, setAdminKey } from '../lib/api';
import { navigate, useRoute } from '../lib/router';
import { TopBar } from './Chrome';

type Gate = 'checking' | 'login' | 'open' | 'error';

/** Admin chrome: password gate (when ADMIN_PASSWORD is set) and navigation. */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = useRoute();
  const [gate, setGate] = useState<Gate>('checking');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { required } = await api.adminAuth();
        if (!required) return setGate('open');
        if (adminKey()) {
          await api.adminLogin();
          return setGate('open');
        }
        setGate('login');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) setGate('login');
        else {
          setErr(e instanceof Error ? e.message : String(e));
          setGate('error');
        }
      }
    })();
  }, []);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setAdminKey(pw);
    try {
      await api.adminLogin();
      setGate('open');
    } catch (e) {
      setErr(e instanceof ApiError && e.status === 401 ? 'Incorrect password.' : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const nav = [
    { to: '/admin', label: 'Interviews', on: path === '/admin' || path.startsWith('/admin/report') },
    { to: '/admin/settings', label: 'Settings', on: path === '/admin/settings' },
  ];

  return (
    <div className="app">
      <TopBar home="/admin" suffix="Admin">
        {gate === 'open' && (
          <nav className="admin-nav" aria-label="Admin">
            {nav.map((n) => (
              <a
                key={n.to}
                href={`#${n.to}`}
                className={n.on ? 'is-on' : ''}
                aria-current={n.on ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(n.to);
                }}
              >
                {n.label}
              </a>
            ))}
          </nav>
        )}
      </TopBar>
      {gate === 'checking' && (
        <main className="app-main center-block">
          <Loader2 className="spin" size={18} />
        </main>
      )}
      {gate === 'login' && (
        <main className="app-main center-block">
          <form className="panel login" onSubmit={login}>
            <span className="fact-icon">
              <Lock size={16} />
            </span>
            <h1 data-route-focus tabIndex={-1}>
              Admin sign in
            </h1>
            <div className="field">
              <label htmlFor="pw">Password</label>
              <input id="pw" type="password" autoComplete="current-password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {err && <p className="field-err">{err}</p>}
            <button className="btn btn--primary btn--block" disabled={!pw || busy}>
              {busy && <Loader2 size={14} className="spin" />} Sign in
            </button>
          </form>
        </main>
      )}
      {gate === 'error' && (
        <main className="app-main center-block">
          <p>{err}</p>
          <button className="btn btn--ghost btn--sm" onClick={() => location.reload()}>
            Retry
          </button>
        </main>
      )}
      {gate === 'open' && children}
    </div>
  );
}
