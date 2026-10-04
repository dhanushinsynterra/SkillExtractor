import { FaceLandmarker, FilesetResolver, ObjectDetector, type FaceLandmarkerResult } from '@mediapipe/tasks-vision'
import type { IntegrityEvent } from '@skillx/shared'

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm'
const FACE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'
const OBJECT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/1/efficientdet_lite0.tflite'

const FACE_INTERVAL_MS = 200
const OBJECT_INTERVAL_MS = 1000
/** Report an ongoing glance/absence every this often once it passes the floor. */
const ONGOING_EVERY_MS = 2000
const ONGOING_FLOOR_MS = 3000

const YAW_LIMIT = 28
const PITCH_LIMIT = 22
const EYE_LOOK_LIMIT = 0.7

export interface GazeReading {
  facePresent: boolean
  faces: number
  lookingAway: boolean
  yaw: number
  pitch: number
}

/** Head yaw/pitch (degrees) from MediaPipe's column-major 4x4 face transform. */
export function headAngles(m: number[]): { yaw: number; pitch: number } {
  const deg = 180 / Math.PI
  return {
    yaw: Math.atan2(m[8], m[10]) * deg,
    pitch: Math.asin(Math.max(-1, Math.min(1, -m[9]))) * deg,
  }
}

export function readGaze(result: FaceLandmarkerResult): GazeReading {
  const faces = result.faceLandmarks.length
  if (!faces) return { facePresent: false, faces: 0, lookingAway: false, yaw: 0, pitch: 0 }
  const matrix = result.facialTransformationMatrixes[0]?.data
  const { yaw, pitch } = matrix ? headAngles(matrix) : { yaw: 0, pitch: 0 }
  const shapes = result.faceBlendshapes[0]?.categories ?? []
  const eyeLook = Math.max(
    0,
    ...shapes.filter((c) => c.categoryName.startsWith('eyeLook')).map((c) => c.score),
  )
  const lookingAway = Math.abs(yaw) > YAW_LIMIT || Math.abs(pitch) > PITCH_LIMIT || eyeLook > EYE_LOOK_LIMIT
  return { facePresent: true, faces, lookingAway, yaw, pitch }
}

/** Tracks how long a condition has held and emits ongoing/final duration events. */
class DurationTracker {
  private since: number | null = null
  private lastOngoing = 0

  private readonly type: IntegrityEvent['type']
  private readonly emit: (e: IntegrityEvent) => void

  constructor(type: IntegrityEvent['type'], emit: (e: IntegrityEvent) => void) {
    this.type = type
    this.emit = emit
  }

  update(active: boolean, now: number): void {
    if (active) {
      if (this.since === null) {
        this.since = now
        this.lastOngoing = now
      }
      const duration = now - this.since
      if (duration >= ONGOING_FLOOR_MS && now - this.lastOngoing >= ONGOING_EVERY_MS) {
        this.lastOngoing = now
        this.emit({ type: this.type, at: new Date().toISOString(), durationMs: duration, ongoing: true })
      }
    } else if (this.since !== null) {
      const duration = now - this.since
      this.since = null
      this.emit({ type: this.type, at: new Date().toISOString(), durationMs: duration })
    }
  }
}

export interface Proctor {
  stop(): void
}

/**
 * Runs face landmarking (~5 fps) and phone detection (~1 fps) on the webcam
 * video. Brief glances are reported too: the server builds an adaptive
 * per-candidate threshold from them.
 */
export async function startProctor(
  video: HTMLVideoElement,
  emit: (e: IntegrityEvent) => void,
  onGaze?: (g: GazeReading) => void,
): Promise<Proctor> {
  const fileset = await FilesetResolver.forVisionTasks(WASM)
  const [faces, objects] = await Promise.all([
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: FACE_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numFaces: 2,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    }),
    ObjectDetector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: OBJECT_MODEL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      scoreThreshold: 0.5,
      categoryAllowlist: ['cell phone'],
    }),
  ])

  const gaze = new DurationTracker('gaze_away', emit)
  const absence = new DurationTracker('no_face', emit)
  let extraFaceFrames = 0
  let phoneFrames = 0
  let lastFace = 0
  let lastObject = 0
  let raf = 0
  let stopped = false

  const tick = () => {
    if (stopped) return
    raf = requestAnimationFrame(tick)
    if (video.readyState < 2) return
    const now = performance.now()

    if (now - lastFace >= FACE_INTERVAL_MS) {
      lastFace = now
      const reading = readGaze(faces.detectForVideo(video, now))
      onGaze?.(reading)
      absence.update(!reading.facePresent, now)
      gaze.update(reading.facePresent && reading.lookingAway, now)

      extraFaceFrames = reading.faces > 1 ? extraFaceFrames + 1 : 0
      // ~2 s of a second face, to ignore single-frame false positives.
      if (extraFaceFrames === 10) {
        emit({ type: 'multiple_faces', at: new Date().toISOString(), confidence: 0.8 })
      }
    }

    if (now - lastObject >= OBJECT_INTERVAL_MS) {
      lastObject = now
      const result = objects.detectForVideo(video, now)
      const phone = result.detections
        .flatMap((d) => d.categories)
        .find((c) => c.categoryName === 'cell phone')
      phoneFrames = phone ? phoneFrames + 1 : 0
      if (phone && phoneFrames === 2) {
        emit({ type: 'phone_detected', at: new Date().toISOString(), confidence: phone.score })
      }
    }
  }
  raf = requestAnimationFrame(tick)

  return {
    stop() {
      stopped = true
      cancelAnimationFrame(raf)
      faces.close()
      objects.close()
    },
  }
}

/** Reports time spent on another tab or window. */
export function watchVisibility(emit: (e: IntegrityEvent) => void): () => void {
  let hiddenAt: number | null = null
  const onChange = () => {
    if (document.hidden) {
      hiddenAt = performance.now()
    } else if (hiddenAt !== null) {
      emit({ type: 'tab_hidden', at: new Date().toISOString(), durationMs: performance.now() - hiddenAt })
      hiddenAt = null
    }
  }
  document.addEventListener('visibilitychange', onChange)
  return () => document.removeEventListener('visibilitychange', onChange)
}
