import { forwardRef } from 'react';

export type VoiceState = 'idle' | 'listening' | 'speaking' | 'thinking' | 'ended';

const BARS = 9;

/**
 * Audio activity indicator. Bars follow the candidate's mic level (via the
 * --level custom property) while listening and animate while the AI speaks.
 */
export const Voice = forwardRef<HTMLDivElement, { state: VoiceState; size?: 'sm' | 'md' | 'lg'; label?: string }>(function Voice(
  { state, size = 'lg', label },
  ref,
) {
  return (
    <div ref={ref} className={`voice voice--${state} voice--${size}`} role="img" aria-label={label ?? `Interviewer is ${state}`}>
      {Array.from({ length: BARS }, (_, i) => (
        <span key={i} style={{ '--i': i, '--w': 1 - Math.abs(i - (BARS - 1) / 2) / BARS } as React.CSSProperties} />
      ))}
    </div>
  );
});
