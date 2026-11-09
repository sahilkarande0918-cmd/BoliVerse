// Writes deliverables/*.md from the same timing data the film was built from.
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs'
import { schedule } from './schedule.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const D = `${root}../../deliverables/`
const S = schedule(), M = S.manifest
const T = JSON.parse(readFileSync(`${root}raw/timeline.json`, 'utf8'))
const cap = JSON.parse(readFileSync(`${root}raw/capture-log.json`, 'utf8'))
const media = JSON.parse(readFileSync(`${root}film/assets/media/media.json`, 'utf8'))
const final = JSON.parse(readFileSync(`${root}raw/final-probe.json`, 'utf8'))
const tc = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(1).padStart(4, '0')}`
const at = (id) => S.voice.find((v) => v.id === id).at
const LANG = { 'hi-IN': 'Hindi', 'mr-IN': 'Marathi', 'en-IN': 'English' }
const B = S.studio.beats, last = B.at(-1)

// ---- script ----
let s = `# BoliVerse — Official 2–3 minute demo · final script\n\nDuration ${tc(final.duration)} (${final.duration.toFixed(1)} s). Narrator: **Gnani Timbre v3.0, voice “${'Avinash'}” (synthetic)**. Builder: **Gnani Timbre v3.0, voice “Shivani” (synthetic test voice)**; every builder line was sent through BoliVerse's own \`/api/stt\` relay to **Gnani Prisma v3.0**, and the film shows Prisma's transcript.\n\n| Time | Who | Line (as spoken) | Prisma transcript · language · round trip |\n|---|---|---|---|\n`
for (const v of S.voice) {
  const m = M[v.id]
  s += `| ${tc(v.at)}–${tc(v.at + m.duration)} | ${v.id[0] === 'n' ? 'Narrator' : 'Builder'} | ${m.text} | ${m.transcript ? `${m.transcript} · ${LANG[m.language] ?? m.language} · ${m.sttMs} ms` : '—'} |\n`
}
s += `\nEnglish meanings of the builder lines are burned in under each transcript and listed in the SRT.\n`
writeFileSync(`${D}BoliVerse_Gnani_Official_Demo_Script.md`, s)

// ---- shot list ----
const L = (t) => tc(t)
let h = `# Shot list (actual sources)\n\nAll app footage is the real BoliVerse studio (local dev server, same code as https://boliverse.vercel.app at commit time), Ultra quality, 1920×1080, captured by \`scripts/capture.mjs\` in Microsoft Edge (Playwright).\n\n| Film time | Shot | Source |\n|---|---|---|\n`
h += `| ${L(0)}–${L(S.intro.end)} | Four 0.95 s cuts from later in the build (dawn stone bridge, red temple in rain, broken bridge, steel bridge at sunset), cropped to the 3D viewport; then the BoliVerse arch mark | \`raw/studio\` frames (frame-exact capture), app logo SVG from \`src/ui/Icon.tsx\` |\n`
h += `| ${L(S.landing.start)}–${L(S.landing.end)} | Landing page, hero then one slow scroll | \`raw/landing\`: real-time CDP screencast of \`/#/\` |\n`
h += `| ${L(S.studio.start)}–${L(S.studio.mainEnd)} | Studio: empty scene, panel tour, 8 voice commands, select/undo/redo, Simulate tab, Film tab | \`raw/studio\`: ${Math.round((S.studio.mainEnd - S.studio.start) * 30)} frame-exact 30 fps screenshots of the full UI |\n`
h += `| ${L(last.exportShow.start)}–${L(last.exportShow.start + last.exportShow.dur)} | In-app MP4 export in progress | \`raw/export\`: real-time screencast, ${media.exportSec.toFixed(1)} s shown in ${last.exportShow.dur} s (labelled) |\n`
h += `| ${L(last.readyShow.start)}–${L(S.studio.end)} | “Video ready” state + the exported file playing picture-in-picture | screencast after ready + \`raw/inapp-export.mp4\` (${media.inapp.w}×${media.inapp.h}, ${media.inapp.sec.toFixed(1)} s, silent, made by the app) |\n`
h += `| ${L(S.diagram.start)}–${L(S.diagram.end)} | Pipeline diagram | HyperFrames graphic (labelled “Diagram, not app footage”) |\n`
h += `| ${L(S.end.start)}–${L(S.end.end)} | End slate: URL, repo, credits | HyperFrames graphic |\n\n## Builder commands\n\n| Said at | Command (Prisma transcript) | Applied at | Operations the app produced |\n|---|---|---|---|\n`
for (const b of B) {
  const lg = cap.log.find((l) => l.b === b.b)
  h += `| ${L(at(b.b))} | ${M[b.b].transcript} | ${b.export ? L(b.run) + ' (export screencast)' : L(b.run)} | ${(lg?.ops ?? []).join(', ')} |\n`
}
h += `\n## Real UI clicks (Playwright mouse on the actual controls)\n\n` + S.studio.clicks.map((c) => `- ${L(c.at)} — ${c.tab ? `“${c.tab}” tab` : c.button ? `${c.button} button` : `click on the ${c.select} in the viewport (selects it; Inspector shows it)`}${cap.log.find((l) => l.click && l.click.at === c.at)?.click?.note ? ` (${cap.log.find((l) => l.click && l.click.at === c.at).click.note})` : ''}`).join('\n') + '\n'
writeFileSync(`${D}BoliVerse_Gnani_Official_Demo_Shotlist.md`, h)

