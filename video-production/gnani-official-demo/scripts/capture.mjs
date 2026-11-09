// Captures the REAL BoliVerse app (dev server on :5173) for the official demo.
//  studio : frame-exact 30 fps screenshots of the full studio UI at Ultra while the schedule drives it
//  landing: real-time screencast of the landing page while it scrolls
//  export : real-time screencast of the in-app MP4 export, plus the exported file itself
// Usage: node scripts/capture.mjs studio|landing [--preview]
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { schedule } from './schedule.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const what = process.argv[2] ?? 'studio'
const preview = process.argv.includes('--preview')
const S = schedule()
const URL0 = 'http://localhost:5173'

const browser = await chromium.launch({ headless: false, channel: 'msedge', args: ['--force-device-scale-factor=1', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', '--disable-features=CalculateNativeWinOcclusion', '--window-size=1920,1200', '--autoplay-policy=no-user-gesture-required', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] })
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, acceptDownloads: true })
const page = await ctx.newPage()
page.on('console', (m) => { if (m.type() === 'error') console.log('[page error]', m.text().slice(0, 200)) })
const cdp = await ctx.newCDPSession(page)
const shot = async (file) => {
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 93, optimizeForSpeed: true })
  writeFileSync(file, Buffer.from(data, 'base64'))
}
const fresh = (dir) => { if (existsSync(dir)) rmSync(dir, { recursive: true }); mkdirSync(dir, { recursive: true }); return dir }

// real-time screencast → frames + timestamps (assembled at 30 fps by ffmpeg later)
async function screencast(dir, body) {
  fresh(dir)
  const stamps = []
  let n = 0
  const onFrame = async ({ data, metadata, sessionId }) => {
    const f = `${dir}/${String(n++).padStart(5, '0')}.jpg`
    writeFileSync(f, Buffer.from(data, 'base64'))
    stamps.push({ f, t: metadata.timestamp })
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  }
  cdp.on('Page.screencastFrame', onFrame)
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1920, maxHeight: 1080, everyNthFrame: 1 })
  await body()
  await cdp.send('Page.stopScreencast')
  cdp.off('Page.screencastFrame', onFrame)
  writeFileSync(`${dir}/stamps.json`, JSON.stringify(stamps))
  console.log(dir, n, 'frames')
}

if (what === 'landing') {
  await page.goto(`${URL0}/#/`)
  await page.waitForTimeout(4000)
  const dur = S.landing.end - S.landing.start
  await screencast(`${root}raw/landing`, async () => {
    const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
    const t0 = Date.now()
    // hold the hero, then one slow continuous scroll through the page (ease in/out)
    while (Date.now() - t0 < dur * 1000) {
      const u = Math.min(1, Math.max(0, ((Date.now() - t0) / 1000 - 2.2) / (dur - 3.2)))
      const e = u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), Math.round(e * H * 0.82))
      await page.waitForTimeout(16)
    }
  })
  await browser.close()
  process.exit(0)
}

// ---------------- studio ----------------
await page.goto(`${URL0}/#/studio`)
await page.waitForFunction(() => window.__r3f && window.__studio, null, { timeout: 60000 })
await page.waitForTimeout(2500)
// hide the FPS readout: in frame-exact capture it would show the video rate, not a measurement
await page.evaluate(() => {
  for (const el of document.querySelectorAll('span')) if (/^\d+ fps$/.test(el.textContent ?? '')) el.style.visibility = 'hidden'
})

// load the builder clips (16 kHz WAVs sent to Prisma) for the Voice Studio waveform
const beats = S.studio.beats.map((b) => ({ ...b, ...S.manifest[b.b], wavUrl: `/video-production/gnani-official-demo/raw/voice/${b.b}.wav`, audioAt: S.voice.find((v) => v.id === b.b).at }))
await page.evaluate(async ({ beats }) => {
  const ac = new AudioContext({ sampleRate: 16000 })
  window.__clips = {}
  for (const b of beats) window.__clips[b.b] = (await ac.decodeAudioData(await (await fetch(b.wavUrl)).arrayBuffer())).getChannelData(0)
  window.__ctl = await import('/src/voice/controller.ts')
  const st = window.__studio
  st.setState({ log: [], past: [], future: [], selectedId: null, mode: 'build', quality: 'ultra', speakReplies: false, phase: 'idle', message: 'Ready' })
  st.getState().set({ world: { ...st.getState().world, entities: [], counters: {}, recent: [], template: 'blank', env: { time: 'morning', weather: 'clear', lighting: 'cinematic' } } })
  st.getState().set({ cameraCmd: { seq: st.getState().cameraCmd.seq + 1, view: 'overview' } })
}, { beats })
await page.waitForTimeout(1500)

const dir = fresh(`${root}raw/studio`)
const fps = 30
const t0 = S.studio.start
const frames = Math.round((S.studio.mainEnd - t0) * fps)
const events = []
for (const b of beats) {
  events.push({ at: b.listen, kind: 'listen', b }, { at: b.transcribing, kind: 'transcribing', b })
  if (!b.export) events.push({ at: b.run, kind: 'run', b }) // the export command runs inside the screencast below
}
for (const c of S.studio.clicks) events.push({ at: c.at, kind: 'click', c })
events.sort((a, b) => a.at - b.at)
const log = []

