import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { Icon, Mark } from './Icon'

const HeroWorld = lazy(() => import('./HeroWorld'))
const REPO = 'https://github.com/sahilkarande0918-cmd/BoliVerse'

function useLiveHero() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const slow = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (reduced || slow) return
    const id = setTimeout(() => setOk(true), 200) // let the text paint first
    return () => clearTimeout(id)
  }, [])
  return ok
}

export function Landing() {
  const live = useLiveHero()
  const year = useMemo(() => new Date().getFullYear(), [])
  return (
    <div className="min-h-full bg-[var(--bg)]">
      {/* ---------- hero ---------- */}
      <section className="relative h-[100svh] min-h-[620px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,#5a3a1e_0%,#1a1410_45%,#080a0c_80%)]" />
        {live && <Suspense fallback={null}><div className="absolute inset-0 opacity-0 [animation:rise_2.4s_ease_0.2s_forwards]"><HeroWorld /></div></Suspense>}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(8,10,12,0.92)_0%,rgba(8,10,12,0.55)_42%,rgba(8,10,12,0)_70%),linear-gradient(0deg,#080a0c_2%,rgba(8,10,12,0)_35%)]" />

        <header className="relative z-10 mx-auto flex max-w-7xl items-center gap-6 px-4 py-5 sm:px-8">
          <a href="#/" className="flex items-center gap-2"><Mark size={26} /><span className="font-display text-2xl">BoliVerse</span></a>
          <nav className="ml-auto hidden items-center gap-6 text-[13px] text-[var(--muted)] md:flex">
            <a href="#how" className="hover:text-[var(--text)]">How it works</a>
            <a href="#physics" className="hover:text-[var(--text)]">Physics</a>
            <a href="#languages" className="hover:text-[var(--text)]">Languages</a>
            <a href="#film" className="hover:text-[var(--text)]">Film</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-[var(--text)]">GitHub</a>
          </nav>
          <a href="#/studio" className="btn ml-auto md:ml-0">Open Studio</a>
        </header>

        <div className="relative z-10 mx-auto flex h-[calc(100%-88px)] max-w-7xl items-end px-4 pb-14 sm:px-8 sm:pb-20">
          <div className="grid w-full items-end gap-10 lg:grid-cols-[1fr_360px]">
            <div className="rise max-w-2xl">
              <p className="label mb-5 !text-[var(--gold)]">Multilingual voice → live 3D world compiler</p>
              <h1 className="font-display text-[clamp(3.2rem,9vw,7.5rem)] leading-[0.88] tracking-[-0.02em]">Your words.<br /><em className="text-[var(--gold-2)]">Your world.</em></h1>
              <p className="mt-6 max-w-md text-[17px] leading-relaxed text-[#cfc8bb]">Speak in Hindi, Marathi, Hinglish or English. BoliVerse compiles every sentence into safe, typed edits of a persistent 3D world, with real physics and consequences.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#/studio" className="btn btn-gold h-11 px-6 text-sm">Enter the Studio <Icon name="arrow" size={15} /></a>
                <a href="#demo" className="btn h-11 px-6 text-sm"><Icon name="play" size={14} />Watch Demo</a>
              </div>
            </div>
            <aside className="glass rise hidden rounded-2xl p-5 [animation-delay:0.25s] lg:block" aria-label="Live pipeline">
              <p className="label mb-1">Live pipeline</p>
              <p className="mb-4 font-display text-2xl">“Ab bridge tod do.”</p>
              <ol className="space-y-2.5 text-[13px]">
                {[
                  ['Gnani Prisma v3.0', 'speech → text, code-mixed'],
                  ['Compiler', 'local parser · Groq fallback'],
                  ['Zod-validated ops', 'DESTROY_STRUCTURE(bridge_1)'],
                  ['Rapier physics', 'deck fractures into rigid bodies'],
                  ['Causal graph', 'river crossing blocked'],
                ].map(([a, b], i) => (
                  <li key={a} className="flex gap-3">
                    <span className="tnum mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[var(--line-2)] text-[10px] text-[var(--gold)]">{i + 1}</span>
                    <span><b className="font-medium">{a}</b><span className="block text-[var(--muted)]">{b}</span></span>
                  </li>
                ))}
              </ol>
              <a href="#/studio" className="btn mt-5 w-full">Try it live</a>
            </aside>
          </div>
        </div>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <p className="label mb-3">How it works</p>
        <h2 className="max-w-3xl font-display text-[clamp(2.2rem,5vw,3.8rem)] leading-[1.02]">A spoken programming language for living worlds.</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--line)] md:grid-cols-4">
          {[
            ['Speak', 'Your voice is captured in the browser and sent through our server to Gnani Prisma. Keys never reach the page.'],
            ['Compile', 'A deterministic Hindi/Marathi/English grammar handles everyday commands with no network call. Complex requests go to Groq, which is constrained to a typed operation schema.'],
            ['Resolve', '“it”, “that bridge”, “same jagah” and “school ke paas” resolve against real entity IDs and spatial solvers.'],
            ['Simulate', 'The world mutates transactionally with undo. Rapier physics and a traversal graph show the consequences.'],
          ].map(([t, d], i) => (
            <div key={t} className="bg-[var(--panel)] p-6">
              <span className="tnum font-mono text-xs text-[var(--gold)]">0{i + 1}</span>
              <h3 className="mt-6 font-display text-3xl">{t}</h3>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- physics ---------- */}
      <section id="physics" className="border-y border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="label mb-3">What physics changes</p>
            <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02]">Break the bridge. <em className="text-[var(--gold-2)]">The village notices.</em></h2>
            <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">A bullock cart shuttles between the banks along a route computed from a small connectivity graph. Destroy the bridge and its deck becomes real Rapier rigid bodies. Wooden planks float and drift downstream, stone blocks sink, and the cart stops at the bank. Rebuild in stone on the same banks and the route reopens.</p>
          </div>
          <ul className="grid content-start gap-3 text-sm">
            {[
              ['Rapier WASM, fixed 60 Hz step', 'Static terrain trimesh, cuboid colliders for buildings, convex-hull rocks you can push.'],
              ['Pre-segmented fracture', 'Bridge decks split into seeded, reproducible debris. Documented as a game-physics approximation, not structural engineering.'],
              ['Traversal graph', 'Banks and bridges form a graph. BFS decides whether a crossing exists, and the cart replans live.'],
              ['Undo restores everything', 'World snapshots bring back colliders, routes and debris state.'],
            ].map(([a, b]) => (
              <li key={a} className="rounded-xl border border-[var(--line)] p-4"><b className="font-medium">{a}</b><p className="mt-1 text-[var(--muted)]">{b}</p></li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- languages ---------- */}
      <section id="languages" className="mx-auto max-w-7xl px-4 py-24 sm:px-8">
        <p className="label mb-3">Voice languages</p>
        <h2 className="max-w-3xl font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02]">Bolo jaise bolte ho.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            ['Hindi', 'नदी के ऊपर लकड़ी का पुल बनाओ'],
            ['Marathi', 'नदीवर दगडी पूल बांधा आणि पाऊस पाडा'],
            ['Hinglish', 'Bridge thoda bada karo, aur sunset kar do'],
            ['English', 'Paint that bridge red, then undo'],
          ].map(([l, s]) => (
            <figure key={l} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5">
              <figcaption className="label">{l}</figcaption>
              <blockquote className="mt-4 font-display text-2xl leading-snug">“{s}”</blockquote>
            </figure>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-sm text-[var(--muted)]">Transcription: Gnani Prisma v3.0 with auto language detection and code-mix output. Spoken confirmations: Gnani Timbre (optional). Accuracy figures in our docs are from synthetic and recorded tests and are labelled as such.</p>
      </section>

      {/* ---------- film + demo ---------- */}
      <section id="film" className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-8 lg:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="label mb-3">Cinematic export</p>
            <h2 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02]">Say the shot. <em className="text-[var(--gold-2)]">Download the film.</em></h2>
            <p className="mt-5 text-[15px] leading-relaxed text-[var(--muted)]">“Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.” This plans a spline camera path from the live world and renders it frame by frame. It encodes MP4 (H.264) via WebCodecs and Mediabunny, with a clearly labelled WebM fallback. 16:9 or 9:16, 720p, silent.</p>
          </div>
          <div id="demo" className="overflow-hidden rounded-2xl border border-[var(--line)] bg-black">
            <video className="aspect-video w-full" controls preload="none" poster="/demo/poster.jpg" src="/demo/boliverse-demo.mp4">
              Your browser cannot play this video.
            </video>
          </div>
        </div>
      </section>

      {/* ---------- powered by ---------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-8">
        <div className="grid gap-6 rounded-2xl border border-[var(--line)] p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
          <div>
            <p className="label mb-2">Powered by</p>
            <p className="font-display text-4xl">Gnani Prisma <span className="text-[var(--muted)]">&amp;</span> Timbre</p>
            <p className="mt-3 text-sm text-[var(--muted)]">Built for the Gnani AI Great Indian AI Internship Challenge. Groq (openai/gpt-oss-20b) plans complex commands only. Three.js, React Three Fiber, Rapier, Zod, Zustand and Mediabunny. All open source.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end">
            <a href="#/studio" className="btn btn-gold h-11 px-6">Enter the Studio</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="btn h-11 px-6"><Icon name="github" />Source</a>
          </div>
        </div>
      </section>
      <footer className="border-t border-[var(--line)] px-4 py-8 text-center text-xs text-[var(--muted)]">© {year} BoliVerse · Built for #GreatIndianAIInternshipChallenge #GnaniAI · Procedural 3D, no third-party models</footer>
    </div>
  )
}
