// Writes the HyperFrames project in film/ from the shared schedule, the voice manifest and the
// narrator word timings (Parakeet). Media must already be in film/assets (see make-media.mjs).
// Re-run after any timing change; the HTML it writes is plain, editable HyperFrames source.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { schedule } from './schedule.mjs'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const F = `${root}film/`
const S = schedule()
const M = S.manifest
const r2 = (x) => Math.round(x * 1000) / 1000
const at = (id) => S.voice.find((v) => v.id === id).at
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const media = JSON.parse(readFileSync(`${F}assets/media/media.json`, 'utf8'))

// ---------- narrator caption groups, timed from Parakeet word timings ----------
function groups(id) {
  const text = M[id].text, A = JSON.parse(readFileSync(`${root}raw/words/${id}.json`, 'utf8'))
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const aLen = A.map((w) => norm(w.text).length || 1), aTot = aLen.reduce((a, b) => a + b, 0)
  const S2 = text.split(/\s+/), sLen = S2.map((w) => norm(w).length || 1), sTot = sLen.reduce((a, b) => a + b, 0)
  const timeAt = (frac) => { // fraction of spoken characters → seconds, interpolated inside the ASR word
    let acc = 0
    for (let i = 0; i < A.length; i++) {
      const f0 = acc / aTot, f1 = (acc + aLen[i]) / aTot
      if (frac <= f1 + 1e-9) return A[i].start + (A[i].end - A[i].start) * Math.max(0, Math.min(1, (frac - f0) / (f1 - f0 || 1)))
      acc += aLen[i]
    }
    return A.at(-1).end
  }
  const out = []
  let cur = [], acc = 0, gStart = 0
  S2.forEach((w, i) => {
    if (!cur.length) gStart = acc
    cur.push(w); acc += sLen[i]
    const len = cur.join(' ').length
    if (/[.?!:,]$/.test(w) && len > 14 || len > 40 || i === S2.length - 1) {
      out.push({ text: cur.join(' '), start: timeAt(gStart / sTot), end: timeAt(acc / sTot) })
      cur = []
    }
  })
  const base = at(id)
  // each group ends one frame before the next one starts: never two subtitles on screen
  return out.map((g, i) => ({ text: g.text, start: r2(base + g.start - 0.05), end: r2(base + Math.min(g.end + 0.25, out[i + 1] ? out[i + 1].start - 0.05 - 1 / 30 : g.end + 0.6)) }))
}
const wordTime = (id, word) => { const A = JSON.parse(readFileSync(`${root}raw/words/${id}.json`, 'utf8')); const w = A.find((x) => x.text.toLowerCase().replace(/[^a-z]/g, '').startsWith(word)); return w ? at(id) + w.start : null }

const TRANSLATE = {
  b01: 'Make a river, and plant twenty trees.',
  b02: 'Build a temple near the river, and put five lamps near the temple.',
  b03: 'Build a stone bridge over the river, and make it sunrise.',
  b04: null,
  b05: 'Make the temple red.',
  b06: 'Start the rain.',
  b07: 'Now break the bridge.',
  b08: 'Rebuild the bridge in steel, and make it sunset.',
  b09: 'Show the temple with a cinematic camera; make an eight-second video.',
}
const LANG = { 'hi-IN': 'Hindi', 'mr-IN': 'Marathi', 'en-IN': 'English' }

