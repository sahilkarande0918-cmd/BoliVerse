// DEV-ONLY demo director. Drives the real studio through the story and renders a 60 s MP4.
// Truthfulness rules:
//  * every spoken command is a real Gnani Timbre clip sent through the real /api/stt → Gnani Prisma path;
//    the transcript shown is whatever Prisma returned, and the latency shown is measured;
//  * the world is the live engine (same store, compiler, physics) rendered frame by frame;
//  * the voices are labelled as synthetic Timbre speech on screen.
import * as THREE from 'three'
import type { RootState } from '@react-three/fiber'
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio } from 'mediabunny'
import { useStudio, type Quality } from '../store'
import { speak, transcribe } from '../voice/api'
import { downsample, encodeWav } from '../voice/audio'
import { buildShot, poseAt, villageCentre, type ShotPath } from '../engine/shots'
import { computeRoute } from '../engine/traversal'
import type { CameraPreset } from '../compiler/schema'

const W = 1920, H = 1080, FPS = 30

interface Beat { label: string; lang: string; langName: string; ttsLang: string; say: string; shot: CameraPreset | 'hold' | 'aerial' | 'overview'; shotSec: number }
const BEATS: Beat[] = [
  { label: 'Create', lang: 'hi-IN', langName: 'Hindi', ttsLang: 'hi-IN', say: 'एक सुंदर भारतीय गाँव बनाओ, बीच में नदी हो, और लकड़ी का पुल हो।', shot: 'establishing', shotSec: 5 },
  { label: 'Edit', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Bridge thoda bada karo, aur sunset kar do.', shot: 'bridge_flythrough', shotSec: 4.5 },
  { label: 'Destroy', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Ab bridge tod do.', shot: 'destruction', shotSec: 5 },
  { label: 'Rebuild', lang: 'mr-IN', langName: 'Marathi', ttsLang: 'mr-IN', say: 'त्याच जागी दगडी पूल बांधा.', shot: 'river_reveal', shotSec: 4 },
  { label: 'Mansion', lang: 'en-IN', langName: 'English', ttsLang: 'en-IN', say: 'Build a luxury mansion with a swimming pool.', shot: 'mansion_reveal', shotSec: 4.5 },
  { label: 'Interior', lang: 'hi-IN', langName: 'Hinglish', ttsLang: 'hi-IN', say: 'Mansion ke andar sofa, kaleen aur jhoomar lagao.', shot: 'aerial', shotSec: 3.2 },
  { label: 'Night', lang: 'hi-IN', langName: 'Hindi', ttsLang: 'hi-IN', say: 'डाइनिंग टेबल और बेड भी लगाओ, और रात कर दो।', shot: 'interior', shotSec: 6.5 },
]
const TITLE = 2.8, END = 3.2

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

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(' '), lines: string[] = []
  let line = ''
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { lines.push(line); line = w } else line = t }
  if (line) lines.push(line)
  return lines
}