// ---- verification ----
let v = `# Demo verification\n\nFinal file: \`deliverables/BoliVerse_Gnani_Official_Demo_1080p.mp4\` — ${final.width}×${final.height}, ${final.fps} fps, ${final.vcodec} + ${final.acodec}, ${final.duration.toFixed(2)} s, ${(final.size / 1e6).toFixed(1)} MB, integrated loudness ${final.lufs} LUFS, true peak ${final.tp} dBTP (measured with ffmpeg \`loudnorm\`; the mix was measured, not listened to by a person).\n\nCaptured ${cap.when} at quality **${cap.quality}**.\n\n## What is real\n\n`
v += `| Film time | Feature shown | Evidence |\n|---|---|---|\n`
v += `| ${L(S.landing.start)} | Landing page | real-time screencast of the running site code |\n| ${L(S.studio.start)} | Studio layout: Voice Studio, viewport, Inspector, Build/Simulate/Film | frame-exact capture of the real UI |\n`
for (const b of B) {
  const m = M[b.b], lg = cap.log.find((l) => l.b === b.b)
  v += `| ${L(at(b.b))} | “${m.transcript}” (${LANG[m.language]}) → ${(lg?.ops ?? []).join(', ')} | Timbre test clip \`raw/voice/${b.b}.wav\` → BoliVerse \`/api/stt\` → Gnani Prisma ${m.model} at ${m.at}, ${m.sttMs} ms round trip (provider ${m.providerLatencyMs} ms). The app then ran that transcript through its real parser and world. |\n`
}
v += `| ${S.studio.clicks.map((c) => L(c.at)).join(', ')} | Select (Inspector), Undo, Redo, Simulate tab, Film tab | real Playwright mouse clicks on the live controls |\n`
v += `| ${L(last.exportShow.start)} | In-app MP4 export | real export; file saved as \`raw/inapp-export.mp4\` and shown picture-in-picture |\n\n`
v += `## What is staged, edited or illustrative (disclosed)\n\n`
v += `- **Voices are synthetic.** Narrator and builder are both Gnani Timbre v3.0 (Avinash and Shivani). No human microphone session appears in this film; the mic → Prisma path for a human voice is implemented but must be verified by the team in person.\n`
v += `- **Transcription happened just before capture**, not during it: each builder clip was sent to Prisma (real call, timings logged in \`raw/voice/manifest.json\`), and during the frame-exact capture the studio was driven through its normal voice states (Listening → Transcribing → Heard) with that clip's own samples feeding the waveform. The wait between “Transcribing” and the result is time-cut to 0.6 s; the real measured latency is what the UI shows.\n`
v += `- **Frame-exact capture.** The studio was rendered at exactly 30 fps of simulated time (frameloop paused, advanced per frame), so the 3D runs smoothly even though Ultra renders slower than real time on this laptop. The FPS readout was hidden because in this mode it would show the video rate, not a measurement.\n`
v += `- **Camera moves between commands** were made by the capture script through the same OrbitControls a user drags; positions come from the live entities.\n`
v += `- **Export sped up:** the in-app export took ${media.exportSec.toFixed(1)} s in real time and is shown in ${last.exportShow.dur} s (labelled on screen).\n`
v += `- **Diagram and title/end cards** are HyperFrames graphics, labelled “Diagram, not app footage”.\n`
v += `- **Captions** are the script text, timed to the narrator audio with Parakeet word timestamps; builder captions show Prisma's transcript plus an English meaning.\n`
v += `- **No music bed** (no licensed or locally generated music source was available); a few Pixabay-licensed UI sounds from the HyperFrames library mark cuts, clicks and the bridge break.\n\n`
v += `## Bugs fixed while filming (in the app, tested)\n\n- “Temple ko laal karo” / “make the temple red” created a new red temple instead of recolouring the existing one (parser) — fixed, tests added.\n- Scanned Poly Haven models loaded without textures (texture URLs not mapped) — fixed in \`src/engine/library.ts\`.\n- “Wooden bench” matched a metal bench vice; the material word is now part of the model search.\n`
writeFileSync(`${D}DEMO_VERIFICATION.md`, v)
copyFileSync(`${root}raw/subtitles.srt`, `${D}BoliVerse_Gnani_Official_Demo_Subtitles.srt`)
console.log('docs written')
