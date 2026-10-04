import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { TranscriptEntry } from '@skillx/shared'

interface Props {
  entries: TranscriptEntry[]
  candidateName: string
  onSend: (text: string) => void
  disabled: boolean
}

/** Live captions, plus a typed fallback for accessibility or a flaky mic. */
export function Transcript({ entries, candidateName, onSend, disabled }: Props) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [entries])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <section className="transcript card" aria-label="Conversation transcript">
      <div className="transcript-list" aria-live="polite">
        {entries.length === 0 && <p className="muted">Captions will appear here as you talk.</p>}
        {entries
          .filter((e) => e.role !== 'system')
          .map((e, i) => (
            <p key={i} className={`line line-${e.role}`}>
              <span className="who">{e.role === 'ai' ? 'Sage' : candidateName}</span>
              {e.text}
            </p>
          ))}
        <div ref={endRef} />
      </div>
      <form className="type-box" onSubmit={submit}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Prefer typing? Write here…"
          aria-label="Type a message"
          disabled={disabled}
        />
        <button type="submit" className="btn btn-quiet" disabled={disabled || !draft.trim()}>
          Send
        </button>
      </form>
    </section>
  )
}