// ---------- shared style ----------
const FONTS = `@font-face{font-family:'Jost';src:url('assets/fonts/jost.woff2') format('woff2');font-weight:300 600}
@font-face{font-family:'Noto Sans Devanagari';src:url('assets/fonts/noto-devanagari.woff2') format('woff2');font-weight:300 600}`
const TOK = `--bg:#e7e0d8;--panel:#f2ede7;--ink:#34302d;--muted:#5c534d;--faint:#6f665f;--line:rgba(52,48,45,.16)`
const MARK = (s, c = '#34302D') => `<svg width="${s}" height="${s}" viewBox="0 0 64 64"><path d="M16 54V30a16 16 0 0 1 32 0v24" fill="none" stroke="${c}" stroke-width="3.5"/><circle cx="32" cy="40" r="3.5" fill="${c}"/></svg>`
const scene = (id, dur, css, html, js) => `<template>
<style>${FONTS}
#root{position:absolute;inset:0;${TOK};font-family:'Jost','Noto Sans Devanagari',sans-serif;color:var(--ink);overflow:hidden}
${css}</style>
<div id="root" data-composition-id="${id}" data-width="1920" data-height="1080" data-duration="${r2(dur)}">
${html}
</div>
<script>
const tl = gsap.timeline({ paused: true });
${js}
window.__timelines["${id}"] = tl;
</script>
</template>
`
mkdirSync(`${F}compositions`, { recursive: true })

// ---------- 1. intro: four real frames from the capture, then the mark ----------
{
  const d = S.intro.end, st = S.studio.start
  const B = Object.fromEntries(S.studio.beats.map((b) => [b.b, b]))
  const cuts = [B.b03.run + 3.2, B.b06.run + 4.2, B.b07.run + 2.6, B.b08.run + 4.5].map((t) => r2(t - st))
  const len = 0.95
  let html = '', js = ''
  cuts.forEach((m, i) => {
    html += `<div id="in-c${i}" style="position:absolute;inset:0"><div id="in-w${i}" class="vp"><video id="in-v${i}" class="clip" data-start="${r2(i * len)}" data-duration="${len}" data-media-start="${m}" src="assets/media/studio.mp4" muted playsinline></video></div></div>\n`
    js += `tl.fromTo("#in-w${i}", { scale: 1.55 }, { scale: 1.62, duration: ${len}, ease: "none" }, ${r2(i * len)});\n`
  })
  const T = r2(cuts.length * len)
  html += `<div id="in-title" class="clip" data-start="${T}" data-duration="${r2(d - T)}"><div id="in-inner"><div id="in-mark">${MARK(132)}</div><div id="in-word">boliverse</div><div id="in-line">Speak a world into existence.</div></div></div>`
  js += `tl.fromTo("#in-mark", { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: "power3.out" }, ${T + 0.15});
tl.fromTo("#in-word", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" }, ${T + 0.45});
tl.fromTo("#in-line", { opacity: 0 }, { opacity: 1, duration: 0.6, ease: "power2.out" }, ${T + 0.9});`
  const css = `.vp{position:absolute;inset:0;transform-origin:980px 536px}.vp video{position:absolute;inset:0;width:1920px;height:1080px}
#in-title{position:absolute;inset:0;background:var(--bg)}#in-inner{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px}
#in-word{font-size:96px;font-weight:500;letter-spacing:-.02em}#in-line{font-size:30px;font-weight:300;color:var(--muted);margin-top:6px}`
  writeFileSync(`${F}compositions/intro.html`, scene('intro', d, css, html, js))
}

// ---------- 2. landing: real-time screencast of the live landing page ----------
{
  const d = S.landing.end - S.landing.start
  const html = `<video id="ld-v" class="clip" data-start="0" data-duration="${r2(d)}" src="assets/media/landing.mp4" muted playsinline style="position:absolute;inset:0;width:1920px;height:1080px"></video>
<div id="ld-tag" class="clip" data-start="0.6" data-duration="${r2(d - 1.2)}"><span class="ey">Live site</span><span>boliverse.vercel.app</span></div>`
  const css = `#ld-tag{position:absolute;left:64px;bottom:64px;display:flex;gap:16px;align-items:baseline;background:rgba(242,237,231,.94);padding:14px 22px;border:1px solid var(--line);font-size:26px}
.ey{font-size:20px;letter-spacing:.24em;text-transform:uppercase;color:var(--muted)}`
  const js = `tl.fromTo("#ld-tag > *", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .5, stagger: .08, ease: "power3.out" }, 0.6);
tl.to("#ld-tag > *", { opacity: 0, duration: .3 }, ${r2(d - 1.6)});`
  writeFileSync(`${F}compositions/landing.html`, scene('landing', d, css, html, js))
}

