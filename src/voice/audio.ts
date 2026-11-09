// Microphone capture → 16 kHz mono 16-bit WAV (Gnani accepts WAV/MP3/OGG/FLAC/AAC/M4A, not WebM,
// so we encode PCM ourselves instead of using MediaRecorder).

const WORKLET = `class Tap extends AudioWorkletProcessor{process(i){const c=i[0]&&i[0][0];if(c)this.port.postMessage(c.slice(0));return true}}registerProcessor('tap',Tap)`

export interface Capture {
  stop(): Promise<Blob>
  cancel(): void
}

export async function startCapture(opts: { onLevel: (rms: number) => void; onAutoStop: () => void; maxMs?: number }): Promise<Capture> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
  const ctx = new AudioContext()
  const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }))
  await ctx.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
  const src = ctx.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(ctx, 'tap')
  const chunks: Float32Array[] = []
  let spoke = false
  let silentSince = 0
  const started = performance.now()
  // Simple energy VAD: auto-stop after ~1.3 s of silence once speech was heard.
  node.port.onmessage = (e: MessageEvent<Float32Array>) => {
    chunks.push(e.data)
    let s = 0
    for (const v of e.data) s += v * v
    const rms = Math.sqrt(s / e.data.length)
    opts.onLevel(rms)
    const now = performance.now()
    if (rms > 0.025) { spoke = true; silentSince = 0 }
    else if (spoke) {
      silentSince ||= now
      if (now - silentSince > 1300) opts.onAutoStop()
    }
    if (now - started > (opts.maxMs ?? 25_000)) opts.onAutoStop()
  }
  src.connect(node)
  const close = () => {
    node.port.onmessage = null
    src.disconnect()
    stream.getTracks().forEach((t) => t.stop())
    void ctx.close()
  }
  return {
    async stop() {
      const rate = ctx.sampleRate
      close()
      return encodeWav(downsample(concat(chunks), rate, 16000), 16000)
    },
    cancel: close,
  }
}

function concat(parts: Float32Array[]) {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) { out.set(p, o); o += p.length }
  return out
}

export function downsample(input: Float32Array, from: number, to: number) {
  if (from === to) return input
  const ratio = from / to
  const out = new Float32Array(Math.floor(input.length / ratio))
  for (let i = 0; i < out.length; i++) {
    // box filter over the source window — enough anti-aliasing for speech
    const a = Math.floor(i * ratio), b = Math.min(input.length, Math.floor((i + 1) * ratio))
    let s = 0
    for (let j = a; j < b; j++) s += input[j]
    out[i] = s / Math.max(1, b - a)
  }
  return out
}

export function encodeWav(samples: Float32Array, rate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2)
  const v = new DataView(buf)
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true)
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data')
  v.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, samples[i])) * 0x7fff, true)
  return new Blob([buf], { type: 'audio/wav' })
}
