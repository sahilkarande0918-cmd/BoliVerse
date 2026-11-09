// Turns the raw captures into the clips the HyperFrames edit uses (film/assets/media) and copies voices.
// Usage: node scripts/make-media.mjs [studio|landing|export|all]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { schedule } from './schedule.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const out = `${root}film/assets/media/`
mkdirSync(out, { recursive: true }); mkdirSync(`${root}film/assets/voice`, { recursive: true })
const S = schedule()
const what = process.argv[2] ?? 'all'
const ff = (...a) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...a], { stdio: 'inherit' })
const X264 = ['-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart']
const probe = (f, e) => execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', e, '-of', 'csv=p=0', f]).toString().trim()

// frames with capture timestamps → constant 30 fps (each frame held until the next one arrived)
function fromStamps(stamps, file, scale = 1, total, pad = false) {
  const list = `${root}raw/concat.txt`
  let txt = ''
  stamps.forEach((s, i) => {
    const next = stamps[i + 1]?.t ?? s.t + 1 / 30
    txt += `file '${s.f}'\nduration ${Math.max(0.001, (next - s.t) * scale).toFixed(4)}\n`
  })
  txt += `file '${stamps.at(-1).f}'\n`
  writeFileSync(list, txt)
  ff('-f', 'concat', '-safe', '0', '-i', list, ...(total ? ['-t', String(total)] : []), '-vf', pad ? 'fps=30,tpad=stop_mode=clone:stop_duration=3' : 'fps=30', ...X264, file)
}

const media = existsSync(`${out}media.json`) ? JSON.parse(readFileSync(`${out}media.json`, 'utf8')) : {}
if (what === 'studio' || what === 'all') {
  ff('-framerate', '30', '-i', `${root}raw/studio/%05d.jpg`, ...X264, `${out}studio.mp4`)
  console.log('studio.mp4', probe(`${out}studio.mp4`, 'stream=nb_frames'), 'frames')
}
if (what === 'landing' || what === 'all') {
  const st = JSON.parse(readFileSync(`${root}raw/landing/stamps.json`, 'utf8'))
  fromStamps(st, `${out}landing.mp4`, 1, S.landing.end - S.landing.start)
  console.log('landing.mp4', probe(`${out}landing.mp4`, 'stream=duration'), 's')
}
if (what === 'export' || what === 'all') {
  const st = JSON.parse(readFileSync(`${root}raw/export/stamps.json`, 'utf8'))
  const beat = S.studio.beats.at(-1)
  // the screencast ends 3.5 s after the export reported ready: split there
  const readyAt = st.at(-1).t - 3.5
  const run = st.filter((s) => s.t < readyAt), after = st.filter((s) => s.t >= readyAt - 0.05)
  const realSec = run.at(-1).t - run[0].t
  fromStamps(run, `${out}export.mp4`, beat.exportShow.dur / realSec, beat.exportShow.dur)
  fromStamps(after, `${out}ready.mp4`, 1, beat.readyShow.dur + 0.2, true)
  copyFileSync(`${root}raw/inapp-export.mp4`, `${out}inapp-export.mp4`)
  const [w, h] = probe(`${out}inapp-export.mp4`, 'stream=width,height').split(',').map(Number)
  Object.assign(media, { exportSec: realSec, inapp: { w, h, sec: parseFloat(probe(`${out}inapp-export.mp4`, 'stream=duration')) } })
  console.log('export real', realSec.toFixed(1), 's →', beat.exportShow.dur, 's; ready', (after.at(-1).t - after[0].t).toFixed(1), 's; in-app file', w, h)
}
for (const f of readdirSync(`${root}raw/voice`)) if (f.endsWith('.mp3')) copyFileSync(`${root}raw/voice/${f}`, `${root}film/assets/voice/${f}`)
writeFileSync(`${out}media.json`, JSON.stringify(media, null, 1))