// ---------- 3. studio: the frame-exact capture + export, with editorial overlays ----------
{
  const st = S.studio.start, d = S.studio.end - st, L = (t) => r2(t - st)
  const last = S.studio.beats.at(-1)
  const ex = last.exportShow, rd = last.readyShow
  let html = `<div id="st-cam">
<video id="st-main" class="clip" data-start="0" data-duration="${L(S.studio.mainEnd)}" src="assets/media/studio.mp4" muted playsinline></video>
<video id="st-exp" class="clip" data-start="${L(ex.start)}" data-duration="${r2(ex.dur)}" src="assets/media/export.mp4" muted playsinline></video>
<video id="st-ready" class="clip" data-start="${L(rd.start)}" data-duration="${r2(rd.dur)}" src="assets/media/ready.mp4" muted playsinline></video>
</div>\n`
  let js = ''
  // tour: hairline boxes on the real panels, each when the narrator names it
  const tour = [
    ['voice', [0, 56, 340, 1024], 'Voice Studio', wordTime('n03', 'speak')],
    ['world', [356, 56, 1248, 960], 'Live 3D world', wordTime('n03', 'your')],
    ['insp', [1620, 56, 300, 1024], 'Inspector', wordTime('n03', 'inspector')],
    ['tabs', [868, 8, 184, 40], 'Build · Simulate · Film', wordTime('n03', 'environment') ?? at('n03') + 6.5],
  ]
  const tourEnd = at('n03') + M.n03.duration
  for (const [k, [x, y, w, h], label, t] of tour) {
    const s = L(t ?? at('n03')), e = L(tourEnd + 0.3)
    html += `<div id="tr-${k}" class="clip tour" data-start="${s}" data-duration="${r2(e - s)}" style="left:${x + 4}px;top:${y + 4}px;width:${w - 8}px;height:${h - 8}px"><div class="tour-box"></div><span class="tour-tag" style="${k === 'tabs' ? 'top:52px;left:0' : 'top:14px;left:14px'}">${label}</span></div>\n`
    js += `tl.fromTo("#tr-${k} .tour-box", { opacity: 0, scale: 1.02 }, { opacity: 1, scale: 1, duration: .45, ease: "power3.out" }, ${s});
tl.fromTo("#tr-${k} .tour-tag", { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: .4, ease: "power3.out" }, ${r2(s + 0.1)});
tl.to("#tr-${k} > *", { opacity: 0, duration: .25 }, ${r2(e - 0.3)});\n`
  }
  // chapters
  const B = Object.fromEntries(S.studio.beats.map((b) => [b.b, b]))
  const clickAt = (tab) => S.studio.clicks.find((c) => c.tab === tab).at
  const chapters = [['01', 'Build', B.b01.listen], ['02', 'Understand', B.b02.listen], ['03', 'Create', B.b04.listen], ['04', 'Simulate', clickAt('simulate')], ['05', 'Film', clickAt('film')]]
  chapters.forEach(([n, name, t], i) => {
    const s = L(t), dd = 3.2
    html += `<div id="ch-${i}" class="clip chap" data-start="${s}" data-duration="${dd}"><span class="ch-n">${n}</span><span class="ch-name">${name}</span></div>\n`
    js += `tl.fromTo("#ch-${i} > *", { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .5, stagger: .08, ease: "power3.out" }, ${s});
tl.to("#ch-${i} > *", { opacity: 0, duration: .3 }, ${r2(s + dd - 0.35)});\n`
  })
  // builder cards: what was said (Prisma transcript), language, English meaning
  for (const b of S.studio.beats) {
    const m = M[b.b], s = L(at(b.b) - 0.15), e = L(b.run + 0.7)
    const deva = /[ऀ-ॿ]/.test(m.transcript)
    html += `<div id="bd-${b.b}" class="clip bcard" data-start="${s}" data-duration="${r2(e - s)}"><div class="b-ey">Builder · ${LANG[m.language] ?? m.language} · Gnani Timbre test voice → Gnani Prisma</div><div class="b-say${deva ? ' deva' : ''}">“${esc(m.transcript)}”</div>${TRANSLATE[b.b] ? `<div class="b-en">${esc(TRANSLATE[b.b])}</div>` : ''}</div>\n`
    js += `tl.fromTo("#bd-${b.b} > *", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: .4, stagger: .06, ease: "power3.out" }, ${s});
tl.to("#bd-${b.b} > *", { opacity: 0, duration: .25 }, ${r2(e - 0.28)});\n`
  }
  // punch-in: speech → transcript → commands, on the real Voice Studio panel
  const zIn = L(B.b01.run + 0.75), zOut = L(wordTime('n04', 'builds') ?? B.b01.run + 6)
  js += `tl.fromTo("#st-cam", { scale: 1 }, { scale: 1.6, duration: .9, ease: "power3.inOut" }, ${zIn});
tl.to("#st-cam", { scale: 1, duration: .9, ease: "power3.inOut" }, ${zOut});\n`
  // lower thirds naming the technology on screen
  const lts = [
    ['prisma', 'Gnani Prisma v3.0', 'speech to text · language auto-detect', B.b01.transcribing - 0.1, 3.4],
    ['lib', 'Poly Haven model library', 'CC0 scanned models, searched by your words', B.b04.run + 1.6, 3.6],
    ['undo', 'Undo · Redo', 'real clicks on the toolbar', S.studio.clicks.find((c) => c.button === 'Undo').at - 0.2, 2.8],
    ['rapier', 'Rapier physics + route graph', 'debris is simulated; the crossing is blocked', B.b07.run + 1.0, 4.2],
    ['exp', 'In-app export, real time', `≈${media.exportSec.toFixed(0)} s of rendering, shown faster`, ex.start + 0.15, ex.dur - 0.3],
    ['file', 'The exported file', `${media.inapp.w}×${media.inapp.h} · H.264 MP4 · ${media.inapp.sec.toFixed(0)} s · silent`, rd.start + 0.4, rd.dur - 0.6],
  ]
  for (const [k, a, b2, t, dd] of lts) {
    const s = L(t)
    html += `<div id="lt-${k}" class="clip lt" data-start="${s}" data-duration="${r2(dd)}"><div class="lt-a">${a}</div><div class="lt-b">${b2}</div></div>\n`
    js += `tl.fromTo("#lt-${k} > *", { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .45, stagger: .07, ease: "power3.out" }, ${s});
tl.to("#lt-${k} > *", { opacity: 0, duration: .25 }, ${r2(s + dd - 0.3)});\n`
  }
  // the exported MP4 itself, picture-in-picture over the viewport
  html += `<div id="pip"><div id="pip-in"><video id="pip-v" class="clip" data-start="${L(rd.start + 0.2)}" data-duration="${r2(rd.dur - 0.2)}" data-media-start="0.6" src="assets/media/inapp-export.mp4" muted playsinline></video></div></div>\n`
  js += `tl.fromTo("#pip-in", { opacity: 0, scale: .96 }, { opacity: 1, scale: 1, duration: .6, ease: "power3.out" }, ${L(rd.start + 0.2)});\n`
  const css = `#st-cam{position:absolute;inset:0;transform-origin:0px 430px}#st-cam video{position:absolute;inset:0;width:1920px;height:1080px}
.tour{position:absolute}.tour-box{position:absolute;inset:0;border:2px solid rgba(52,48,45,.85);box-shadow:0 0 0 9999px rgba(231,224,216,.0)}
.tour-tag{position:absolute;background:var(--ink);color:#f4efe9;font-size:26px;letter-spacing:.04em;padding:8px 14px;white-space:nowrap}
.chap{position:absolute;left:388px;top:86px;display:flex;align-items:baseline;gap:14px;background:rgba(242,237,231,.94);padding:12px 22px 12px 18px;border:1px solid var(--line)}
.ch-n{font-size:22px;color:var(--muted);letter-spacing:.1em}.ch-name{font-size:26px;letter-spacing:.32em;text-transform:uppercase;font-weight:500}
.bcard{position:absolute;left:420px;width:1120px;bottom:118px;background:rgba(52,48,45,.94);color:#f4efe9;padding:22px 30px 24px;text-align:left}
.b-ey{font-size:20px;letter-spacing:.14em;text-transform:uppercase;color:#e2d9cf}.b-say{font-size:38px;line-height:1.3;margin-top:10px;font-weight:400}
.b-say.deva{font-family:'Noto Sans Devanagari','Jost',sans-serif}.b-en{font-size:27px;color:#e2d9cf;margin-top:8px;font-weight:300}
.lt{position:absolute;right:340px;top:86px;text-align:right;background:rgba(242,237,231,.95);padding:14px 22px;border:1px solid var(--line)}
.lt-a{font-size:27px;font-weight:500}.lt-b{font-size:23px;color:var(--muted);margin-top:4px}
#pip{position:absolute;left:356px;top:56px;width:1248px;height:960px;display:flex;align-items:center;justify-content:center}
#pip-in{width:896px;height:504px;position:relative;box-shadow:0 30px 80px -20px rgba(46,42,39,.55);border:1px solid rgba(255,255,255,.6)}
#pip-in video{position:absolute;inset:0;width:896px;height:504px;object-fit:cover}`
  writeFileSync(`${F}compositions/studio.html`, scene('studio', d, css, html, js))
}