await page.evaluate(() => { const s = window.__r3f.get(); s.setFrameloop('never'); window.__vt = s.clock.elapsedTime })
// camera: what a person would do with the orbit controls after each command — glide to the new
// thing, then drift slowly around it. Poses are computed from the live world's entity positions.
await page.evaluate(async () => {
  const { riverX } = await import('/src/engine/world.ts')
  const V = (x, y, z) => ({ x, y, z })
  const find = (t) => window.__studio.getState().world.entities.filter((e) => e.type === t).at(-1)
  const at = (e, dx, dy, dz, ty = 1.5) => ({ p: V(e.pos[0] + dx, e.pos[1] + dy, e.pos[2] + dz), t: V(e.pos[0], e.pos[1] + ty, e.pos[2]) })
  const GOALS = {
    start: () => null,
    b01: () => ({ p: V(riverX(-10) + 52, 34, 62), t: V(riverX(0), 0, 0), orbit: 2.2 }),
    b02: () => ({ ...at(find('temple'), 17, 10, 21, 3), orbit: 3 }),
    b03: () => { const b = find('bridge'); return { p: V(b.pos[0] + 16, 5.5, b.pos[2] + 20), t: V(b.pos[0], 1, b.pos[2]), orbit: 2 } },
    b04: () => { const e = find('prop') ?? find('temple'); return { ...at(e, 7, 4, 8.5, 0.6), orbit: 4 } },
    b05: () => ({ ...at(find('temple'), 12, 7, 15, 3), orbit: 2.5 }),
    b06: () => { const a = find('temple'), b = find('bridge'); const m = [(a.pos[0] + b.pos[0]) / 2, 0, (a.pos[2] + b.pos[2]) / 2]; return { p: V(m[0] + 34, 20, m[2] + 40), t: V(m[0], 1, m[2]), orbit: 2 } },
    b07: () => { const b = find('bridge'); return { p: V(b.pos[0] + 13, 5, b.pos[2] + 16), t: V(b.pos[0], 0.5, b.pos[2]), orbit: 1.5 } },
    // look across the light, not into the sun (into-sun blew out the water): camera 100° round from the sun
    b08: () => { const b = find('bridge'); let sun = null; window.__r3f.get().scene.traverse((o) => { if (o.isDirectionalLight && !sun) sun = o.position }); const a = Math.atan2(sun?.z ?? 1, sun?.x ?? 0) + 1.75; return { p: V(b.pos[0] + Math.cos(a) * 22, 6, b.pos[2] + Math.sin(a) * 22), t: V(b.pos[0], 1.2, b.pos[2]), orbit: 1.2 } },
  }
  window.__aim = (id) => {
    const s = window.__r3f.get(), ctl = s.controls
    ctl?.dispatchEvent({ type: 'start' }) // same as a user grabbing the controls: cancels the auto-frame glide
    const g = GOALS[id]?.()
    const p = s.camera.position, t = ctl?.target ?? V(0, 0, 0)
    window.__cam = { from: { p: V(p.x, p.y, p.z), t: V(t.x, t.y, t.z) }, to: g ?? { p: V(p.x, p.y, p.z), t: V(t.x, t.y, t.z) }, start: window.__vt, dur: g ? 2.4 : 0.01, orbit: g?.orbit ?? 1.5 }
  }
  window.__camStep = () => {
    const c = window.__cam, s = window.__r3f.get(), ctl = s.controls
    if (!c) return
    const u = Math.min(1, (window.__vt - c.start) / c.dur), e = u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2
    const L = (a, b) => a + (b - a) * e
    const t = V(L(c.from.t.x, c.to.t.x), L(c.from.t.y, c.to.t.y), L(c.from.t.z, c.to.t.z))
    let p = V(L(c.from.p.x, c.to.p.x), L(c.from.p.y, c.to.p.y), L(c.from.p.z, c.to.p.z))
    const ang = (c.orbit * Math.PI / 180) * Math.max(0, window.__vt - c.start - c.dur * 0.5)
    const dx = p.x - t.x, dz = p.z - t.z
    p = V(t.x + dx * Math.cos(ang) - dz * Math.sin(ang), p.y, t.z + dx * Math.sin(ang) + dz * Math.cos(ang))
    s.camera.position.set(p.x, p.y, p.z)
    ctl?.target.set(t.x, t.y, t.z)
    s.camera.lookAt(t.x, t.y, t.z)
  }
  window.__aim('start')
})
for (let i = 0; i < frames; i++) {
  const ft = t0 + i / fps // film time of this frame
  while (events.length && events[0].at <= ft + 1e-6) {
    const e = events.shift()
    if (e.kind === 'listen') await page.evaluate(() => window.__studio.getState().set({ phase: 'listening', message: 'Listening… speak, then pause (auto-stops after silence)' }))
    if (e.kind === 'transcribing') await page.evaluate(() => { const s = window.__studio.getState(); window.__ctl.wave.fill(0); s.set({ phase: 'transcribing', level: 0, message: 'Gnani Prisma is transcribing…', sttCalls: s.sttCalls + 1 }) })
    if (e.kind === 'run') {
      const b = e.b
      await page.evaluate(async (b) => {
        // the transcript Gnani Prisma returned for this exact clip (manifest), with its measured latency
        await window.__studio.getState().run(b.transcript, 'voice', { stt: b.sttMs, t0: performance.now() - b.sttMs, language: b.language, provider: `Gnani ${b.model} · provider ${b.providerLatencyMs} ms` })
      }, b)
      log.push({ ft, b: b.b, transcript: b.transcript, ops: await page.evaluate(() => window.__studio.getState().log.at(-1)?.ops.map((o) => o.action)) })
      console.log(ft.toFixed(2), b.b, log.at(-1).ops?.join(','))
      await page.waitForTimeout(60) // let the app's own camera effect run, then take over like a user orbiting
      await page.evaluate((id) => window.__aim(id), b.b)
    }
    if (e.kind === 'click') {
      const c = e.c
      if (c.tab) await page.getByRole('tab', { name: c.tab }).click()
      if (c.button) await page.getByRole('button', { name: c.button, exact: true }).click()
      if (c.select) {
        const pt = await page.evaluate((type) => {
          const s = window.__r3f.get(), ent = window.__studio.getState().world.entities.find((x) => x.type === type)
          if (!ent) return null
          const v = s.camera.position.clone().set(ent.pos[0], ent.pos[1] + 2.5, ent.pos[2]).project(s.camera)
          const r = s.gl.domElement.getBoundingClientRect()
          return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height, id: ent.id }
        }, c.select)
        if (pt) {
          await page.mouse.click(pt.x, pt.y)
          await page.waitForTimeout(150)
          const sel = await page.evaluate(() => window.__studio.getState().selectedId)
          if (sel !== pt.id) { await page.evaluate((id) => window.__studio.getState().select(id), pt.id); c.note = 'selected via store (click missed)' }
        }
      }
      log.push({ ft, click: c })
      console.log(ft.toFixed(2), 'click', JSON.stringify(c))
    }
  }
  // waveform: the builder clip's own samples at this moment
  const speaking = beats.find((b) => ft >= b.audioAt && ft < b.audioAt + b.duration)
  if (speaking) {
    await page.evaluate(({ id, pos }) => {
      const c = window.__clips[id], w = window.__ctl.wave, N = w.length, head = window.__ctl.waveHead()
      const end = Math.floor(pos * 16000)
      let s2 = 0
      for (let k = 0; k < N; k++) { const v = c[end - N + k] ?? 0; w[(head + k) % N] = v; s2 += v * v }
      window.__studio.getState().set({ level: Math.min(1, Math.sqrt(s2 / N) * 9) })
    }, { id: speaking.b, pos: ft - speaking.audioAt })
  }
  await page.evaluate(() => { window.__vt += 1 / 30; window.__camStep(); window.__r3f.get().advance(window.__vt) })
  await new Promise((r) => setTimeout(r, 0))
  if (!preview || i % 30 === 0) await shot(`${dir}/${String(i).padStart(5, '0')}.jpg`)
  if (i % 150 === 0) console.log(`frame ${i}/${frames}`)
}