export async function makeDemoFilm(log: (s: string) => void = console.log, quality: Quality = 'ultra') {
  for (let i = 0; i < 100 && !(window as unknown as { __r3f?: RootState }).__r3f; i++) await new Promise((r) => setTimeout(r, 100))
  if (!(window as unknown as { __r3f?: RootState }).__r3f) throw new Error('Studio renderer not ready — open #/studio first')
  await Promise.all(['300 40px Jost', '400 40px Jost', '500 40px Jost', '400 20px "Geist Mono"'].map((f) => document.fonts.load(f)))
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
  st.setState({ log: [], past: [], future: [], selectedId: null, mode: 'build', quality })
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
  const video = new CanvasSource(comp, { codec: 'avc', bitrate: 6e6, // ponytail: fixed 6 Mbps keeps the repo file < 100 MB (QUALITY_HIGH gave 114 MB on dense grass)
    keyFrameInterval: 2 })
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
  await fetch('/__save?name=demo-run.json', { method: 'POST', body: JSON.stringify({ when: new Date().toISOString(), total, quality, audioCodec: aCodec, beats: prep.map((p, i) => ({ said: p.beat.say, voice: 'Gnani Timbre (synthetic)', transcript: p.transcript, language: p.language, sttMs: Math.round(p.sttMs), providerMs: p.providerMs, ...results[i] })) }, null, 1) })

  const s1 = r3f()
  s1.setFrameloop('always'); s1.setSize(prev.w, prev.h, prev.top, prev.left); s1.setDpr(prev.dpr)
  st.getState().set({ recording: { state: 'idle', progress: 0 } })
  log(`Saved public/demo/boliverse-demo.mp4 (${(buf.byteLength / 1e6).toFixed(1)} MB, ${total.toFixed(1)} s, audio ${aCodec})`)
  return { bytes: buf.byteLength, total }

  function drawOverlay(g: CanvasRenderingContext2D, seg: Seg, local: number, time: number, res: typeof results, prep: Prepared[], total: number) {
    // warm editorial overlays: ivory surfaces, charcoal Jost type, taupe secondary text
    const ease = (x: number) => Math.min(1, Math.max(0, x))
    const IVORY = 'rgba(242,237,231,0.94)', INK = '#2e2a27', TAUPE = '#776d66', FAINT = '#a49990'
    const arch = (x: number, y: number, s: number, color: string) => {
      g.strokeStyle = color; g.lineWidth = s * 0.11
      g.beginPath(); g.moveTo(x, y + s); g.lineTo(x, y + s * 0.5); g.arc(x + s / 2, y + s * 0.5, s / 2, Math.PI, 0); g.lineTo(x + s, y + s); g.stroke()
      g.fillStyle = color; g.beginPath(); g.arc(x + s / 2, y + s * 0.62, s * 0.11, 0, 7); g.fill()
    }
    // header band
    g.fillStyle = 'rgba(242,237,231,0.88)'; g.fillRect(0, 0, W, 84)
    arch(72, 26, 30, INK)
    g.fillStyle = INK; g.font = '500 28px Jost'; g.textBaseline = 'middle'; g.fillText('boliverse', 118, 44)
    g.fillStyle = TAUPE; g.font = '400 19px Jost'
    g.fillText('Live engine render  ·  voices are Gnani Timbre (synthetic), transcribed live by Gnani Prisma', 300, 44)

    if (seg.kind === 'title') {
      const a = ease(local * 2.2)
      const grd = g.createLinearGradient(0, 0, W * 0.6, 0)
      grd.addColorStop(0, `rgba(231,224,216,${0.92 * a})`); grd.addColorStop(1, 'rgba(231,224,216,0)')
      g.fillStyle = grd; g.fillRect(0, 84, W * 0.6, H - 84)
      g.globalAlpha = a; g.textBaseline = 'alphabetic'
      g.fillStyle = TAUPE; g.font = '500 20px Jost'; g.fillText('V O I C E   T O   3 D   S T U D I O', 124, 430)
      g.fillStyle = INK; g.font = '300 132px Jost'
      g.fillText('Your words.', 116, 590); g.fillText('Your world.', 116, 730)
      g.font = '400 36px Jost'; g.fillStyle = INK; g.fillText('Build living 3D worlds. Just by speaking.', 122, 820)
      g.globalAlpha = 1
      return
    }
    if (seg.kind === 'end') {
      g.fillStyle = `rgba(231,224,216,${0.94 * ease(local * 2.4)})`; g.fillRect(0, 0, W, H)
      g.globalAlpha = ease(local * 2.4); g.textBaseline = 'alphabetic'
      arch(124, 250, 70, INK)
      g.fillStyle = INK; g.font = '300 104px Jost'; g.fillText('Speak a world into existence.', 116, 470)
      g.font = '400 42px Jost'; g.fillText('boliverse.vercel.app', 122, 560)
      g.fillStyle = INK; g.fillRect(122, 600, 1100, 1)
      g.fillStyle = TAUPE; g.font = '400 28px Jost'
      g.fillText('Gnani Prisma v3.0 speech  ·  Groq fallback planner  ·  Rapier physics  ·  in-browser MP4 export', 122, 660)
      g.fillText('github.com/sahilkarande0918-cmd/BoliVerse     #GnaniAI   #GreatIndianAIInternshipChallenge', 122, 710)
      g.globalAlpha = 1
      return
    }
    const p = seg.p!, idx = seg.idx!
    // step counter in the header band
    g.textBaseline = 'middle'; g.fillStyle = FAINT; g.font = '400 20px Geist Mono'
    g.fillText(`${String(idx + 1).padStart(2, '0')} / ${String(prep.length).padStart(2, '0')}`, W - 330, 44)
    g.fillStyle = INK; g.font = '500 20px Jost'; g.fillText(p.beat.label.toUpperCase().split('').join(' '), W - 230, 44)

    // lower third: ivory card
    const x = 120, y = H - 292, w = 1060
    g.fillStyle = IVORY; g.fillRect(x - 40, y - 44, w + 80, 262)
    g.fillStyle = INK; g.fillRect(x - 40, y - 44, 3, 262)
    g.textBaseline = 'alphabetic'
    if (seg.kind === 'speak') {
      g.fillStyle = TAUPE; g.font = '500 18px Jost'
      g.fillText(`S P E A K I N G   ·   ${p.beat.langName.toUpperCase().split('').join(' ')}`, x, y)
      const ch = p.clip.getChannelData(0), sr = p.clip.sampleRate
      const tt = local * seg.dur - 0.15
      for (let b = 0; b < 110; b++) {
        const s = Math.floor((tt - 0.6 + b * (0.6 / 110)) * sr)
        let e = 0
        for (let j = 0; j < 256; j++) { const v = ch[s + j] ?? 0; e += v * v }
        const amp = Math.min(1, Math.sqrt(e / 256) * 9)
        const bh = 3 + amp * 100
        g.fillStyle = `rgba(46,42,39,${0.25 + amp * 0.75})`
        g.fillRect(x + b * 9.5, y + 92 - bh / 2, 2.5, bh)
      }
      g.fillStyle = FAINT; g.font = '400 19px Jost'
      g.fillText('Audio goes through the server relay to Gnani Prisma for transcription', x, y + 188)
    } else {
      const r = res[idx]
      g.fillStyle = TAUPE; g.font = '500 18px Jost'
      g.fillText(`H E A R D   ·   G N A N I   P R I S M A   ${p.model.replace('prisma-', '')}   ·   ${p.language}   ·   ${Math.round(p.sttMs)} ms`, x, y)
      g.fillStyle = INK; g.font = '300 42px Jost'
      wrap(g, p.transcript, w).slice(0, 2).forEach((l, k) => g.fillText(l, x, y + 62 + k * 50))
      g.font = '400 19px Geist Mono'; g.fillStyle = TAUPE
      g.fillText((r?.ops ?? []).join('   ·   '), x, y + 164)
      g.fillStyle = FAINT; g.font = '400 19px Jost'
      g.fillText(`${r?.planner === 'groq' ? 'Groq planner' : 'Local multilingual parser'}   ·   end of speech to world applied in ${r?.ms ?? '…'} ms`, x, y + 196)
      const route = computeRoute(st.getState().world)
      if (st.getState().world.entities.some((e) => e.type === 'river')) {
        const label = route.ok ? `Route open  ·  ${route.via}` : 'Route blocked  ·  no crossing'
        g.font = '400 21px Jost'
        const tw = g.measureText(label).width
        const bx = W - 140 - tw - 56
        g.fillStyle = IVORY; g.fillRect(bx, H - 128, tw + 70, 56)
        g.fillStyle = route.ok ? '#5e7d66' : '#a65a48'; g.beginPath(); g.arc(bx + 26, H - 100, 6, 0, 7); g.fill()
        g.fillStyle = INK; g.textBaseline = 'middle'; g.fillText(label, bx + 44, H - 99)
      }
    }
    // progress hairline
    g.fillStyle = 'rgba(242,237,231,0.5)'; g.fillRect(0, H - 3, W, 3)
    g.fillStyle = INK; g.fillRect(0, H - 3, (time / total) * W, 3)
  }
}

;(window as unknown as { makeDemoFilm: typeof makeDemoFilm }).makeDemoFilm = makeDemoFilm
