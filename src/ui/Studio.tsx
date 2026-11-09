import { useEffect, useMemo, useRef, useState } from 'react'
import { WorldView } from '../engine/Scene3D'
import { computeRoute } from '../engine/traversal'
import { type LogEntry, useStudio } from '../store'
import { getHealth } from '../voice/api'
import { Icon, Mark } from './Icon'
import { VoicePanel } from './VoicePanel'
import { Inspector } from './Inspector'
import { FilmBar } from './FilmBar'

export default function Studio() {
  const world = useStudio((s) => s.world)
  const quality = useStudio((s) => s.quality)
  const paused = useStudio((s) => s.paused)
  const mode = useStudio((s) => s.mode)
  const [sheet, setSheet] = useState<'voice' | 'scene' | 'film' | null>(null)

  useEffect(() => {
    void getHealth().then((h) => useStudio.getState().set({ health: h }))
    const s = useStudio.getState()
    if (!s.world.entities.length && !s.log.length) s.set({ message: 'Empty valley. Say “Ek sundar gaon banao” or press a demo step.' })
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? useStudio.getState().redo() : useStudio.getState().undo() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--bg)]">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        <aside className="hidden w-[340px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--panel)] lg:flex" aria-label="Voice and history">
          <VoicePanel />
        </aside>
        <main className="relative min-w-0 flex-1" aria-label="3D viewport">
          <WorldView world={world} quality={quality} paused={paused} />
          <ViewportHud />
          <Evidence />
        </main>
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-[var(--line)] bg-[var(--panel)] xl:flex" aria-label="Scene graph and inspector">
          <Inspector />
        </aside>
        {/* mobile bottom sheet */}
        {sheet && (
          <div className="glass absolute inset-x-2 bottom-20 top-2 z-30 flex flex-col overflow-hidden rounded-2xl lg:hidden">
            <div className="flex items-center justify-between border-b border-[var(--line)] px-3 py-2">
              <span className="label">{sheet}</span>
              <button className="btn btn-ghost h-8 px-2" onClick={() => setSheet(null)} aria-label="Close panel"><Icon name="x" /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{sheet === 'voice' ? <VoicePanel /> : sheet === 'scene' ? <Inspector /> : <FilmBar />}</div>
          </div>
        )}
        <nav className="glass absolute inset-x-3 bottom-3 z-30 flex items-center justify-around rounded-2xl p-1.5 lg:hidden">
          {(['voice', 'scene', 'film'] as const).map((k) => (
            <button key={k} className={`btn btn-ghost flex-1 capitalize ${sheet === k ? 'text-[var(--gold)]' : ''}`} onClick={() => setSheet(sheet === k ? null : k)}>{k}</button>
          ))}
          <MobileMic />
        </nav>
      </div>
      {(mode === 'film' || useStudio.getState().shot) && <div className="hidden border-t border-[var(--line)] bg-[var(--panel)] lg:block"><FilmBar /></div>}
    </div>
  )
}

function MobileMic() {
  const phase = useStudio((s) => s.phase)
  return (
    <button className="btn btn-gold h-11 w-11 rounded-full p-0" aria-label="Open voice panel" onClick={() => document.dispatchEvent(new CustomEvent('boliverse:mic'))}>
      <Icon name={phase === 'listening' ? 'stop' : 'mic'} size={18} />
    </button>
  )
}

