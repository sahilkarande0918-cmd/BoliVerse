import { useEffect, useMemo, useRef, useState } from 'react'
import { WorldView } from '../engine/Scene3D'
import { computeRoute } from '../engine/traversal'
import { useStudio } from '../store'
import { getHealth } from '../voice/api'
import { toggleMic } from '../voice/controller'
import { Icon, Mark, Wordmark } from './Icon'
import { VoicePanel } from './VoicePanel'
import { Inspector } from './Inspector'
import { Timeline } from './FilmBar'

const isWide = () => typeof innerWidth !== 'undefined' && innerWidth >= 1024

export default function Studio() {
  const world = useStudio((s) => s.world)
  const quality = useStudio((s) => s.quality)
  const paused = useStudio((s) => s.paused)
  const mode = useStudio((s) => s.mode)
  const selectedId = useStudio((s) => s.selectedId)
  const phase = useStudio((s) => s.phase)
  const [left, setLeft] = useState(isWide())
  const [right, setRight] = useState(typeof innerWidth !== 'undefined' && innerWidth >= 1600)

  useEffect(() => {
    void getHealth().then((h) => useStudio.getState().set({ health: h }))
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? useStudio.getState().redo() : useStudio.getState().undo() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])
  // panels follow the viewport: dock on wide screens, become closed drawers on narrow ones
  useEffect(() => {
    const mq = matchMedia('(min-width: 1024px)')
    const sync = () => { setLeft(mq.matches); setRight(innerWidth >= 1600) }
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  useEffect(() => { if (selectedId && isWide()) setRight(true) }, [selectedId])

  return (
    <div className="grid h-[100dvh] grid-cols-[minmax(0,1fr)] grid-rows-[56px_1fr] overflow-hidden bg-[var(--bg)]">
      <Header left={left} right={right} onLeft={() => setLeft(!left)} onRight={() => setRight(!right)} />
      <div className="relative flex min-h-0">
        <aside aria-label="Voice Studio" className={`panel z-20 flex shrink-0 flex-col overflow-hidden border-r border-[var(--line)] max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-[min(360px,90vw)] max-lg:shadow-[0_30px_80px_-20px_rgba(46,42,39,0.35)] ${left ? 'lg:w-[340px]' : 'lg:w-0 lg:border-r-0 max-lg:-translate-x-full'}`}>
          <div className="flex min-h-0 w-[340px] flex-1 flex-col max-lg:w-full"><VoicePanel onClose={() => setLeft(false)} /></div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col px-3 pb-3 lg:px-4 lg:pb-4">
          {/* the viewport sits in a beige gallery frame, like a window onto the world */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-[10px] bg-[#cfc6bc] shadow-[0_1px_0_rgba(255,255,255,0.5),0_20px_40px_-28px_rgba(46,42,39,0.45)]">
            <WorldView world={world} quality={quality} paused={paused} />
            <ViewportOverlay />
            <button onClick={() => void toggleMic()} aria-label="Speak a command"
              className={`absolute bottom-5 left-1/2 z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full transition lg:hidden ${phase === 'listening' ? 'bg-[var(--ink)] text-[#f4efe9]' : 'bg-[var(--panel)] text-[var(--ink)] shadow-[0_10px_30px_-10px_rgba(46,42,39,0.5)]'}`}>
              <Icon name={phase === 'listening' ? 'stop' : 'mic'} size={20} />
            </button>
          </div>
          <BottomBar />
          <div className={`overflow-hidden rounded-[10px] bg-[var(--panel)] transition-[max-height,margin] duration-500 ${mode === 'film' ? 'max-h-[280px]' : 'max-h-0'}`}>
            <Timeline />
          </div>
        </main>

        <aside aria-label="Inspector" className={`panel z-20 flex shrink-0 flex-col overflow-hidden border-l border-[var(--line)] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:w-[min(340px,90vw)] max-lg:shadow-[0_30px_80px_-20px_rgba(46,42,39,0.35)] ${right ? 'lg:w-[300px]' : 'lg:w-0 lg:border-l-0 max-lg:translate-x-full'}`}>
          <div className="flex min-h-0 w-[300px] flex-1 flex-col max-lg:w-full"><Inspector onClose={() => setRight(false)} /></div>
        </aside>
      </div>
    </div>
  )
}

function Header({ left, right, onLeft, onRight }: { left: boolean; right: boolean; onLeft: () => void; onRight: () => void }) {
  const mode = useStudio((s) => s.mode)
  const set = useStudio((s) => s.set)
  const undo = useStudio((s) => s.undo)
  const redo = useStudio((s) => s.redo)
  const canUndo = useStudio((s) => s.past.length > 0)
  const canRedo = useStudio((s) => s.future.length > 0)
  const save = useStudio((s) => s.save)
  const template = useStudio((s) => s.world.template)
  const [menu, setMenu] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const exportJson = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(useStudio.getState().world, null, 1)], { type: 'application/json' }))
    a.download = 'boliverse-scene.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    setMenu(false)
  }
  return (
    <header className="relative z-30 flex min-w-0 items-center gap-1 px-2 sm:gap-2 sm:px-3 lg:px-5">
      <button className="tool" aria-pressed={left} onClick={onLeft} aria-label="Toggle Voice Studio" title="Voice Studio"><Icon name="mic" /></button>
      <a href="#/" className="ml-1 flex items-center gap-2.5" aria-label="BoliVerse home"><Mark size={20} /><Wordmark className="max-sm:hidden" /></a>
      <span className="mx-3 hidden h-4 w-px bg-[var(--line-2)] md:block" />
      <span className="hidden text-[13px] text-[var(--muted)] md:block">{template === 'village' ? 'River Village' : 'Untitled valley'}</span>

      <nav className="tabs absolute left-1/2 -translate-x-1/2 max-sm:static max-sm:mx-auto max-sm:translate-x-0 max-sm:gap-3.5" role="tablist" aria-label="Mode">
        {(['build', 'simulate', 'film'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} className="capitalize" onClick={() => set({ mode: m, ...(m === 'simulate' ? { paused: false } : {}) })}>{m}</button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-0.5">
        <button className="tool" onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl Z)" aria-label="Undo"><Icon name="undo" /></button>
        <button className="tool max-sm:hidden" onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl Shift Z)" aria-label="Redo"><Icon name="redo" /></button>
        <span className="mx-2 hidden h-4 w-px bg-[var(--line-2)] sm:block" />
        <button className="tool max-sm:hidden" onClick={() => void save()} title="Save to this browser">Save</button>
        <div className="relative">
          <button className="tool" onClick={() => setMenu(!menu)} aria-expanded={menu}>Export</button>
          {menu && (
            <div className="absolute right-0 top-10 w-56 rounded-[4px] bg-[var(--raised)] py-1.5 shadow-[0_20px_50px_-15px_rgba(46,42,39,0.35)] ring-1 ring-[var(--line)]" onMouseLeave={() => setMenu(false)}>
              <MenuItem onClick={exportJson}>Scene as JSON</MenuItem>
              <MenuItem onClick={() => { fileRef.current?.click(); setMenu(false) }}>Import scene…</MenuItem>
              <MenuItem onClick={() => { void useStudio.getState().load(); setMenu(false) }}>Open last save</MenuItem>
              <div className="my-1.5 h-px bg-[var(--line)]" />
              <MenuItem onClick={() => { set({ mode: 'film' }); setMenu(false) }}>Cinematic video…</MenuItem>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0]?.text().then((t) => useStudio.getState().importJson(t))} />
        </div>
        <span className="mx-2 hidden h-4 w-px bg-[var(--line-2)] sm:block" />
        <button className="tool" aria-pressed={right} onClick={onRight} aria-label="Toggle Inspector" title="Inspector"><Icon name="layers" /></button>
      </div>
    </header>
  )
}

