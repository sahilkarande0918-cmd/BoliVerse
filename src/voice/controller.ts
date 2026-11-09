import { useStudio } from '../store'
import { ApiError, transcribe } from './api'
import { type Capture, startCapture } from './audio'

// One microphone session at a time, shared by every mic button (desktop panel, mobile sheet, FAB).
let capture: Capture | null = null
let stopping = false
let lastLevel = 0
/** last ~85 ms of mic samples for the waveform visualiser */
export const wave = new Float32Array(4096)
let waveAt = 0
export const waveHead = () => waveAt

export async function toggleMic() {
  const s = useStudio.getState()
  if (capture) return finish()
  if (s.phase === 'transcribing' || s.phase === 'interpreting') return
  if (s.health && !s.health.gnani) {
    s.set({ phase: 'error', message: 'Gnani speech is not configured on this deployment — type commands instead.' })
    return
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    s.set({ phase: 'error', message: 'This browser has no microphone API (needs HTTPS). Type commands instead.' })
    return
  }
  try {
    s.set({ phase: 'listening', message: 'Listening… speak, then pause (auto-stops after silence)' })
    capture = await startCapture({
      onLevel: (rms, samples) => {
        for (const v of samples) { wave[waveAt] = v; waveAt = (waveAt + 1) % wave.length }
        const now = performance.now()
        if (now - lastLevel > 60) { lastLevel = now; useStudio.getState().set({ level: Math.min(1, rms * 9) }) }
      },
      onAutoStop: () => void finish(),
    })
  } catch (e) {
    capture = null
    const denied = (e as Error).name === 'NotAllowedError'
    s.set({ phase: 'error', level: 0, message: denied ? 'Microphone permission denied — allow the mic in the address bar, or type commands.' : `Microphone error: ${(e as Error).message}` })
  }
}

async function finish() {
  if (!capture || stopping) return
  stopping = true
  const c = capture
  const speechEnd = performance.now()
  try {
    const wav = await c.stop()
    capture = null
    const s = useStudio.getState()
    s.set({ phase: 'transcribing', level: 0, message: 'Gnani Prisma is transcribing…', sttCalls: s.sttCalls + 1 })
    const t = performance.now()
    const r = await transcribe(wav, s.language)
    const stt = performance.now() - t
    if (!r.transcript.trim()) {
      useStudio.getState().set({ phase: 'error', message: 'Gnani heard silence — try again a little closer to the mic.' })
      return
    }
    await useStudio.getState().run(r.transcript, 'voice', { stt, t0: speechEnd, language: r.language, provider: `Gnani ${r.model} · provider ${r.providerLatencyMs} ms` })
  } catch (e) {
    const code = e instanceof ApiError ? e.code : undefined
    const msg = code === 'NO_CREDIT' ? 'Gnani credits exhausted — voice is paused; typed commands still work.'
      : code === 'RATE_LIMIT' ? 'Gnani rate limit (one request at a time) — wait a second and retry.'
      : code === 'DEMO_TOKEN' ? 'This deployment needs a demo access token for voice.'
      : `Transcription failed: ${(e as Error).message}`
    useStudio.getState().set({ phase: 'error', message: msg })
  } finally {
    capture = null
    stopping = false
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('boliverse:mic', () => void toggleMic())
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.repeat || (e.target as HTMLElement)?.closest('input,textarea,select,button')) return
    if (!location.hash.startsWith('#/studio')) return
    e.preventDefault()
    void toggleMic()
  })
}