function TopBar() {
  const { mode, set, undo, redo, past, future, save, load, health, quality, paused, world } = useStudio()
  const fileRef = useRef<HTMLInputElement>(null)
  const exportJson = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(world, null, 1)], { type: 'application/json' }))
    a.download = 'boliverse-scene.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--line)] bg-[var(--panel)] px-3">
      <a href="#/" className="flex items-center gap-2 pr-2" aria-label="BoliVerse home"><Mark /><span className="font-display text-xl tracking-tight">BoliVerse</span></a>
      <span className="hidden text-xs text-[var(--muted)] md:inline">/ {world.template === 'village' ? 'River Village' : 'Untitled valley'}</span>
      <div className="mx-auto flex rounded-full border border-[var(--line-2)] p-0.5" role="tablist" aria-label="Mode">
        {(['build', 'simulate', 'film'] as const).map((m) => (
          <button key={m} role="tab" aria-selected={mode === m} onClick={() => set({ mode: m, paused: m === 'simulate' ? false : paused })}
            className={`h-7 rounded-full px-3 text-xs font-medium capitalize transition ${mode === m ? 'bg-[var(--gold)] text-[#17120a]' : 'text-[var(--muted)] hover:text-[var(--text)]'}`}>{m}</button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <button className="btn btn-ghost h-8 px-2" onClick={() => undo()} disabled={!past.length} title="Undo (Ctrl+Z)" aria-label="Undo"><Icon name="undo" /></button>
        <button className="btn btn-ghost h-8 px-2" onClick={() => redo()} disabled={!future.length} title="Redo (Ctrl+Shift+Z)" aria-label="Redo"><Icon name="redo" /></button>
        <button className="btn btn-ghost hidden h-8 px-2 sm:inline-flex" onClick={() => void save()} title="Save to this browser (IndexedDB)" aria-label="Save"><Icon name="save" /></button>
        <button className="btn btn-ghost hidden h-8 px-2 sm:inline-flex" onClick={() => void load()} title="Load last save" aria-label="Load"><Icon name="open" /></button>
        <button className="btn btn-ghost hidden h-8 px-2 md:inline-flex" onClick={exportJson} title="Export scene JSON" aria-label="Export scene JSON"><Icon name="down" /></button>
        <button className="btn btn-ghost hidden h-8 px-2 md:inline-flex text-xs" onClick={() => fileRef.current?.click()} title="Import scene JSON">Import</button>
        <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0]?.text().then((t) => useStudio.getState().importJson(t))} />
        <select value={quality} onChange={(e) => set({ quality: e.target.value as never })} className="hidden h-8 rounded-full border border-[var(--line-2)] bg-transparent px-2 text-xs text-[var(--muted)] md:block" aria-label="Graphics quality">
          <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
        </select>
        <div className="ml-1 hidden items-center gap-2 rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] text-[var(--muted)] sm:flex" title="Server integrations (availability only — keys never leave the server)">
          <Dot on={!!health?.gnani} />Gnani<Dot on={!!health?.groq} />Groq
        </div>
      </div>
    </header>
  )
}

const Dot = ({ on }: { on: boolean }) => <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-[var(--ok)]' : 'bg-[var(--bad)]'}`} />