const MenuItem = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="block w-full px-4 py-2 text-left text-[13px] text-[var(--text)] transition hover:bg-[rgba(58,52,48,0.05)]">{children}</button>
)

function ViewportOverlay() {
  const world = useStudio((s) => s.world)
  const fps = useStudio((s) => s.fps)
  const paused = useStudio((s) => s.paused)
  const rec = useStudio((s) => s.recording)
  const routeKey = world.entities.filter((e) => e.type === 'bridge' || e.type === 'river').map((e) => e.id + e.state).join()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const route = useMemo(() => computeRoute(world), [routeKey])
  const hasRiver = world.entities.some((e) => e.type === 'river')
  return (
    <>
      {!world.entities.length && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          <div className="fadein max-w-sm bg-[var(--panel)]/92 px-10 py-9 text-center shadow-[0_30px_60px_-30px_rgba(46,42,39,0.45)] backdrop-blur-sm">
            <p className="eyebrow">An empty valley</p>
            <p className="mt-4 text-[30px] font-light leading-[1.15] tracking-[-0.015em]">Say “Ek sundar<br />gaon banao”</p>
            <p className="mt-4 text-[13px] leading-relaxed text-[var(--muted)]">Press the microphone or <span className="kbd">Space</span>, or type a command in Voice Studio.</p>
          </div>
        </div>
      )}
      <div className="tnum pointer-events-none absolute bottom-4 left-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] tracking-[0.02em] text-[#f6f1ea]/90 [text-shadow:0_1px_3px_rgba(30,26,23,0.55)] max-lg:bottom-24">
        <span>{world.entities.length} objects</span>
        <span>{fps} fps</span>
        <span>Physics {paused ? 'paused' : 'live'}</span>
        {hasRiver && (
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${route.ok ? 'bg-[#cfe0cf]' : 'animate-pulse bg-[#f0a796]'}`} />
            {route.ok ? `Route open · ${route.via}` : 'Route blocked · no crossing'}
          </span>
        )}
      </div>
      {rec.state === 'recording' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[rgba(231,224,216,0.82)] backdrop-blur-[3px]">
          <div className="w-[min(340px,86%)] text-center">
            <p className="eyebrow mb-4">Rendering the live scene</p>
            <p className="tnum text-[56px] font-light leading-none">{Math.round(rec.progress * 100)}<span className="text-[var(--faint)]">%</span></p>
            <div className="mt-6 h-px overflow-hidden bg-[var(--line-2)]"><div className="h-full bg-[var(--ink)] transition-[width] duration-200" style={{ width: `${rec.progress * 100}%` }} /></div>
            <p className="mt-5 text-[12.5px] text-[var(--muted)]">Frame-exact capture of this 3D world. Nothing is pre-rendered.</p>
            <button className="btn-line mt-6" onClick={() => useStudio.getState().set({ recording: { ...rec, state: 'idle', message: 'Cancelled' } })}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}

function BottomBar() {
  const run = useStudio((s) => s.run)
  const paused = useStudio((s) => s.paused)
  const mode = useStudio((s) => s.mode)
  const set = useStudio((s) => s.set)
  const view = (v: 'overview' | 'top' | 'low' | 'focus') => void run(`camera ${v}`, 'text', {}, [{ action: 'SET_CAMERA', view: v, target: v === 'focus' ? { ref: 'selected' } : undefined }])
  const screenshot = () => {
    const c = document.querySelector('main canvas') as HTMLCanvasElement | null
    c?.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `boliverse-${Date.now()}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    })
  }
  const Sep = () => <span className="mx-3 h-4 w-px shrink-0 bg-[var(--line-2)]" />
  return (
    <div className="scroll-thin flex h-12 shrink-0 items-center overflow-x-auto px-1">
      <span className="eyebrow mr-2 max-md:hidden">Camera</span>
      {(['overview', 'top', 'low', 'focus'] as const).map((v) => <button key={v} className="tool shrink-0 capitalize" onClick={() => view(v)}>{v}</button>)}
      <Sep />
      <span className="eyebrow mr-2 max-md:hidden">Physics</span>
      <button className="tool shrink-0" onClick={() => set({ paused: !paused })}>{paused ? 'Resume' : 'Pause'}</button>
      <button className="tool shrink-0" onClick={() => void run('push the rocks', 'text', {}, [{ action: 'APPLY_FORCE', target: { type: 'rock', ref: 'all' }, strength: 6 }])}>Impulse</button>
      <Sep />
      <button className="tool shrink-0" aria-pressed={mode === 'film'} onClick={() => set({ mode: mode === 'film' ? 'build' : 'film' })}><Icon name="film" size={15} />Timeline</button>
      <button className="tool shrink-0" onClick={screenshot}>Screenshot</button>
      <span className="ml-auto pl-3" />
      <button className="btn-ink shrink-0 !h-8 !px-4" onClick={() => set({ mode: 'film' })}><span className="h-1.5 w-1.5 rounded-full bg-[#e07a63]" />Record</button>
    </div>
  )
}
