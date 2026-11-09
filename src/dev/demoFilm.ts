// DEV-ONLY demo director. Drives the real studio through the story and renders a 60 s MP4.
// Truthfulness rules:
//  * every spoken command is a real Gnani Timbre clip sent through the real /api/stt → Gnani Prisma path;
//    the transcript shown is whatever Prisma returned, and the latency shown is measured;
//  * the world is the live engine (same store, compiler, physics) rendered frame by frame;
//  * the voices are labelled as synthetic Timbre speech on screen.
import * as THREE from 'three'
import type { RootState } from '@react-three/fiber'
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio } from 'mediabunny'
import { useStudio } from '../store'
import { speak, transcribe } from '../voice/api'
import { downsample, encodeWav } from '../voice/audio'
import { buildShot, poseAt, villageCentre, type ShotPath } from '../engine/shots'
import { computeRoute } from '../engine/traversal'
import type { CameraPreset } from '../compiler/schema'

const W = 1920, H = 1080, FPS = 30

interface Beat { label: string; lang: string; langName: string; ttsLang: string; say: string; shot: CameraPreset | 'hold' | 'aerial' | 'overview'; shotSec: number }
const BEATS: Beat[] = [
  { label: 'Create', lang: 'hi-IN', langName: 'Hindi', ttsLang: 'hi-IN', say: 'एक सुंदर भारतीय गाँव बनाओ, बीच में नदी हो, और लकड़ी का पुल हो।', shot: 'establishing', shotSec: 5.5 },
  { label: 'Edit', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Bridge thoda bada karo, aur sunset kar do.', shot: 'bridge_flythrough', shotSec: 4.5 },
  { label: 'Destroy', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Ab bridge tod do.', shot: 'destruction', shotSec: 5.5 },
  { label: 'Rebuild', lang: 'mr-IN', langName: 'Marathi', ttsLang: 'mr-IN', say: 'त्याच जागी दगडी पूल बांधा.', shot: 'river_reveal', shotSec: 4 },
  { label: 'Mansion', lang: 'en-IN', langName: 'English', ttsLang: 'en-IN', say: 'Build a luxury mansion with a swimming pool.', shot: 'mansion_reveal', shotSec: 5 },
  { label: 'Interior', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Mansion ke andar sofa, kaleen aur jhoomar lagao.', shot: 'aerial', shotSec: 3.5 },
  { label: 'Night', lang: 'hi-IN', langName: 'Hindi', ttsLang: 'hi-IN', say: 'डाइनिंग टेबल और बेड भी लगाओ, और रात कर दो।', shot: 'interior', shotSec: 7 },
]
const TITLE = 3, END = 3.5

interface Prepared { beat: Beat; clip: AudioBuffer; transcript: string; language: string; sttMs: number; providerMs: number; model: string }

const r3f = () => (window as unknown as { __r3f: RootState }).__r3f.get()

async function prepare(ctx: AudioContext, log: (s: string) => void): Promise<Prepared[]> {
  const out: Prepared[] = []
  for (const beat of BEATS) {
    const mp3 = await speak(beat.say, beat.ttsLang) // Gnani Timbre (synthetic voice)
    const clip = await ctx.decodeAudioData(await mp3.arrayBuffer())
    const wav = encodeWav(downsample(clip.getChannelData(0), clip.sampleRate, 16000), 16000)
    const t0 = performance.now()
    const r = await transcribe(wav, 'indic-auto') // real Gnani Prisma call through our relay
    const sttMs = performance.now() - t0
    log(`${beat.label}: “${r.transcript}” (${r.language}, ${Math.round(sttMs)} ms)`)
    out.push({ beat, clip, transcript: r.transcript, language: r.language, sttMs, providerMs: r.providerLatencyMs, model: r.model })
    await new Promise((res) => setTimeout(res, 400)) // Gnani allows one request at a time
  }
  return out
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath()
}
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' '), lines: string[] = []
  let line = ''
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t }
  if (line) lines.push(line)
  return lines
}