// ---------- 4. pipeline diagram (illustrative, not app footage) ----------
{
  const d = S.diagram.end - S.diagram.start, L = (t) => r2(t - S.diagram.start)
  const n13 = (w, fb) => L(wordTime('n13', w) ?? at('n13') + fb)
  const nodes = [
    ['dg-voice', 'Your voice', 'Hindi · Marathi · English · Hinglish', 0.3],
    ['dg-prisma', 'Gnani Prisma', 'speech → text', n13('prisma', 1.6)],
    ['dg-comp', 'Command compiler', 'local multilingual parser · Groq fallback', n13('multilingual', 3.2)],
    ['dg-zod', 'Validated commands', 'every operation checked against a schema', n13('validated', 6.4)],
    ['dg-three', 'Three.js world', 'persistent, editable 3D scene', n13('three', 7.8)],
    ['dg-rapier', 'Rapier physics', 'debris, buoyancy, routes', n13('rapier', 8.8)],
  ]
  let html = `<div id="dg-head" class="clip" data-start="0.2" data-duration="${r2(d - 0.4)}"><span class="ey">How it works</span><span class="note">Diagram, not app footage</span></div><div id="dg-row">`
  let js = `tl.fromTo("#dg-head > *", { opacity: 0 }, { opacity: 1, duration: .5, stagger: .1 }, 0.2);\n`
  nodes.forEach(([id, a, b, t], i) => {
    html += `${i ? `<div id="${id}-ln" class="clip ln" data-start="${t}" data-duration="${r2(d - t)}"><i></i></div>` : ''}<div id="${id}" class="clip node" data-start="${t}" data-duration="${r2(d - t)}"><div class="n-a">${a}</div><div class="n-b">${b}</div></div>`
    if (i) js += `tl.fromTo("#${id}-ln i", { scaleX: 0 }, { scaleX: 1, duration: .35, ease: "power2.out", transformOrigin: "0 50%" }, ${t});\n`
    js += `tl.fromTo("#${id} > *", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: "power3.out" }, ${r2(t + (i ? 0.2 : 0))});\n`
  })
  const tT = n13('timbre', 10.2)
  html += `</div><div id="dg-timbre" class="clip node wide" data-start="${tT}" data-duration="${r2(d - tT)}"><div class="n-a">Gnani Timbre</div><div class="n-b">spoken replies · the voices in this film (synthetic)</div></div>
<div id="dg-mp4" class="clip node wide" data-start="${n13('rapier', 8.8) + 0.5}" data-duration="${r2(d - n13('rapier', 8.8) - 0.5)}"><div class="n-a">MP4 export</div><div class="n-b">WebCodecs, in the browser</div></div>`
  js += `tl.fromTo("#dg-timbre > *, #dg-mp4 > *", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .45, stagger: .06, ease: "power3.out" }, ${n13('rapier', 8.8) + 0.5});\n`
  const css = `#root{background:var(--bg)}#dg-head{position:absolute;left:120px;top:150px;display:flex;gap:28px;align-items:baseline}
.ey{font-size:24px;letter-spacing:.3em;text-transform:uppercase;color:var(--muted)}.note{font-size:22px;color:var(--muted)}
#dg-row{position:absolute;left:120px;right:120px;top:330px;display:flex;align-items:stretch}
.node{position:relative;flex:1;border-top:2px solid var(--ink);padding-top:22px;min-width:0}.ln{position:relative;width:34px;flex:none}
.ln i{position:absolute;left:4px;right:4px;top:-1px;height:2px;background:var(--faint)}
.n-a{font-size:34px;font-weight:500;letter-spacing:-.01em;line-height:1.1}.n-b{font-size:24px;color:var(--muted);margin-top:12px;line-height:1.35;padding-right:12px}
.wide{position:absolute;top:640px;width:560px;flex:none}#dg-timbre{left:120px}#dg-mp4{right:120px;text-align:right}`
  writeFileSync(`${F}compositions/diagram.html`, scene('diagram', d, css, html, js))
}

