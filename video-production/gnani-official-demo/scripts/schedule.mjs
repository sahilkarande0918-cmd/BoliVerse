// One timing source for the capture driver and the HyperFrames edit. Times are film seconds.
import { readFileSync } from 'node:fs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const M = JSON.parse(readFileSync(`${root}raw/voice/manifest.json`, 'utf8'))
const d = (id) => M[id].duration
const r = (x) => Math.round(x * 30) / 30 // land on frames

export function schedule() {
  const voice = [] // { id, at }
  const say = (id, at) => { voice.push({ id, at: r(at) }); return r(at) + d(id) }

  const intro = { start: 0 }
  let t = say('n01', 1.4) + 0.9
  intro.end = r(t)
  const landing = { start: intro.end }
  t = say('n02', landing.start + 0.5) + 0.7
  landing.end = r(t)

  const studio = { start: landing.end, beats: [], clicks: [] } // studio footage starts here
  t = say('n03', studio.start + 0.6) + 0.5

  const BEATS = [
    { b: 'b01', n: 'n04', hold: 1.4, cam: 'overview' },
    { b: 'b02', n: 'n05', hold: 1.0 },
    { b: 'b03', n: 'n06', hold: 1.4 },
    { b: 'b04', n: 'n07', hold: 1.4 },
    { b: 'b05', n: 'n08', hold: 1.0, select: 'temple', undoRedo: true },
    { b: 'b06', n: 'n09', hold: 1.2 },
    { b: 'b07', n: 'n10', hold: 2.0, before: 'simulate' },
    { b: 'b08', n: 'n11', hold: 1.2 },
    { b: 'b09', n: 'n12', export: true, before: 'film' },
  ]
  for (const B of BEATS) {
    if (B.before) { studio.clicks.push({ at: r(t), tab: B.before }); t += 0.9 }
    const beat = { ...B, listen: r(t) }
    const speechEnd = say(B.b, t + 0.25)
    beat.transcribing = r(speechEnd + 0.15)
    beat.run = r(speechEnd + 0.75)
    if (B.select) studio.clicks.push({ at: r(beat.run + 0.9), select: B.select })
    const nAt = beat.run + 1.0
    const nEnd = say(B.n, nAt)
    if (B.undoRedo) { studio.clicks.push({ at: r(nAt + 1.6), button: 'Undo' }, { at: r(nAt + 3.0), button: 'Redo' }) }
    if (B.export) {
      // in-app export runs in real time; the edit shows it time-compressed, then the exported file
      beat.exportShow = { start: beat.run, dur: 3.6 }
      beat.readyShow = { start: r(beat.run + 3.6), dur: r(Math.max(3.4, nEnd + 0.8 - (beat.run + 3.6))) }
      beat.end = r(beat.readyShow.start + beat.readyShow.dur)
    } else beat.end = r(nEnd + B.hold)
    studio.beats.push(beat)
    t = beat.end
  }
  studio.end = studio.beats.at(-1).end
  studio.mainEnd = studio.beats.at(-1).exportShow.start // frame-exact capture covers [studio.start, mainEnd)

  const diagram = { start: studio.end }
  t = say('n13', diagram.start + 0.4) + 1.2
  diagram.end = r(t)
  const end = { start: diagram.end }
  t = say('n14', end.start + 0.8) + 4.4
  end.end = r(t)
  return { intro, landing, studio, diagram, end, total: end.end, voice, manifest: M }
}

if (process.argv[1]?.endsWith('schedule.mjs')) console.log(JSON.stringify(schedule(), (k, v) => (k === 'manifest' ? undefined : v), 1))