export async function makeDemoFilm(log: (s: string) => void = console.log) {
  const actx = new AudioContext()
  log('Generating Timbre voices and transcribing with Prisma…')
  const prep = await prepare(actx, log)

  // ---- timeline ----
  type Seg = { kind: 'title' | 'speak' | 'shot' | 'end'; start: number; dur: number; p?: Prepared; idx?: number }
  const segs: Seg[] = [{ kind: 'title', start: 0, dur: TITLE }]
  let t = TITLE
  prep.forEach((p, idx) => {
    const sd = Math.max(1.4, p.clip.duration + 0.25)
    segs.push({ kind: 'speak', start: t, dur: sd, p, idx }); t += sd
    segs.push({ kind: 'shot', start: t, dur: p.beat.shotSec, p, idx }); t += p.beat.shotSec
  })
  segs.push({ kind: 'end', start: t, dur: END }); t += END
  const total = t
  log(`Film length ${total.toFixed(1)} s`)

  // ---- audio bed: the actual Timbre clips at their speak times ----
  const off = new OfflineAudioContext(1, Math.ceil(total * 48000), 48000)
  for (const s of segs) if (s.kind === 'speak') { const src = off.createBufferSource(); src.buffer = s.p!.clip; src.connect(off.destination); src.start(s.start + 0.15) }
  const mix = await off.startRendering()

  // ---- reset world + renderer ----
  const st = useStudio
  st.setState({ log: [], past: [], future: [], selectedId: null, mode: 'build', quality: 'high' })
  st.getState().set({ world: { ...st.getState().world, entities: [], counters: {}, recent: [], template: 'blank', env: { time: 'morning', weather: 'clear', lighting: 'cinematic' } } })
  st.getState().set({ recording: { state: 'recording', progress: 0 } }) // freezes interactive camera director
  await new Promise((r) => setTimeout(r, 400))
  const s0 = r3f()
  const prev = { w: s0.size.width, h: s0.size.height, top: s0.size.top, left: s0.size.left, dpr: s0.viewport.dpr }
  s0.setDpr(1); s0.setSize(W, H, prev.top, prev.left); s0.setFrameloop('never')
  await new Promise((r) => setTimeout(r, 500))

  const comp = document.createElement('canvas')
  comp.width = W; comp.height = H
  const g = comp.getContext('2d')!
  const aCodec = (await canEncodeAudio('aac', { numberOfChannels: 1, sampleRate: 48000 })) ? 'aac' : 'opus'
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() })
  const video = new CanvasSource(comp, { codec: 'avc', bitrate: QUALITY_HIGH, keyFrameInterval: 2 })
  const audio = new AudioBufferSource({ codec: aCodec, bitrate: QUALITY_HIGH })
  output.addVideoTrack(video, { frameRate: FPS })
  output.addAudioTrack(audio)
  await output.start()
  await audio.add(mix)
  audio.close()

  const cam = () => r3f().camera as THREE.PerspectiveCamera
  let shot: ShotPath | null = null, shotSeg: Seg | null = null
  let holdFrom: { p: THREE.Vector3; q: THREE.Quaternion } | null = null
  const done = new Set<number>()
  const results: Record<number, { ms: number; ops: string[]; planner: string }> = {}
  const base = r3f().clock.elapsedTime
  const frames = Math.round(total * FPS)
  let posterSaved = false

  for (let i = 0; i < frames; i++) {
    const time = i / FPS
    const seg = segs.find((s) => time >= s.start && time < s.start + s.dur) ?? segs[segs.length - 1]
    const local = (time - seg.start) / seg.dur

    // world action fires when the speech segment ends → shot begins (real pipeline, real latency)
    if (seg.kind === 'shot' && !done.has(seg.idx!)) {
      done.add(seg.idx!)
      const p = seg.p!
      await st.getState().run(p.transcript, 'voice', { stt: p.sttMs, t0: performance.now(), language: p.language, provider: `Gnani ${p.model}` })
      st.getState().select(null)
      const last = st.getState().log.at(-1)!
      results[seg.idx!] = { ms: Math.round(p.sttMs + (last.t.parse ?? 0) + (last.t.apply ?? 0)), ops: last.ops.map((o) => o.action), planner: last.planner }
      log(`  → ${last.status} via ${last.planner}: ${results[seg.idx!].ops.join(', ')}`)
      st.getState().set({ recording: { state: 'recording', progress: i / frames } })
      const w = st.getState().world
      const preset = p.beat.shot
      if (preset === 'aerial' || preset === 'hold' || preset === 'overview') {
        const m = w.entities.find((e) => e.type === 'mansion')
        const c = m ? new THREE.Vector3(m.pos[0], m.pos[1], m.pos[2]) : villageCentre(w)
        const rot = m?.rotY ?? 0
        // mansion-local framing over the open-plan living + dining zones (ceiling is see-through from above)
        const L = (x: number, y: number, z: number) => new THREE.Vector3(c.x + x * Math.cos(rot) + z * Math.sin(rot), c.y + y, c.z - x * Math.sin(rot) + z * Math.cos(rot))
        const curve = (pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts)
        shot = { pos: curve([L(-3, 19, 15), L(-2, 14, 10)]), look: curve([L(-2.5, 0, -0.5), L(-2, 0, 0)]), fov: 50 }
      } else shot = buildShot(preset, w)
      shotSeg = seg
    }
    if (seg.kind === 'title' && i === 0) {
      const c = villageCentre(st.getState().world)
      shot = { pos: new THREE.CatmullRomCurve3([c.clone().add(new THREE.Vector3(90, 50, 100)), c.clone().add(new THREE.Vector3(60, 38, 80))]), look: new THREE.CatmullRomCurve3([c.clone(), c.clone()]), fov: 40 }
      shotSeg = seg
    }
    if (seg.kind === 'speak' || seg.kind === 'end') {
      // hold the last framing with a slow push while the user speaks
      if (!holdFrom || seg !== shotSeg) { holdFrom = { p: cam().position.clone(), q: cam().quaternion.clone() }; shotSeg = seg; shot = null }
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(holdFrom.q)
      cam().position.copy(holdFrom.p).addScaledVector(fwd, local * 2.5)
      cam().quaternion.copy(holdFrom.q)
      const ctl = r3f().controls as unknown as { target?: THREE.Vector3 } | null
      ctl?.target?.copy(cam().position).addScaledVector(fwd, 30)
    } else if (shot && shotSeg) {
      poseAt(shot, (time - shotSeg.start) / shotSeg.dur, cam(), r3f().controls)
    }
    r3f().advance(base + (i + 1) / FPS)

    // ---- composite ----
    g.drawImage(r3f().gl.domElement, 0, 0, W, H)
    drawOverlay(g, seg, local, time, results, prep, total)
    if (!posterSaved && seg.kind === 'shot' && seg.p?.beat.label === 'Mansion' && local > 0.8) {
      posterSaved = true
      const jpg = await new Promise<Blob>((r) => comp.toBlob((b) => r(b!), 'image/jpeg', 0.88))
      await fetch('/__save?name=poster.jpg', { method: 'POST', body: jpg })
    }
    await video.add(time, 1 / FPS)
    if (i % 30 === 0) { st.getState().set({ recording: { state: 'recording', progress: i / frames } }); log(`frame ${i}/${frames}`) }
  }
  await output.finalize()
  const buf = (output.target as BufferTarget).buffer!
  await fetch('/__save?name=boliverse-demo.mp4', { method: 'POST', body: buf })
  await fetch('/__save?name=demo-run.json', { method: 'POST', body: JSON.stringify({ when: new Date().toISOString(), total, audioCodec: aCodec, beats: prep.map((p, i) => ({ said: p.beat.say, voice: 'Gnani Timbre (synthetic)', transcript: p.transcript, language: p.language, sttMs: Math.round(p.sttMs), providerMs: p.providerMs, ...results[i] })) }, null, 1) })

  const s1 = r3f()
  s1.setFrameloop('always'); s1.setSize(prev.w, prev.h, prev.top, prev.left); s1.setDpr(prev.dpr)
  st.getState().set({ recording: { state: 'idle', progress: 0 } })
  log(`Saved public/demo/boliverse-demo.mp4 (${(buf.byteLength / 1e6).toFixed(1)} MB, ${total.toFixed(1)} s, audio ${aCodec})`)
  return { bytes: buf.byteLength, total }

  function drawOverlay(g: CanvasRenderingContext2D, seg: Seg, local: number, time: number, res: typeof results, prep: Prepared[], total: number) {
    const ease = (x: number) => Math.min(1, Math.max(0, x))
    // cinematic letterbox gradient
    const grd = g.createLinearGradient(0, H * 0.55, 0, H)
    grd.addColorStop(0, 'rgba(11,13,16,0)'); grd.addColorStop(1, 'rgba(11,13,16,0.78)')
    g.fillStyle = grd; g.fillRect(0, H * 0.55, W, H * 0.45)
    g.fillStyle = 'rgba(11,13,16,0.35)'; g.fillRect(0, 0, W, 90)
    // brand
    g.fillStyle = '#e9e7e2'; g.font = '600 26px Geist'; g.textBaseline = 'middle'
    g.fillText('BoliVerse', 120, 48)
    g.strokeStyle = '#D9A75A'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(72, 62); g.lineTo(88, 34); g.lineTo(104, 62); g.closePath(); g.stroke()
    g.fillStyle = 'rgba(233,231,226,0.55)'; g.font = '400 20px Geist'
    g.fillText('Live engine render · voices: Gnani Timbre (synthetic) → transcribed live by Gnani Prisma', 260, 48)

    if (seg.kind === 'title') {
      const a = ease(local * 2.2)
      g.globalAlpha = a
      g.fillStyle = '#e9e7e2'; g.font = '600 150px Geist'; g.textBaseline = 'alphabetic'
      g.fillText('YOUR WORDS.', 120, 720)
      g.fillStyle = '#ECC68A'; g.fillText('YOUR WORLD.', 120, 860)
      g.fillStyle = 'rgba(233,231,226,0.8)'; g.font = '300 38px Geist'
      g.fillText('Build living 3D worlds. Just by speaking.', 124, 940)
      g.globalAlpha = 1
      return
    }
    if (seg.kind === 'end') {
      g.fillStyle = `rgba(11,13,16,${0.55 * ease(local * 2)})`; g.fillRect(0, 0, W, H)
      g.globalAlpha = ease(local * 2)
      g.textBaseline = 'alphabetic'
      g.fillStyle = '#e9e7e2'; g.font = '600 96px Geist'; g.fillText('Speak a world into existence.', 120, 470)
      g.fillStyle = '#ECC68A'; g.font = '500 44px Geist'; g.fillText('boliverse.vercel.app', 124, 560)
      g.fillStyle = 'rgba(233,231,226,0.75)'; g.font = '400 30px Geist'
      g.fillText('Gnani Prisma v3.0 speech · Groq-planned fallback · Rapier physics · in-browser MP4 export', 124, 630)
      g.fillText('github.com/sahilkarande0918-cmd/BoliVerse   ·   #GnaniAI  #GreatIndianAIInternshipChallenge', 124, 680)
      g.globalAlpha = 1
      return
    }
    const p = seg.p!, idx = seg.idx!
    // step counter
    g.textBaseline = 'middle'; g.font = '500 22px Geist Mono'; g.fillStyle = '#D9A75A'
    g.fillText(`${String(idx + 1).padStart(2, '0')} / ${String(prep.length).padStart(2, '0')}`, W - 330, 48)
    g.fillStyle = '#e9e7e2'; g.font = '600 24px Geist'; g.fillText(p.beat.label.toUpperCase(), W - 220, 48)

    // lower third
    const x = 120, y = H - 300, w = 1100
    g.fillStyle = 'rgba(21,24,29,0.82)'; rr(g, x - 28, y - 30, w + 56, 250, 14); g.fill()
    g.strokeStyle = 'rgba(160,172,190,0.18)'; g.lineWidth = 1.5; g.stroke()
    g.textBaseline = 'alphabetic'
    if (seg.kind === 'speak') {
      g.fillStyle = '#ECC68A'; g.font = '600 20px Geist'
      g.fillText(`SPEAKING · ${p.beat.langName.toUpperCase()}`, x, y + 10)
      // waveform from the real clip envelope
      const ch = p.clip.getChannelData(0), sr = p.clip.sampleRate
      const tt = local * seg.dur - 0.15
      for (let b = 0; b < 90; b++) {
        const s = Math.floor((tt - 0.6 + b * (0.6 / 90)) * sr)
        let e = 0
        for (let j = 0; j < 256; j++) { const v = ch[s + j] ?? 0; e += v * v }
        const amp = Math.min(1, Math.sqrt(e / 256) * 9)
        const bh = 6 + amp * 110
        g.fillStyle = `rgba(236,198,138,${0.35 + amp * 0.65})`
        g.fillRect(x + b * 12, y + 110 - bh / 2, 6, bh)
      }
      g.fillStyle = 'rgba(233,231,226,0.55)'; g.font = '400 20px Geist'
      g.fillText('Audio is captured, then sent through the server relay to Gnani Prisma', x, y + 200)
    } else {
      const r = res[idx]
      g.fillStyle = '#ECC68A'; g.font = '600 20px Geist'
      g.fillText(`HEARD · GNANI PRISMA ${p.model.replace('prisma-', '')} · ${p.language} · ${Math.round(p.sttMs)} ms`, x, y + 10)
      g.fillStyle = '#e9e7e2'; g.font = '500 40px Geist'
      wrap(g, p.transcript, w).slice(0, 2).forEach((l, k) => g.fillText(l, x, y + 70 + k * 50))
      g.font = '500 22px Geist Mono'; g.fillStyle = 'rgba(236,198,138,0.95)'
      g.fillText((r?.ops ?? []).join('  →  '), x, y + 180)
      g.fillStyle = 'rgba(233,231,226,0.6)'; g.font = '400 20px Geist'
      g.fillText(`${r?.planner === 'groq' ? 'Groq planner' : 'Local multilingual parser'} · voice → world ${r?.ms ?? '…'} ms`, x, y + 212)
      // causal status
      const route = computeRoute(st.getState().world)
      if (st.getState().world.entities.some((e) => e.type === 'river')) {
        const label = route.ok ? `Route open · ${route.via}` : 'Route blocked · no crossing'
        g.font = '600 22px Geist'
        const tw = g.measureText(label).width
        g.fillStyle = 'rgba(21,24,29,0.82)'; rr(g, W - 160 - tw - 40, H - 120, tw + 60, 50, 25); g.fill()
        g.fillStyle = route.ok ? '#7cb58a' : '#e07a63'; g.beginPath(); g.arc(W - 160 - tw - 12, H - 95, 7, 0, 7); g.fill()
        g.fillStyle = '#e9e7e2'; g.fillText(label, W - 160 - tw + 4, H - 88)
      }
    }
    // progress hairline
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, H - 4, W, 4)
    g.fillStyle = '#D9A75A'; g.fillRect(0, H - 4, (time / total) * W, 4)
  }
}

;(window as unknown as { makeDemoFilm: typeof makeDemoFilm }).makeDemoFilm = makeDemoFilm
