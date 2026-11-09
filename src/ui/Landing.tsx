import { Suspense, lazy, useEffect, useState } from 'react'
import { Icon, Mark } from './Icon'

const HeroWorld = lazy(() => import('./HeroWorld'))
const REPO = 'https://github.com/sahilkarande0918-cmd/BoliVerse'

function useLiveHero() {
  const [ok, setOk] = useState(false)
  useEffect(() => {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData
    if (reduced || saveData) return
    const id = setTimeout(() => setOk(true), 150)
    return () => clearTimeout(id)
  }, [])
  return ok
}

const STEPS = [
  ['Speak', 'Hindi, Marathi, Hinglish or English. Gnani Prisma transcribes it on our server, and your key never reaches the page.'],
  ['Compile', 'A deterministic multilingual grammar turns everyday speech into typed operations. Groq handles the rest within the same strict schema.'],
  ['Resolve', '“it”, “that bridge”, “same jagah” and “school ke paas” bind to real objects through spatial solvers.'],
  ['Simulate', 'Edits land as undoable transactions. Rapier physics and a traversal graph play out the consequences.'],
]

export function Landing() {
  const live = useLiveHero()
  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--text)]">
      <section className="relative h-[100svh] min-h-[640px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_70%_30%,#2b3542_0%,#12161b_55%,#0b0d10_100%)]" />
        {live && <Suspense fallback={null}><div className="fadein absolute inset-0 [&_.cart-tag]:hidden"><HeroWorld /></div></Suspense>}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(11,13,16,0.85)_0%,rgba(11,13,16,0.35)_45%,rgba(11,13,16,0)_70%),linear-gradient(0deg,#0b0d10_0%,rgba(11,13,16,0)_38%),linear-gradient(180deg,rgba(11,13,16,0.6)_0%,rgba(11,13,16,0)_18%)]" />

        <header className="relative z-10 mx-auto flex max-w-[1400px] items-center px-5 py-5 sm:px-10">
          <a href="#/" className="flex items-center gap-2.5"><Mark size={20} /><span className="text-[15px] font-semibold tracking-tight">BoliVerse</span></a>
          <nav className="ml-12 hidden items-center gap-8 text-[13px] text-[var(--muted)] md:flex">
            <a href="#how" className="transition hover:text-[var(--text)]">How it works</a>
            <a href="#physics" className="transition hover:text-[var(--text)]">Physics</a>
            <a href="#languages" className="transition hover:text-[var(--text)]">Languages</a>
            <a href="#film" className="transition hover:text-[var(--text)]">Film</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={REPO} target="_blank" rel="noreferrer" className="tool max-sm:hidden" aria-label="Source on GitHub"><Icon name="github" /></a>
            <a href="#/studio" className="btn-primary">Open Studio</a>
          </div>
        </header>

        <div className="relative z-10 mx-auto flex h-[calc(100%-76px)] max-w-[1400px] flex-col justify-end px-5 pb-12 sm:px-10 sm:pb-16">
          <p className="rise eyebrow mb-6 !text-[var(--accent-2)]">Voice → living 3D world · Powered by Gnani Prisma</p>
          <h1 className="rise max-w-[11ch] text-[clamp(3.4rem,10.5vw,9.5rem)] font-semibold uppercase leading-[0.86] tracking-[-0.045em] [animation-delay:80ms]">
            Your words.<br /><span className="text-[var(--accent-2)]">Your world.</span>
          </h1>
          <div className="rise mt-8 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between [animation-delay:160ms]">
            <p className="max-w-[30ch] text-[clamp(1.05rem,1.6vw,1.35rem)] font-light leading-snug text-[#d8d4cc]">Build living 3D worlds. Just by speaking.</p>
            <div className="flex flex-wrap items-center gap-5">
              <a href="#/studio" className="btn-primary !h-11 !px-6 !text-[13px]">Enter the Studio <Icon name="arrow" size={14} /></a>
              <a href="#film" className="flex items-center gap-2 text-[13px] text-[var(--text)]/85 transition hover:text-[var(--text)]"><span className="grid h-9 w-9 place-items-center rounded-full ring-1 ring-white/25"><Icon name="play" size={12} /></span>Watch the film</a>
            </div>
          </div>
          <p className="mt-10 text-[11px] text-white/45">Background: the BoliVerse engine rendering live in your browser. Not a pre-recorded video.</p>
        </div>
      </section>

      <section id="how" className="mx-auto max-w-[1400px] px-5 py-28 sm:px-10">
        <div className="grid gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="eyebrow mb-5">How it works</p>
            <h2 className="text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.035em]">A spoken programming language for living worlds.</h2>
          </div>
          <ol className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[48px_140px_1fr] gap-4 py-6 max-sm:grid-cols-[36px_1fr]">
                <span className="tnum font-mono text-[12px] text-[var(--accent)]">0{i + 1}</span>
                <span className="text-[18px] font-medium">{t}</span>
                <span className="text-[14px] leading-relaxed text-[var(--muted)] max-sm:col-span-2">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="physics" className="border-y border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-[1400px] gap-16 px-5 py-28 sm:px-10 lg:grid-cols-2">
          <h2 className="text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.035em]">Break the bridge.<br /><span className="text-[var(--muted)]">The village notices.</span></h2>
          <div className="space-y-6 text-[15px] leading-relaxed text-[var(--muted)]">
            <p>A bullock cart shuttles between the banks on a route computed from a small connectivity graph. Say <em className="text-[var(--text)] not-italic">“ab bridge tod do”</em>. The deck breaks into Rapier rigid bodies: wooden planks float downstream, stone sinks, and the cart halts at the water’s edge.</p>
            <p>Say <em className="text-[var(--text)] not-italic">“stone bridge banao, same jagah”</em> and a new crossing spans the same two banks. The route reopens. Undo restores every collider and route state.</p>
            <p className="text-[12px] text-[var(--faint)]">Fracture uses pre-segmented, seeded debris. It is game physics, not structural engineering.</p>
          </div>
        </div>
      </section>

      <section id="languages" className="mx-auto max-w-[1400px] px-5 py-28 sm:px-10">
        <p className="eyebrow mb-5">Languages</p>
        <h2 className="max-w-3xl text-[clamp(2.2rem,4.6vw,4rem)] font-semibold leading-[0.98] tracking-[-0.035em]">Bolo jaise bolte ho.</h2>
        <div className="mt-14 grid gap-px overflow-hidden border-y border-[var(--line)] bg-[var(--line)] sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Hindi', 'नदी के ऊपर लकड़ी का पुल बनाओ'],
            ['Marathi', 'नदीवर दगडी पूल बांधा आणि पाऊस पाडा'],
            ['Hinglish', 'Bridge thoda bada karo, aur sunset kar do'],
            ['English', 'Paint that bridge red, then undo'],
          ].map(([l, s]) => (
            <figure key={l} className="bg-[var(--bg)] py-8 pr-6 sm:px-6">
              <figcaption className="eyebrow">{l}</figcaption>
              <blockquote className="mt-5 font-display text-[28px] leading-[1.15]">“{s}”</blockquote>
            </figure>
          ))}
        </div>
        <p className="mt-6 max-w-2xl text-[13px] text-[var(--muted)]">Gnani Prisma v3.0 handles transcription, with auto language detection, code-mix output and command keyterm biasing. Gnani Timbre can speak confirmations back.</p>
      </section>

      <section id="film" className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-[1400px] items-center gap-14 px-5 py-28 sm:px-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="eyebrow mb-5">Cinematic export</p>
            <h2 className="text-[clamp(2.2rem,4.6vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.035em]">Say the shot. Download the film.</h2>
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--muted)]">“Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.” BoliVerse plans a spline camera move through the live world, then renders it frame by frame to MP4 (H.264, via WebCodecs and Mediabunny).</p>
          </div>
          <div id="demo" className="overflow-hidden rounded-lg bg-black ring-1 ring-[var(--line)]">
            <video className="aspect-video w-full" controls preload="none" poster="/demo/poster.jpg" src="/demo/boliverse-demo.mp4">Your browser cannot play this video.</video>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-4 px-5 py-10 text-[12px] text-[var(--muted)] sm:px-10">
        <Mark size={16} /><span>BoliVerse, built for the Gnani AI Great Indian AI Internship Challenge.</span>
        <span className="ml-auto flex gap-5"><a href={REPO} className="hover:text-[var(--text)]">GitHub</a><a href="#/studio" className="hover:text-[var(--text)]">Studio</a></span>
      </footer>
    </div>
  )
}
