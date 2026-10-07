import { navigate } from '../lib/router';

export function Logo({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="var(--fg)" />
      <g stroke="var(--bg)" strokeWidth="2" strokeLinecap="round">
        <path d="M7 10.5v3" />
        <path d="M10.3 8v8" />
        <path d="M13.7 9.5v5" />
        <path d="M17 11v2" />
      </g>
    </svg>
  );
}

export function Brand({ to = '/', suffix }: { to?: string; suffix?: string }) {
  return (
    <a
      className="brand"
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault();
        navigate(to, 'back');
      }}
    >
      <Logo />
      <span className="brand-name">SkillExtractor</span>
      {suffix && <span className="brand-suffix">{suffix}</span>}
    </a>
  );
}

export function TopBar({ children, home = '/', suffix }: { children?: React.ReactNode; home?: string; suffix?: string }) {
  return (
    <header className="topbar">
      <Brand to={home} suffix={suffix} />
      <div className="topbar-end">{children}</div>
    </header>
  );
}

/** Stepper shown across the candidate onboarding screens. */
export function Steps({ at }: { at: 0 | 1 | 2 }) {
  const steps = ['Your details', 'Device check', 'Interview'];
  return (
    <ol className="steps" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className={i < at ? 'done' : i === at ? 'current' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="steps-dot">{i + 1}</span>
          <span className="steps-label">{s}</span>
        </li>
      ))}
    </ol>
  );
}
