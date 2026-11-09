import { useEffect, useMemo, useRef, useState } from 'react'
import { WorldView } from '../engine/Scene3D'
import { computeRoute } from '../engine/traversal'
import { useStudio } from '../store'
import { getHealth } from '../voice/api'
import { toggleMic } from '../voice/controller'
import { Icon, Mark } from './Icon'
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
  // selecting something on a wide screen reveals the inspector
  useEffect(() => { if (selectedId && isWide()) setRight(true) }, [selectedId])

  return (
    <div className="grid h-[100dvh] grid-rows-[44px_1fr] overflow-hidden bg-[var(--bg)]">
      <Toolbar left={left} right={right} onLeft={() => setLeft(!left)} onRight={() => setRight(!right)} />
      <div className="relative flex min-h-0">
        <aside aria-label="Voice Studio" className={`panel z-20 flex shrink-0 flex-col overflow-hidden border-r border-[var(--line)] max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:w-[min(340px,88vw)] max-lg:shadow-2xl ${left ? 'lg:w-[312px]' : 'lg:w-0 lg:border-r-0 max-lg:-translate-x-full'}`}>
          <div className="flex min-h-0 w-[312px] flex-1 flex-col max-lg:w-full"><VoicePanel onClose={() => setLeft(false)} /></div>
        </aside>

        <main className="relative flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <WorldView world={world} quality={quality} paused={paused} />
            <ViewportOverlay />
            <button onClick={() => void toggleMic()} aria-label="Speak a command" className="absolute bottom-4 left-1/2 z-10 grid h-14 w-14 -translate-x-1/2 place-items-center rounded-full bg-[var(--accent)] text-[#18120a] shadow-[0_10px_30px_-8px_rgba(217,167,90,0.6)] lg:hidden">
              <Icon name="mic" size={22} />
            </button>
          </div>
          <BottomBar onTimeline={() => useStudio.getState().set({ mode: mode === 'film' ? 'build' : 'film' })} />
          <div className={`overflow-hidden border-t border-[var(--line)] bg-[var(--panel)] transition-[max-height] duration-300 ${mode === 'film' ? 'max-h-[260px]' : 'max-h-0 border-t-0'}`}>
            <Timeline />
          </div>
        </main>

        <aside aria-label="Inspector" className={`panel z-20 flex shrink-0 flex-col overflow-hidden border-l border-[var(--line)] max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:w-[min(320px,88vw)] max-lg:shadow-2xl ${right ? 'lg:w-[288px]' : 'lg:w-0 lg:border-l-0 max-lg:translate-x-full'}`}>
          <div className="flex min-h-0 w-[288px] flex-1 flex-col max-lg:w-full"><Inspector onClose={() => setRight(false)} /></div>
        </aside>
      </div>
    </div>
  )
}

function Toolbar({ left, right, onLeft, onRight }: { left: boolean; right: boolean; onLeft: () => void; onRight: () => void }) {
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
    <header className="relative z-30 flex items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)] px-2">
      <button className="tool" aria-pressed={left} onClick={onLeft} aria-label="Toggle Voice Studio" title="Voice Studio"><Icon name="mic" /></button>
      <a href="#/" className="ml-1 flex items-center gap-2 pr-3" aria-label="BoliVerse home"><Mark size={18} /><span className="text-[13px] font-semibold tracking-tight">BoliVerse</span></a>
      <span className="hidden h-4 w-px bg-[var(--line-2)] sm:block" />
      <span className="hidden px-3 text-[12px] text-[var(--muted)] sm:block">{template === 'village' ? 'River Village' : 'Untitled valley'}</span>

      <div className="absolute left-1/2 -translate-x-1/2 max-sm:static max-sm:mx-auto max-sm:translate-x-0">
        <div className="seg" role="tablist" aria-label="Mode">
          {(['build', 'simulate', 'film'] as const).map((m) => (
            <button key={m} role="tab" aria-selected={mode === m} className="capitalize" onClick={() => set({ mode: m, ...(m === 'simulate' ? { paused: false } : {}) })}>{m}</button>
          ))}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5">
        <button className="tool" onClick={() => undo()} disabled={!canUndo} title="Undo (Ctrl Z)" aria-label="Undo"><Icon name="undo" /></button>
        <button className="tool" onClick={() => redo()} disabled={!canRedo} title="Redo (Ctrl Shift Z)" aria-label="Redo"><Icon name="redo" /></button>
        <span className="mx-1 hidden h-4 w-px bg-[var(--line-2)] sm:block" />
        <button className="tool max-sm:hidden" onClick={() => void save()} title="Save to this browser (IndexedDB)">Save</button>
        <div className="relative">
          <button className="tool" onClick={() => setMenu(!menu)} aria-expanded={menu} title="Export">Export</button>
          {menu && (
            <div className="absolute right-0 top-9 w-52 rounded-lg bg-[var(--raised)] p-1 shadow-2xl ring-1 ring-[var(--line-2)]" onMouseLeave={() => setMenu(false)}>
              <MenuItem onClick={exportJson}>Scene as JSON</MenuItem>
              <MenuItem onClick={() => { fileRef.current?.click(); setMenu(false) }}>Import scene JSON…</MenuItem>
              <MenuItem onClick={() => { void useStudio.getState().load(); setMenu(false) }}>Open last save</MenuItem>
              <MenuItem onClick={() => { set({ mode: 'film' }); setMenu(false) }}>Cinematic video…</MenuItem>
            </div>
          )}
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0]?.text().then((t) => useStudio.getState().importJson(t))} />
        </div>
        <span className="mx-1 hidden h-4 w-px bg-[var(--line-2)] sm:block" />
        <button className="tool" aria-pressed={right} onClick={onRight} aria-label="Toggle Inspector" title="Inspector"><Icon name="layers" /></button>
      </div>
    </header>
  )
}