function ViewportHud() {
  const world = useStudio((s) => s.world)
  const fps = useStudio((s) => s.fps)
  const paused = useStudio((s) => s.paused)
  const set = useStudio((s) => s.set)
  const rec = useStudio((s) => s.recording)
  const routeKey = world.entities.filter((e) => e.type === 'bridge' || e.type === 'river').map((e) => e.id + e.state).join()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const route = useMemo(() => computeRoute(world), [routeKey])
  const hasRiver = world.entities.some((e) => e.type === 'river')
  return (
    <>
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2 text-[11px]">
        <span className="glass tnum rounded-full px-2.5 py-1 text-[var(--muted)]">{world.entities.length} entities</span>
        <span className="glass tnum rounded-full px-2.5 py-1 text-[var(--muted)]">{fps} fps</span>
        <span className="glass rounded-full px-2.5 py-1 text-[var(--muted)]">Rapier {paused ? 'paused' : 'live'} · 60 Hz</span>
      </div>
      <div className="absolute right-3 top-3 flex gap-2">
        <button className="glass btn h-8 rounded-full text-xs" onClick={() => set({ paused: !paused })}>{paused ? 'Resume physics' : 'Pause physics'}</button>
      </div>
      {hasRiver && (
        <div className={`glass absolute bottom-20 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full px-3 py-1.5 text-xs lg:bottom-3 ${route.ok ? '' : 'ring-1 ring-[var(--bad)]/60'}`} role="status">
          <span className={`h-2 w-2 shrink-0 rounded-full ${route.ok ? 'bg-[var(--ok)]' : 'bg-[var(--bad)] animate-pulse'}`} />
          <span className="label !text-[10px]">Traversal</span>
          <span className="truncate">{route.reason}</span>
        </div>
      )}
      {rec.state === 'recording' && (
        <div className="absolute inset-0 z-20 grid place-items-center bg-black/55 backdrop-blur-sm">
          <div className="glass w-[min(360px,90%)] rounded-2xl p-5 text-center">
            <p className="label mb-2 text-[var(--gold)]">Rendering the live scene</p>
            <p className="tnum mb-3 font-display text-4xl">{Math.round(rec.progress * 100)}%</p>
            <div className="h-1 overflow-hidden rounded bg-white/10"><div className="h-full bg-[var(--gold)] transition-[width]" style={{ width: `${rec.progress * 100}%` }} /></div>
            <p className="mt-3 text-xs text-[var(--muted)]">Frame-exact capture of the same 3D world (no pre-rendered footage).</p>
            <button className="btn mt-4" onClick={() => useStudio.getState().set({ recording: { ...rec, state: 'idle', message: 'Cancelled' } })}>Cancel</button>
          </div>
        </div>
      )}
    </>
  )
}

const ms = (v?: number) => (v === undefined ? '—' : `${Math.round(v)} ms`)

function Evidence() {
  const log = useStudio((s) => s.log)
  const [open, setOpen] = useState(true)
  const last: LogEntry | undefined = log.at(-1)
  if (!last) return null
  return (
    <section className="glass absolute bottom-20 right-3 z-10 w-[min(380px,calc(100%-1.5rem))] rounded-2xl text-xs lg:bottom-3" aria-label="Pipeline evidence">
      <button className="flex w-full items-center justify-between px-3.5 py-2.5" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="label">Pipeline evidence</span>
        <span className="tnum text-[var(--gold)]">{last.t.total ? `${Math.round(last.t.total)} ms end-to-end` : last.status === 'pending' ? 'working…' : ''}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--line)] px-3.5 py-3">
          <Row k="Heard">
            <span className="text-[var(--text)]">“{last.transcript}”</span>
            <span className="mt-0.5 block text-[10px] text-[var(--muted)]">{last.source === 'voice' ? `${last.provider ?? 'Gnani Prisma'} · ${last.language ?? 'auto'}` : last.source === 'chip' ? 'demo step (typed text)' : 'typed text'}</span>
          </Row>
          <Row k="Planner"><span>{last.planner === 'groq' ? 'Groq · structured JSON plan (Zod-validated)' : last.planner === 'local' ? 'Local multilingual parser (no network)' : 'Not understood'}</span></Row>
          <Row k="Ops">
            <div className="flex flex-wrap gap-1">
              {last.ops.map((o, i) => <code key={i} className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-[var(--gold-2)]" title={JSON.stringify(o)}>{o.action}</code>)}
              {!last.ops.length && <span className="text-[var(--muted)]">none</span>}
            </div>
          </Row>
          <Row k="World">
            <span className={last.status === 'error' ? 'text-[var(--bad)]' : ''}>{last.errors[0] ?? last.notes[0] ?? (last.affected.length ? `${last.affected.length} entities changed` : 'Done')}</span>
          </Row>
          <div className="tnum grid grid-cols-4 gap-1 pt-1 text-center text-[10px] text-[var(--muted)]">
            {([['STT', last.t.stt], ['Parse', last.t.parse], ['Apply', last.t.apply], ['Frame', last.t.frame]] as const).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-white/[0.03] py-1.5"><div className="text-[var(--text)]">{ms(v)}</div>{k}</div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return <div className="grid grid-cols-[64px_1fr] gap-2"><span className="label !text-[10px] pt-0.5">{k}</span><div>{children}</div></div>
}
