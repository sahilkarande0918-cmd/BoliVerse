import { env, fetchWithTimeout, guard, json, readLimited } from './_lib.js'

// Gnani Prisma speech-to-text relay (REST, ≤30 s utterances). The browser cannot attach the
// X-API-Key-ID header itself, so audio comes here and is forwarded server-side.
const MAX = 2_500_000 // ~30 s of 16 kHz 16-bit mono WAV is ~960 KB
const LANGS = new Set(['indic-auto', 'hi-IN', 'mr-IN', 'en-IN', 'hi-IN,en-IN', 'mr-IN,en-IN', 'hi-IN,mr-IN,en-IN'])

export default {
  async fetch(req: Request) {
    const blocked = guard(req, { maxBytes: MAX, perMinute: 20, route: 'stt' })
    if (blocked) return blocked
    const key = env('GNANI_API_KEY')
    if (!key) return json({ error: 'Gnani is not configured on this deployment (GNANI_API_KEY missing)', code: 'NO_KEY' }, 503)

    const url = new URL(req.url)
    const lang = url.searchParams.get('lang') ?? 'indic-auto'
    if (!LANGS.has(lang)) return json({ error: 'Unsupported language code' }, 400)
    const audio = await readLimited(req, MAX)
    if (!audio || audio.byteLength < 2000) return json({ error: 'Audio missing or too large' }, 400)

    const model = env('GNANI_STT_MODEL') ?? 'prisma-v3.0'
    const form = new FormData()
    form.append('audio_file', new Blob([audio], { type: 'audio/wav' }), 'utterance.wav')
    form.append('model', model)
    form.append('language_code', lang)
    if (model === 'prisma-v3.0') form.append('format', 'codemix')
    form.append('topic', 'Voice commands for a 3D world editor: village, river, bridge, house, tree, camera, video, sunset, rain.')

    const t0 = Date.now()
    let res: Response
    try {
      res = await fetchWithTimeout(`${env('GNANI_API_BASE_URL') ?? 'https://api.vachana.ai'}/stt/v3`, { method: 'POST', headers: { 'X-API-Key-ID': key }, body: form }, 20_000)
    } catch {
      return json({ error: 'Gnani did not respond in time', code: 'UPSTREAM_TIMEOUT' }, 504)
    }
    const body = await res.json().catch(() => ({}))
    if (!res.ok || body.success === false) {
      const msg = body?.error?.message ?? body?.detail?.message ?? (Array.isArray(body?.detail) ? 'Invalid request' : `Gnani error ${res.status}`)
      const code = res.status === 402 ? 'NO_CREDIT' : res.status === 429 ? 'RATE_LIMIT' : body?.error?.type ?? 'UPSTREAM'
      return json({ error: msg, code }, res.status === 401 ? 502 : res.status)
    }
    return json({
      transcript: body.transcript ?? '',
      language: body.detected_language_code ?? lang,
      model: body.model ?? model,
      providerLatencyMs: Math.round((body.end_to_end_latency ?? 0) * 1000),
      relayMs: Date.now() - t0,
    })
  },
}