// ---------- 5. end slate ----------
{
  const d = S.end.end - S.end.start
  const html = `<div id="en-in" class="clip" data-hold="credits need reading time" data-start="0" data-duration="${r2(d)}"><div id="en-mark">${MARK(96)}</div><div id="en-title">BoliVerse</div><div id="en-line">Your words, your world.</div><div id="en-rule"></div>
<div id="en-meta"><div>boliverse.vercel.app</div><div>github.com/sahilkarande0918-cmd/BoliVerse</div></div>
<div id="en-cred">Speech: Gnani Prisma v3.0 · Voices: Gnani Timbre v3.0 (synthetic) · Three.js · Rapier · Built by Sahil Karande &amp; Purvesh Mhatre<br>Gnani AI · Great Indian AI Internship Challenge · #GnaniAI #GreatIndianAIInternshipChallenge</div></div>`
  const css = `#root{background:var(--bg)}#en-in{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding-bottom:190px}
#en-title{font-size:92px;font-weight:500;letter-spacing:-.02em;margin-top:8px}#en-line{font-size:32px;font-weight:300;color:var(--muted)}
#en-rule{width:520px;height:1px;background:var(--line);margin:28px 0 20px}#en-meta{font-size:28px;text-align:center;line-height:1.55}
#en-cred{position:absolute;bottom:70px;left:0;right:0;text-align:center;font-size:24px;color:var(--muted);line-height:1.6}`
  const js = `tl.fromTo("#en-in > *", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6, stagger: .09, ease: "power3.out" }, 0.15);`
  writeFileSync(`${F}compositions/end.html`, scene('end', d, css, html, js))
}

