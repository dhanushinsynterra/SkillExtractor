/**
 * Thin wrappers over the browser's Web Speech APIs, used by the demo engine
 * until the Gemini Live backend is connected. Both degrade to no-ops.
 */

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const RecognitionCtor: (new () => Recognition) | undefined =
  (window as unknown as { SpeechRecognition?: new () => Recognition }).SpeechRecognition ??
  (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

export const canRecognise = Boolean(RecognitionCtor);
export const canSpeak = 'speechSynthesis' in window;

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'en-IN' && /female|heera|neerja|veena/i.test(v.name)) ??
    voices.find((v) => v.lang === 'en-IN') ??
    voices.find((v) => v.lang.startsWith('en-GB')) ??
    voices.find((v) => v.lang.startsWith('en'))
  );
}

if (canSpeak) speechSynthesis.getVoices();

export function speak(text: string, onBoundary?: () => void): Promise<void> {
  return new Promise((resolve) => {
    if (!canSpeak) {
      setTimeout(resolve, Math.min(6000, 600 + text.length * 35));
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v?.lang ?? 'en-IN';
    u.rate = 1.02;
    u.pitch = 1.05;
    // Some engines never fire onend (or have no voices); don't hang the chat.
    const fallback = setTimeout(resolve, 1500 + text.length * 65);
    const finish = () => {
      clearTimeout(fallback);
      resolve();
    };
    u.onboundary = () => onBoundary?.();
    u.onend = finish;
    u.onerror = finish;
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (canSpeak) speechSynthesis.cancel();
}

/** Listens for one utterance. Calls onInterim with partial text. */
export function listenOnce(onInterim: (t: string) => void): { done: Promise<string>; cancel: () => void } {
  if (!RecognitionCtor) return { done: Promise.resolve(''), cancel: () => {} };
  const rec = new RecognitionCtor();
  rec.lang = 'en-IN';
  rec.continuous = false;
  rec.interimResults = true;
  let finalText = '';
  let cancelled = false;
  const done = new Promise<string>((resolve) => {
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      onInterim((finalText + interim).trim());
    };
    rec.onend = () => resolve(cancelled ? '' : finalText.trim());
    rec.onerror = () => resolve('');
  });
  try {
    rec.start();
  } catch {
    return { done: Promise.resolve(''), cancel: () => {} };
  }
  return {
    done,
    cancel: () => {
      cancelled = true;
      rec.abort();
    },
  };
}
