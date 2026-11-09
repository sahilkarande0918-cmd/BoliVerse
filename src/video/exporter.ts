import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, WebMOutputFormat, canEncodeVideo } from 'mediabunny'

// Real video export of the live scene. Preference order:
//   1. MP4 / H.264 via WebCodecs (Mediabunny muxer) — frame-exact offline capture
//   2. WebM / VP9 or VP8 via WebCodecs — frame-exact, labelled honestly as WebM
//   3. MediaRecorder WebM — realtime capture, for browsers without WebCodecs
// No audio track: exports are silent and labelled as such.

export interface Plan { kind: 'webcodecs'; container: 'mp4' | 'webm'; codec: 'avc' | 'vp9' | 'vp8' }
export type ExportPlan = Plan | { kind: 'mediarecorder'; mime: string } | { kind: 'none' }

export async function pickExport(width: number, height: number): Promise<ExportPlan> {
  if (typeof VideoEncoder !== 'undefined') {
    for (const [container, codec] of [['mp4', 'avc'], ['webm', 'vp9'], ['webm', 'vp8']] as const) {
      try {
        if (await canEncodeVideo(codec, { width, height, bitrate: QUALITY_HIGH })) return { kind: 'webcodecs', container, codec }
      } catch { /* try next */ }
    }
  }
  if (typeof MediaRecorder !== 'undefined') {
    const mime = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m))
    if (mime) return { kind: 'mediarecorder', mime }
  }
  return { kind: 'none' }
}

export async function encodeFrames(opts: {
  canvas: HTMLCanvasElement
  plan: Plan
  fps: number
  frames: number
  renderFrame: (i: number) => void
  onProgress: (p: number) => void
  cancelled: () => boolean
}): Promise<Blob | null> {
  const { canvas, plan, fps, frames } = opts
  const output = new Output({ format: plan.container === 'mp4' ? new Mp4OutputFormat({ fastStart: 'in-memory' }) : new WebMOutputFormat(), target: new BufferTarget() })
  const source = new CanvasSource(canvas, { codec: plan.codec, bitrate: QUALITY_HIGH, keyFrameInterval: 2, sizeChangeBehavior: 'contain' })
  output.addVideoTrack(source, { frameRate: fps })
  await output.start()
  for (let i = 0; i < frames; i++) {
    if (opts.cancelled()) { await output.cancel(); return null }
    opts.renderFrame(i)
    await source.add(i / fps, 1 / fps)
    if (i % 5 === 0) opts.onProgress(i / frames)
  }
  await output.finalize()
  const buf = (output.target as BufferTarget).buffer
  return buf ? new Blob([buf], { type: plan.container === 'mp4' ? 'video/mp4' : 'video/webm' }) : null
}

export function recordRealtime(canvas: HTMLCanvasElement, mime: string, seconds: number, cancelled: () => boolean): Promise<Blob | null> {
  return new Promise((resolve) => {
    const rec = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 8_000_000 })
    const parts: Blob[] = []
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data)
    rec.onstop = () => resolve(cancelled() ? null : new Blob(parts, { type: 'video/webm' }))
    rec.start(250)
    const t0 = performance.now()
    const tick = () => (cancelled() || performance.now() - t0 > seconds * 1000 ? rec.stop() : requestAnimationFrame(tick))
    tick()
  })
}
