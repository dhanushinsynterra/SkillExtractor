import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

/**
 * Webcam presence check. Runs MediaPipe face detection a few times a second
 * and reports debounced changes: brief glances away don't count, leaving the
 * seat or a second person in frame does.
 */

export type Presence = 'unknown' | 'present' | 'absent' | 'multiple';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.0/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

const INTERVAL_MS = 250;
const ABSENT_AFTER_MS = 3000;
const MULTIPLE_AFTER_MS = 2000;
const PRESENT_AFTER_MS = 800;

let detectorPromise: Promise<FaceDetector> | null = null;

function loadDetector() {
  detectorPromise ??= (async () => {
    const vision = await FilesetResolver.forVisionTasks(WASM);
    const opts = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO' as const,
      minDetectionConfidence: 0.55,
    });
    try {
      return await FaceDetector.createFromOptions(vision, opts('GPU'));
    } catch {
      return await FaceDetector.createFromOptions(vision, opts('CPU'));
    }
  })();
  detectorPromise.catch(() => (detectorPromise = null));
  return detectorPromise;
}

export class Proctor {
  private timer?: number;
  private state: Presence = 'unknown';
  private candidate: Presence = 'unknown';
  private since = 0;
  private stopped = false;

  constructor(
    private video: HTMLVideoElement,
    private onChange: (p: Presence) => void,
  ) {}

  /** Resolves once the detector is running; rejects if it can't load. */
  async start() {
    const detector = await loadDetector();
    if (this.stopped) return;
    const tick = () => {
      if (this.stopped) return;
      const v = this.video;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        let faces = 0;
        try {
          faces = detector.detectForVideo(v, performance.now()).detections.length;
        } catch {
          /* frame not ready */
        }
        this.observe(faces === 0 ? 'absent' : faces > 1 ? 'multiple' : 'present');
      }
      this.timer = window.setTimeout(tick, INTERVAL_MS);
    };
    tick();
  }

  private observe(p: Presence) {
    const now = performance.now();
    if (p !== this.candidate) {
      this.candidate = p;
      this.since = now;
    }
    if (p === this.state) return;
    const need = p === 'absent' ? ABSENT_AFTER_MS : p === 'multiple' ? MULTIPLE_AFTER_MS : PRESENT_AFTER_MS;
    if (this.state === 'unknown' || now - this.since >= need) {
      this.state = p;
      this.onChange(p);
    }
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
  }
}
