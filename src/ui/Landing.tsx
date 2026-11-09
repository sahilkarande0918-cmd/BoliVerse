import { Suspense, lazy, useEffect, useState } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { Icon, Mark, Wordmark } from './Icon'

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
  ['Compile', 'A multilingual grammar turns everyday speech into typed operations. Groq handles the rest within the same strict schema.'],
  ['Resolve', '“it”, “that bridge”, “same jagah” and “mansion ke andar” bind to real objects through spatial solvers.'],
  ['Simulate', 'Edits land as undoable transactions. Rapier physics and a traversal graph play out the consequences.'],
]

/** Inertial smooth scrolling for the landing page only (the studio keeps native panel scrolling). */
function useSmoothScroll() {
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const lenis = new Lenis({ autoRaf: true, lerp: 0.085, wheelMultiplier: 0.9 })
    // smooth in-page anchors (#how, #film…); hash routes like #/studio navigate normally
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null
      const id = a?.getAttribute('href')?.slice(1)
      if (!id || id.startsWith('/')) return
      const el = document.getElementById(id)
      if (!el) return
      e.preventDefault()
      lenis.scrollTo(el, { offset: -16, duration: 1.2 })
    }
    document.addEventListener('click', onClick)
    return () => { document.removeEventListener('click', onClick); lenis.destroy() }
  }, [])
}

