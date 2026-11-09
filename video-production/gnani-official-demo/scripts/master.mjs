// Masters the HyperFrames render: two-pass loudnorm to −16 LUFS / −1 dBTP (video stream copied),
// probes the result, writes the thumbnail. Usage: node scripts/master.mjs <render.mp4>
import { execFileSync, spawnSync } from 'node:child_process'
import { writeFileSync, statSync, mkdirSync } from 'node:fs'
import { schedule } from './schedule.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const D = `${root}../../deliverables/`
mkdirSync(D, { recursive: true })
const src = process.argv[2]
const out = `${D}BoliVerse_Gnani_Official_Demo_1080p.mp4`
const ln = (args) => { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8' }); const i = r.stderr.lastIndexOf('{'); return JSON.parse(r.stderr.slice(i, r.stderr.indexOf('}', i) + 1)) }
const p1 = ln(['-i', src, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', src, '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-af',
  `loudnorm=I=-16:TP=-1.5:LRA=11:measured_I=${p1.input_i}:measured_TP=${p1.input_tp}:measured_LRA=${p1.input_lra}:measured_thresh=${p1.input_thresh}:offset=${p1.target_offset}:linear=true,aresample=48000`,
  '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out])
const p2 = ln(['-i', out, '-vn', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
const pr = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate:format=duration', '-of', 'json', out]).toString())
const v = pr.streams.find((s) => s.codec_type === 'video'), a = pr.streams.find((s) => s.codec_type === 'audio')
const info = { duration: +pr.format.duration, width: v.width, height: v.height, fps: v.r_frame_rate, vcodec: v.codec_name, acodec: a?.codec_name, size: statSync(out).size, lufs: p2.input_i, tp: p2.input_tp }
writeFileSync(`${root}raw/final-probe.json`, JSON.stringify(info, null, 1))
// thumbnail: the steel bridge at sunset, a real app frame
const S = schedule(), b8 = S.studio.beats.find((b) => b.b === 'b08')
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(b8.run + 4.6 - S.studio.start), '-i', `${root}film/assets/media/studio.mp4`, '-frames:v', '1', '-q:v', '2', `${D}BoliVerse_Gnani_Official_Demo_Thumbnail.jpg`])
console.log(JSON.stringify(info))