// ---------- captions: narrator subtitles (one track) ----------
// n14 is the end slate's own line, printed on the slate; its subtitle would sit on the credits
const caps = [...S.voice.filter((v) => v.id[0] === 'n' && v.id !== 'n14').flatMap((v) => groups(v.id))]
{
  const d = S.total
  // inside the studio the subtitles sit over the 3D viewport; elsewhere, centred on the frame
  const inStudio = (t) => t >= S.studio.start && t < S.studio.end
  let html = '', js = ''
  caps.forEach((g, i) => {
    html += `<div id="cap-${i}" class="clip cap${inStudio(g.start) ? ' st' : ''}" data-start="${g.start}" data-duration="${r2(g.end - g.start)}"><span>${esc(g.text)}</span></div>\n`
    js += `tl.fromTo("#cap-${i} span", { opacity: 0 }, { opacity: 1, duration: .12, ease: "power2.out" }, ${g.start});\n`
  })
  const css = `.cap{position:absolute;left:0;right:0;bottom:64px;text-align:center}.cap.st{left:356px;width:1248px;right:auto;bottom:96px}
.cap span{display:inline-block;max-width:1180px;background:rgba(242,237,231,.92);color:var(--ink);font-size:33px;line-height:1.3;padding:8px 18px;font-weight:400}`
  writeFileSync(`${F}compositions/captions.html`, scene('captions', d, css, html, js))
}

