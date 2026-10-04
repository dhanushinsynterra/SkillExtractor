import type { CodeCardView } from '@skillx/shared'

/** Read-only view: the candidate changes it only by dictating edits to the AI. */
export function CodeCard({ card }: { card: CodeCardView }) {
  return (
    <section className="code-card card" aria-label="Code card">
      <header>
        <h3>{card.title}</h3>
        <span className={`pill ${card.solved ? 'pill-good' : ''}`}>
          {card.solved ? 'Working' : `${card.edits} edit${card.edits === 1 ? '' : 's'}`}
        </span>
      </header>
      <p className="muted">{card.prompt}</p>
      <pre className="code" aria-label={`${card.language} code`}>
        {card.lines.map((line, i) => (
          <div key={i} className="code-line">
            <span className="ln">{i + 1}</span>
            <code>{line || ' '}</code>
          </div>
        ))}
      </pre>
      <p className="hint">Tell Sage exactly what to change, for example “replace line 3 with …”.</p>
    </section>
  )
}