const MenuItem = ({ onClick, children }: { onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick} className="block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] text-[var(--text)] hover:bg-white/5">{children}</button>
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
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-[radial-gradient(closest-side,rgba(11,13,16,0.72),rgba(11,13,16,0))] p-6 text-center">
          <div className="fadein max-w-sm [text-shadow:0_1px_12px_rgba(0,0,0,0.6)]">
            <p className="eyebrow mb-3">Empty valley</p>
            <p className="font-display text-[34px] leading-[1.05] text-[var(--text)]">Say <em className="text-[var(--accent-2)]">“Ek sundar gaon banao”</em></p>
            <p className="mt-3 text-[12px] text-white/75">Press the mic or <span className="kbd">Space</span>. Prefer typing? Use the field in Voice Studio.</p>
          </div>
        </div>
      )}
      <div className="tnum pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/70 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] max-lg:bottom-20">
        <span>{world.entities.length} objects</span>
        <span>{fps} fps</span>
        <span>Physics {paused ? 'paused' : 'live'}</span>
        {hasRiver && (
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${route.ok ? 'bg-[var(--ok)]' : 'animate-pulse bg-[var(--bad)]'}`} />
            {route.ok ? `Route open · ${route.via}` : 'Route blocked · no crossing'}
          </span>
        )}
      </div>
      {rec.state === 'recording' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-[#0b0d10]/70 backdrop-blur-[2px]">
          <div className="w-[min(320px,86%)] text-center">
            <p className="eyebrow mb-3 !text-[var(--accent)]">Rendering live scene</p>
            <p className="tnum text-[44px] font-light leading-none">{Math.round(rec.progress * 100)}<span className="text-[var(--muted)]">%</span></p>
            <div className="mt-5 h-px overflow-hidden bg-white/10"><div className="h-full bg-[var(--accent)] transition-[width] duration-200" style={{ width: `${rec.progress * 100}%` }} /></div>
            <p className="mt-4 text-[11px] text-[var(--muted)]">Frame-exact capture of this 3D world. Nothing is pre-rendered.</p>
            <button className="btn-line mt-5" onClick={() => useStudio.getState().set({ recording: { ...rec, state: 'idle', message: 'Cancelled' } })}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}

function BottomBar({ onTimeline }: { onTimeline: () => void }) {
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
  const Sep = () => <span className="mx-1.5 h-4 w-px shrink-0 bg-[var(--line-2)]" />
  return (
    <div className="scroll-thin flex h-10 shrink-0 items-center overflow-x-auto border-t border-[var(--line)] bg-[var(--bg)] px-2">
      <span className="eyebrow mr-1 pl-1 max-sm:hidden">Camera</span>
      {(['overview', 'top', 'low', 'focus'] as const).map((v) => <button key={v} className="tool capitalize" onClick={() => view(v)}>{v}</button>)}
      <Sep />
      <span className="eyebrow mr-1 max-sm:hidden">Physics</span>
      <button className="tool" onClick={() => set({ paused: !paused })} aria-pressed={!paused}>{paused ? <><Icon name="play" size={12} />Resume</> : <><Icon name="stop" size={12} />Pause</>}</button>
      <button className="tool" onClick={() => void run('push the rocks', 'text', {}, [{ action: 'APPLY_FORCE', target: { type: 'rock', ref: 'all' }, strength: 6 }])}>Impulse</button>
      <Sep />
      <button className="tool" aria-pressed={mode === 'film'} onClick={onTimeline}><Icon name="film" size={14} />Timeline</button>
      <button className="tool" onClick={screenshot}>Screenshot</button>
      <button className="tool !text-[var(--accent)]" onClick={() => set({ mode: 'film' })}><Icon name="rec" size={12} />Record</button>
    </div>
  )
}