// ---- in-app export (real time): run the last command, screencast until the MP4 is ready ----
const last = beats.at(-1)
const quality = await page.evaluate(() => window.__studio.getState().quality)
await screencast(`${root}raw/export`, async () => {
  await page.evaluate(() => window.__r3f.get().setFrameloop('always'))
  await page.evaluate(async (b) => { await window.__studio.getState().run(b.transcript, 'voice', { stt: b.sttMs, t0: performance.now() - b.sttMs, language: b.language, provider: `Gnani ${b.model} · provider ${b.providerLatencyMs} ms` }) }, last)
  log.push({ b: last.b, transcript: last.transcript, ops: await page.evaluate(() => window.__studio.getState().log.at(-1)?.ops.map((o) => o.action)) })
  console.log('export command', log.at(-1).ops?.join(','))
  await page.waitForFunction(() => window.__studio.getState().recording.state === 'ready' || window.__studio.getState().recording.state === 'error', null, { timeout: 240000 })
  await page.waitForTimeout(3500)
})
const rec = await page.evaluate(() => window.__studio.getState().recording)
console.log('export', rec.state, rec.format, rec.sizeBytes, rec.message ?? '')
if (rec.url) {
  const b64 = await page.evaluate(async (u) => { const b = await (await fetch(u)).blob(); return await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result.split(',')[1]); fr.readAsDataURL(b) }) }, rec.url)
  writeFileSync(`${root}raw/inapp-export.mp4`, Buffer.from(b64, 'base64'))
}
writeFileSync(`${root}raw/capture-log.json`, JSON.stringify({ when: new Date().toISOString(), quality, log, export: { ...rec, url: undefined }, lastTranscript: last.transcript }, null, 1))
await browser.close()
