export function Done({ outcome, reason }: { outcome: 'ended' | 'terminated'; reason: string | null }) {
  return (
    <main className="screen narrow">
      <div className="card center">
        {outcome === 'ended' ? (
          <>
            <h1>Thanks for the chat!</h1>
            <p>That’s everything. The team will review the conversation and get back to you soon.</p>
            <p className="muted">You can close this window now.</p>
          </>
        ) : (
          <>
            <h1>The session has ended</h1>
            <p>{reason ?? 'The session was stopped.'}</p>
            <p className="muted">If you think this was a mistake, please contact the recruiter who invited you.</p>
          </>
        )}
      </div>
    </main>
  )
}
