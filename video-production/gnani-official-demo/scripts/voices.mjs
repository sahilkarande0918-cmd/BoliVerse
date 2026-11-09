// Generates every line with Gnani Timbre, then sends each builder clip through the app's real
// /api/stt relay (Gnani Prisma). Needs `npm run dev` on :5173 and GNANI_API_KEY in .env.local.
// Usage: node scripts/voices.mjs [id ...]   (no ids = all missing lines)
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { LINES, NARRATOR, BUILDER } from './lines.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const out = `${root}raw/voice/`
const env = Object.fromEntries(readFileSync(`${root}../../.env.local`, 'utf8').split(/\r?\n/).filter((l) => /^\w+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const KEY = env.GNANI_API_KEY // never printed
const BASE = env.GNANI_API_BASE_URL || 'https://api.vachana.ai'
const want = process.argv.slice(2)
const manifestPath = `${out}manifest.json`
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const dur = (f) => parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString())

for (const l of LINES) {
  const mp3 = `${out}${l.id}.mp3`
  if (want.length ? !want.includes(l.id) : existsSync(mp3)) continue
  const res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-API-Key-ID': KEY },
    body: JSON.stringify({
      text: l.text, model: 'timbre-v3.0', voice: l.who === 'n' ? NARRATOR : BUILDER, language: l.lang ?? 'en-IN', speed: 1.0,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: 'linear_pcm', container: 'mp3', bitrate: '128k' },
    }),
  })
  if (!res.ok) { console.error(l.id, 'Timbre error', res.status, (await res.text()).slice(0, 200)); process.exit(1) }
  writeFileSync(mp3, Buffer.from(await res.arrayBuffer()))
  const entry = { who: l.who === 'n' ? `Gnani Timbre ${NARRATOR} (narrator, synthetic)` : `Gnani Timbre ${BUILDER} (builder test voice, synthetic)`, text: l.text, duration: dur(mp3) }
  if (l.who === 'b') {
    // the same 16 kHz mono WAV the studio's mic path produces, through the app's own relay
    const wav = `${out}${l.id}.wav`
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', mp3, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav])
    await sleep(500) // Gnani allows one request at a time
    const t0 = performance.now()
    const r = await fetch('http://localhost:5173/api/stt?lang=indic-auto', { method: 'POST', headers: { 'content-type': 'audio/wav', origin: 'http://localhost:5173' }, body: readFileSync(wav) })
    const sttMs = Math.round(performance.now() - t0)
    const j = await r.json()
    if (!r.ok) { console.error(l.id, 'Prisma error', j.error); process.exit(1) }
    Object.assign(entry, { transcript: j.transcript, language: j.language, model: j.model, providerLatencyMs: j.providerLatencyMs, sttMs, at: new Date().toISOString() })
  }
  manifest[l.id] = entry
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 1))
  console.log(l.id, entry.duration.toFixed(2) + 's', entry.transcript ? `→ “${entry.transcript}” (${entry.language}, ${entry.sttMs} ms)` : '')
  await sleep(400)
}