// ---------- root ----------
const host = (id, s, e, track, kind = 'graphics') => `<div id="${id}" data-composition-id="${id}" data-composition-src="compositions/${id}.html" data-start="${r2(s)}" data-duration="${r2(e - s)}" data-track-index="${track}" data-track-kind="${kind}" data-width="1920" data-height="1080"></div>`
const sfx = []
const SFXLEN = { 'whoosh-short.mp3': 0.57, 'click-soft.mp3': 0.37, 'impact-bass-1.mp3': 2.12 }
const sf = (file, t, v = 0.3) => sfx.push(`<audio id="sfx-${sfx.length}" class="clip" data-start="${r2(t)}" data-duration="${SFXLEN[file]}" data-track-index="${30 + (sfx.length % 3)}" src="assets/sfx/${file}" data-volume="${v}"></audio>`)
sf('whoosh-short.mp3', S.intro.end - 0.12, 0.22); sf('whoosh-short.mp3', S.landing.end - 0.12, 0.22); sf('whoosh-short.mp3', S.studio.end - 0.12, 0.22)
for (const c of S.studio.clicks) sf('click-soft.mp3', c.at, 0.35)
sf('impact-bass-1.mp3', S.studio.beats.find((b) => b.b === 'b07').run + 0.05, 0.3)
const voices = S.voice.map((v, i) => `<audio id="vo-${v.id}" class="clip" data-start="${v.at}" data-duration="${r2(M[v.id].duration)}" data-track-index="${v.id[0] === 'n' ? 20 : 21}" src="assets/voice/${v.id}.mp3" data-volume="1"></audio>`)
const index = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920, height=1080" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
@font-face{font-family:'Jost';src:url('assets/fonts/jost.woff2') format('woff2');font-weight:300 600}
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:#e7e0d8}
#bg{position:absolute;inset:0;background:#e7e0d8}
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="${r2(S.total)}" data-width="1920" data-height="1080">
<div id="bg"></div>
${host('intro', 0, S.intro.end, 1)}
${host('landing', S.landing.start, S.landing.end, 2)}
${host('studio', S.studio.start, S.studio.end, 3)}
${host('diagram', S.diagram.start, S.diagram.end, 4)}
${host('end', S.end.start, S.end.end, 5)}
${host('captions', 0, S.total, 10, 'captions')}
${voices.join('\n')}
${sfx.join('\n')}
</div>
<script>window.__timelines["main"] = gsap.timeline({ paused: true });</script>
</body>
</html>
`
writeFileSync(`${F}index.html`, index)

// ---------- SRT (narrator + builder), script and timing data for the docs ----------
const ts = (t) => { const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = Math.floor(t) % 60, ms = Math.round((t % 1) * 1000); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}` }
const cues = [...caps.map((g) => ({ s: g.start, e: g.end, t: g.text })), ...groups('n14').map((g) => ({ s: g.start, e: g.end, t: g.text })),
  ...S.studio.beats.map((b) => ({ s: at(b.b), e: at(b.b) + M[b.b].duration + 0.3, t: `[Builder, ${LANG[M[b.b].language]}] ${M[b.b].transcript}${TRANSLATE[b.b] ? `\n(${TRANSLATE[b.b]})` : ''}` }))].sort((a, b) => a.s - b.s)
writeFileSync(`${root}raw/subtitles.srt`, cues.map((c, i) => `${i + 1}\n${ts(c.s)} --> ${ts(c.e)}\n${c.t}\n`).join('\n'))
writeFileSync(`${root}raw/timeline.json`, JSON.stringify({ ...S, manifest: undefined, captions: caps, translate: TRANSLATE }, null, 1))
console.log('film written:', r2(S.total), 's,', caps.length, 'caption groups,', cues.length, 'srt cues')