export function Landing() {
  const live = useLiveHero()
  useSmoothScroll()
  return (
    <div className="min-h-full bg-[var(--bg)] text-[var(--text)]">
      {/* ---------- hero: editorial column + architectural arch onto the live world ---------- */}
      <section className="relative min-h-[100svh] overflow-hidden bg-[linear-gradient(180deg,#d6c9c1_0%,#e2d8d0_55%,#e7e0d8_100%)]">
        <header className="relative z-10 mx-auto flex max-w-[1440px] items-center px-6 py-7 sm:px-12">
          <a href="#/" className="flex items-center gap-2.5"><Mark size={20} /><Wordmark /></a>
          <nav className="ml-auto hidden items-center gap-9 text-[13px] text-[var(--muted)] md:flex">
            <a href="#how" className="link-quiet !text-[var(--muted)] hover:!text-[var(--text)]">How it works</a>
            <a href="#physics" className="link-quiet !text-[var(--muted)] hover:!text-[var(--text)]">Physics</a>
            <a href="#languages" className="link-quiet !text-[var(--muted)] hover:!text-[var(--text)]">Languages</a>
            <a href="#film" className="link-quiet !text-[var(--muted)] hover:!text-[var(--text)]">Film</a>
          </nav>
          <a href="#/studio" className="btn-ink ml-auto md:ml-10">Open studio</a>
        </header>

        <div className="relative mx-auto grid max-w-[1440px] items-center gap-12 px-6 pb-14 sm:px-12 lg:min-h-[calc(100svh-96px)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:pb-12">
          <div className="rise order-2 lg:order-1">
            <p className="eyebrow">Voice to 3D studio</p>
            <h1 className="mt-6 text-[clamp(2.9rem,6.2vw,5.6rem)] font-light leading-[1.02] tracking-[-0.025em]">Your words.<br />Your world.</h1>
            <p className="mt-7 max-w-[26ch] text-[clamp(1.15rem,1.6vw,1.45rem)] leading-snug text-[var(--text)]/85">Build living <span className="font-medium">3D worlds</span>. Just by <span className="font-medium">speaking</span>.</p>
            <p className="mt-4 max-w-[40ch] text-[14px] leading-relaxed text-[var(--muted)]">Speak in Hindi, Marathi, Hinglish or English. Gnani Prisma listens, and the world rebuilds itself with real physics.</p>
            <div className="mt-10 flex flex-wrap items-center gap-7">
              <a href="#/studio" className="btn-ink !h-11 !px-6">Enter the studio <Icon name="arrow" size={14} /></a>
              <a href="#film" className="link-quiet">Watch the film</a>
            </div>
            <div className="mt-14 hidden max-w-[360px] items-stretch lg:flex">
              <span className="flex-1 border border-r-0 border-[var(--line-2)] bg-[#f4efe9]/70 px-4 py-2.5 text-[12.5px] text-[var(--muted)]">“Ab bridge tod do”</span>
              <a href="#/studio" className="btn-ink !h-auto !px-4 !text-[10.5px]">Try it</a>
            </div>
          </div>

          <div className="rise relative order-1 mx-auto w-full max-w-[640px] [animation-delay:120ms] lg:order-2 lg:mr-0 lg:w-auto">
            {/* the arch */}
            <div className="relative mx-auto aspect-[4/5] w-full overflow-hidden rounded-t-[999px] bg-[#cbbdb4] ring-[10px] ring-[#efe8e1] max-lg:aspect-square lg:h-[min(74svh,760px)] lg:w-auto">
              <div className="absolute inset-0 bg-[linear-gradient(180deg,#bfb0a6,#d9cdc4)]" />
              {live && <Suspense fallback={null}><div className="fadein absolute inset-0 [&_.cart-tag]:hidden"><HeroWorld /></div></Suspense>}
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(0deg,rgba(46,42,39,0.35),transparent)]" />
              <div className="absolute bottom-6 left-7 text-[#f6f1ea]">
                <p className="text-[10.5px] uppercase tracking-[0.18em] opacity-80">Live render</p>
                <p className="mt-1 text-[14px]">River village, golden hour</p>
              </div>
            </div>
            <div className="pointer-events-none absolute -left-10 top-[18%] hidden h-28 w-28 rounded-full border border-[var(--line-2)] lg:block" />
          </div>
        </div>
        <p className="mx-auto max-w-[1440px] px-6 pb-8 text-[11.5px] text-[var(--muted)] sm:px-12">© {new Date().getFullYear()} BoliVerse. The arch shows the engine rendering live in your browser, not a video.</p>
      </section>

      {/* ---------- how it works ---------- */}
      <section id="how" className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-6 py-28 sm:px-12 lg:grid-cols-[5fr_7fr]">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="mt-6 text-[clamp(2rem,3.8vw,3.3rem)] font-light leading-[1.08] tracking-[-0.02em]">A spoken language for living worlds.</h2>
          </div>
          <ol className="border-t border-[var(--line-2)]">
            {STEPS.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[56px_150px_1fr] gap-4 border-b border-[var(--line-2)] py-7 max-sm:grid-cols-[44px_1fr]">
                <span className="tnum text-[13px] text-[var(--faint)]">0{i + 1}</span>
                <span className="text-[19px] font-light">{t}</span>
                <span className="text-[14px] leading-relaxed text-[var(--muted)] max-sm:col-span-2">{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- physics ---------- */}
      <section id="physics">
        <div className="mx-auto grid max-w-[1440px] gap-16 px-6 py-28 sm:px-12 lg:grid-cols-2">
          <h2 className="text-[clamp(2rem,3.8vw,3.3rem)] font-light leading-[1.08] tracking-[-0.02em]">Break the bridge.<br /><span className="text-[var(--muted)]">The village notices.</span></h2>
          <div className="space-y-6 text-[15px] leading-relaxed text-[var(--text)]/80">
            <p>A bullock cart travels between the banks on a route computed from a small connectivity graph. Say <em>“ab bridge tod do”</em> and the deck breaks into Rapier rigid bodies. Wooden planks float downstream, stone sinks, and the cart stops at the water’s edge.</p>
            <p>Say <em>“त्याच जागी दगडी पूल बांधा”</em> and a stone crossing spans the same two banks again. The route reopens, and undo restores every collider and route.</p>
            <p className="text-[12.5px] text-[var(--muted)]">Fracture uses pre-segmented, seeded debris. It is game physics, not structural engineering.</p>
          </div>
        </div>
      </section>

      {/* ---------- languages ---------- */}
      <section id="languages" className="border-y border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto max-w-[1440px] px-6 py-28 sm:px-12">
          <p className="eyebrow">Languages</p>
          <h2 className="mt-6 max-w-3xl text-[clamp(2rem,3.8vw,3.3rem)] font-light leading-[1.08] tracking-[-0.02em]">Bolo jaise bolte ho.</h2>
          <div className="mt-14 grid border-t border-[var(--line-2)] sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Hindi', 'नदी के ऊपर लकड़ी का पुल बनाओ'],
              ['Marathi', 'नदीवर दगडी पूल बांधा आणि पाऊस पाडा'],
              ['Hinglish', 'Mansion ke andar sofa aur jhoomar lagao'],
              ['English', 'Build a luxury mansion with a pool'],
            ].map(([l, s], i) => (
              <figure key={l} className={`border-b border-[var(--line-2)] py-9 sm:px-7 ${i % 4 ? 'lg:border-l' : 'sm:pl-0'} ${i % 2 ? 'sm:border-l lg:border-l' : ''}`}>
                <figcaption className="eyebrow">{l}</figcaption>
                <blockquote className="mt-6 text-[22px] font-light leading-[1.35]">“{s}”</blockquote>
              </figure>
            ))}
          </div>
          <p className="mt-8 max-w-2xl text-[13.5px] leading-relaxed text-[var(--muted)]">Gnani Prisma v3.0 handles transcription, with automatic language detection, code-mixed output and command keyterm biasing. Gnani Timbre can speak confirmations back.</p>
        </div>
      </section>

      {/* ---------- film ---------- */}
      <section id="film">
        <div className="mx-auto grid max-w-[1440px] items-center gap-14 px-6 py-28 sm:px-12 lg:grid-cols-[5fr_7fr]">
          <div>
            <p className="eyebrow">Cinematic export</p>
            <h2 className="mt-6 text-[clamp(2rem,3.8vw,3.3rem)] font-light leading-[1.08] tracking-[-0.02em]">Say the shot.<br />Download the film.</h2>
            <p className="mt-6 text-[15px] leading-relaxed text-[var(--text)]/80">“Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.” BoliVerse plans a spline camera move through the live world, then renders it frame by frame to MP4.</p>
          </div>
          <div id="demo" className="overflow-hidden rounded-[6px] bg-[#cbbdb4] shadow-[0_40px_80px_-40px_rgba(46,42,39,0.5)]">
            <video className="aspect-video w-full" controls preload="none" poster="/demo/poster.jpg" src="/demo/boliverse-demo.mp4">Your browser cannot play this video.</video>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--line)] bg-[var(--panel)]">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-5 px-6 py-10 text-[12.5px] text-[var(--muted)] sm:px-12">
          <Mark size={16} /><span>BoliVerse, built for the Gnani AI Great Indian AI Internship Challenge.</span>
          <span className="ml-auto flex gap-7"><a href={REPO} className="link-quiet !text-[var(--muted)]">GitHub</a><a href="#/studio" className="link-quiet !text-[var(--muted)]">Studio</a></span>
        </div>
      </footer>
    </div>
  )
}
