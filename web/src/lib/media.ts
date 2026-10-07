import { useEffect, useRef, useState } from 'react';

/**
 * One shared MediaStream for the device check and the session, so the
 * candidate is only asked for permission once.
 */
let shared: MediaStream | null = null;

export type MediaStatus = 'idle' | 'asking' | 'ready' | 'denied' | 'unavailable';

export async function acquireMedia(video: boolean): Promise<MediaStream> {
  const hasVideo = shared?.getVideoTracks().some((t) => t.readyState === 'live');
  if (shared && (!video || hasVideo)) return shared;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
  releaseMedia();
  shared = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' } : false,
  });
  return shared;
}

export function currentMedia() {
  return shared;
}

export function releaseMedia() {
  shared?.getTracks().forEach((t) => t.stop());
  shared = null;
}

/**
 * Streams a smoothed 0..1 microphone level. Writes it to `--level` on the
 * target element every frame (cheap, no re-render) and to React state ~10x/s.
 */
export function useMicLevel(stream: MediaStream | null, target?: React.RefObject<HTMLElement | null>) {
  const [level, setLevel] = useState(0);
  const peakRef = useRef(0);

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    const ctx = new AudioContext();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    let smooth = 0;
    let raf = 0;
    let last = 0;

    const tick = (t: number) => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      const lvl = Math.min(1, rms * 6);
      smooth = smooth * 0.75 + lvl * 0.25;
      peakRef.current = Math.max(peakRef.current, smooth);
      target?.current?.style.setProperty('--level', smooth.toFixed(3));
      if (t - last > 100) {
        last = t;
        setLevel(smooth);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      src.disconnect();
      ctx.close();
    };
  }, [stream, target]);

  return { level, peak: peakRef };
}

export interface NetworkResult {
  latencyMs: number;
  type: string | null;
  quality: 'good' | 'ok' | 'weak';
}

export async function checkNetwork(): Promise<NetworkResult> {
  const samples: number[] = [];
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      await fetch(`/api/status?ping=${Date.now()}-${i}`, { cache: 'no-store' });
      samples.push(performance.now() - t0);
    } catch {
      samples.push(2000);
    }
  }
  const latencyMs = Math.round(samples.sort((a, b) => a - b)[1]);
  const conn = (navigator as Navigator & { connection?: { effectiveType?: string } }).connection;
  const type = conn?.effectiveType ?? null;
  const quality = latencyMs < 250 && type !== '3g' && type !== '2g' ? 'good' : latencyMs < 800 ? 'ok' : 'weak';
  return { latencyMs, type, quality };
}
