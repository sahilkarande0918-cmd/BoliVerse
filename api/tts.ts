import { env, fetchWithTimeout, guard, json } from './_lib.js'

// Gnani Timbre text-to-speech relay for short spoken confirmations.
export default {
  async fetch(req: Request) {
    const blocked = guard(req, { maxBytes: 4_000, perMinute: 20, route: 'tts' })
    if (blocked) return blocked
    const key = env('GNANI_API_KEY')
    if (!key) return json({ error: 'Gnani is not configured', code: 'NO_KEY' }, 503)
    const { text, language } = (await req.json().catch(() => ({}))) as { text?: string; language?: string }
    if (!text || typeof text !== 'string' || text.length > 300) return json({ error: 'text must be 1–300 characters' }, 400)
    const lang = ['hi-IN', 'mr-IN', 'en-IN', 'hi-en', 'auto'].includes(language ?? '') ? language : 'auto'

    let res: Response
    try {
      res = await fetchWithTimeout(
        `${env('GNANI_API_BASE_URL') ?? 'https://api.vachana.ai'}/api/v1/tts/inference`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'X-API-Key-ID': key },
          body: JSON.stringify({
            text,
            model: env('GNANI_TTS_MODEL') ?? 'timbre-v3.0',
            voice: env('GNANI_TTS_VOICE') ?? 'Shivani',
            language: lang,
            speed: 1.0,
            audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'mp3', bitrate: 64000 },
          }),
        },
        15_000,
      )
    } catch {
      return json({ error: 'Timbre did not respond in time' }, 504)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return json({ error: body?.error?.message ?? body?.detail?.message ?? `Timbre error ${res.status}` }, res.status === 401 ? 502 : res.status)
    }
    return new Response(await res.arrayBuffer(), { headers: { 'content-type': res.headers.get('content-type') ?? 'audio/mpeg', 'cache-control': 'no-store' } })
  },
}
