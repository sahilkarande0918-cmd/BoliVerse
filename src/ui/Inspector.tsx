import { useEffect, useState } from 'react'
import { COLORS, MATERIALS, type Operation } from '../compiler/schema'
import { COLOR_HEX } from '../engine/Entities'
import { riverX } from '../engine/world'
import { useStudio } from '../store'
import { Icon } from './Icon'

const STRUCT = ['bridge', 'house', 'temple', 'school', 'well', 'mansion']

function Num({ label, value, onCommit, step = 0.5, suffix }: { label: string; value: number; onCommit: (v: number) => void; step?: number; suffix?: string }) {
  const [v, setV] = useState(value.toFixed(1))
  useEffect(() => setV(value.toFixed(1)), [value])
  const commit = () => { const n = parseFloat(v); if (Number.isFinite(n) && Math.abs(n - value) > 1e-3) onCommit(n); else setV(value.toFixed(1)) }
  return (
    <label className="relative flex items-center">
      <span className="pointer-events-none absolute left-2 text-[10px] font-medium text-[var(--faint)]">{label}</span>
      <input inputMode="decimal" step={step} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} className="field tnum !pl-5 text-right" aria-label={label} />
      {suffix && <span className="pointer-events-none absolute right-2 text-[10px] text-[var(--faint)]">{suffix}</span>}
    </label>
  )
}

function Section({ title, children, open: initial = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial)
  return (
    <div className="section">
      <button className="flex w-full items-center gap-1.5" onClick={() => setOpen(!open)} aria-expanded={open}>
        <Icon name="chev" size={11} className={`text-[var(--faint)] transition ${open ? 'rotate-90' : ''}`} />
        <span className="eyebrow">{title}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

function Seg<T extends string>({ value, options, onChange }: { value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div className="seg flex w-full">
      {options.map((o) => <button key={o} aria-selected={value === o} className="flex-1 !px-1 capitalize" onClick={() => onChange(o)}>{o}</button>)}
    </div>
  )
}

export function Inspector({ onClose }: { onClose?: () => void }) {
  const world = useStudio((s) => s.world)
  const selectedId = useStudio((s) => s.selectedId)
  const select = useStudio((s) => s.select)
  const run = useStudio((s) => s.run)
  const quality = useStudio((s) => s.quality)
  const set = useStudio((s) => s.set)
  const e = world.entities.find((x) => x.id === selectedId)
  const exec = (label: string, op: Operation) => void run(label, 'text', {}, [op])
  const t = e ? { id: e.id } : undefined
  const listed = world.entities.filter((x) => x.type !== 'tree' && x.type !== 'rock' && x.type !== 'road')
  const counts = world.entities.reduce<Record<string, number>>((a, x) => ({ ...a, [x.type]: (a[x.type] ?? 0) + 1 }), {})

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
        <span className="text-[12px] font-semibold">{e ? e.id : 'Scene'}</span>
        {e && <span className="text-[11px] text-[var(--muted)]">{e.type}</span>}
        {e && <button className="tool ml-auto" onClick={() => select(null)} aria-label="Deselect"><Icon name="x" size={14} /></button>}
        {onClose && <button className={`tool lg:hidden ${e ? '' : 'ml-auto'}`} onClick={onClose} aria-label="Close inspector"><Icon name="x" /></button>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {e && e.type !== 'river' && e.type !== 'road' && (
          <>
            <Section title="Transform">
              <div className="grid grid-cols-3 gap-1.5">
                <Num label="X" value={e.pos[0]} onCommit={(x) => exec(`move ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, to: [x, e.pos[2]] })} />
                <Num label="Y" value={e.pos[1]} onCommit={() => undefined} />
                <Num label="Z" value={e.pos[2]} onCommit={(z) => exec(`move ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, to: [e.pos[0], z] })} />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                <Num label="R" suffix="°" value={((e.rotY * 180) / Math.PI) % 360} onCommit={(d) => exec(`rotate ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, rotateDeg: Math.max(-360, Math.min(360, d - (e.rotY * 180) / Math.PI)) })} />
                <Num label="S" suffix="×" value={e.scale} step={0.1} onCommit={(s) => exec(`scale ${e.id}`, { action: 'MODIFY_OBJECT', target: t!, scaleBy: Math.max(0.3, Math.min(3, s / e.scale)) })} />
              </div>
              <p className="mt-2 text-[10.5px] text-[var(--faint)]">{e.pos[0] < riverX(e.pos[2]) ? 'West' : 'East'} bank{e.meta.span ? ` · span ${e.meta.span.toFixed(1)} m × ${(e.meta.width ?? 3.6).toFixed(1)} m` : ''}</p>
            </Section>
            <Section title="Material">
              <select value={e.material ?? ''} onChange={(ev) => exec(`${e.id} → ${ev.target.value}`, { action: 'MODIFY_OBJECT', target: t!, material: ev.target.value as never })} className="field capitalize" aria-label="Material">
                <option value="" disabled>Default</option>
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-2.5 grid grid-cols-12 gap-1">
                {COLORS.map((c) => (
                  <button key={c} title={c} aria-label={`Colour ${c}`} onClick={() => exec(`paint ${e.id} ${c}`, { action: 'MODIFY_OBJECT', target: t!, color: c })}
                    className={`aspect-square rounded-[4px] transition ${e.color === c ? 'ring-2 ring-[var(--text)] ring-offset-1 ring-offset-[var(--panel)]' : 'hover:scale-110'}`} style={{ background: COLOR_HEX[c] }} />
                ))}
              </div>
            </Section>
            <Section title="Physics">
              <dl className="grid grid-cols-[72px_1fr] gap-y-1 text-[11.5px]">
                <dt className="text-[var(--muted)]">Body</dt><dd>{e.type === 'rock' ? 'Dynamic' : e.type === 'bridge' && e.state === 'destroyed' ? 'Dynamic debris' : e.type === 'tree' ? 'Visual only' : 'Fixed'}</dd>
                <dt className="text-[var(--muted)]">Collider</dt><dd>{e.type === 'rock' ? 'Convex hull' : e.type === 'tree' ? '—' : 'Cuboid'}</dd>
                <dt className="text-[var(--muted)]">State</dt><dd className={e.state === 'destroyed' ? 'text-[var(--bad)]' : ''}>{e.state}</dd>
              </dl>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STRUCT.includes(e.type) && e.state === 'intact' && <button className="btn-line !h-7 !text-[var(--bad)]" onClick={() => exec(`destroy ${e.id}`, { action: 'DESTROY_STRUCTURE', target: t! })}>Destroy</button>}
                {e.state === 'destroyed' && <button className="btn-line !h-7" onClick={() => exec(`rebuild ${e.id}`, { action: 'REPAIR_STRUCTURE', target: t! })}>Rebuild</button>}
                {e.type === 'rock' && <button className="btn-line !h-7" onClick={() => exec(`push ${e.id}`, { action: 'APPLY_FORCE', target: t!, strength: 6 })}>Impulse</button>}
                <button className="btn-line !h-7" onClick={() => exec(`focus ${e.id}`, { action: 'SET_CAMERA', view: 'focus', target: t })}>Frame</button>
                <button className="btn-line !h-7" onClick={() => exec(`delete ${e.id}`, { action: 'DELETE_OBJECT', target: t! })}>Delete</button>
              </div>
            </Section>
          </>
        )}

        <Section title="Environment">
          <div className="space-y-2.5">
            <div><p className="mb-1 text-[10.5px] text-[var(--muted)]">Time of day</p><Seg value={world.env.time} options={['dawn', 'morning', 'noon', 'sunset', 'night']} onChange={(v) => exec(`time ${v}`, { action: 'SET_TIME_OF_DAY', time: v })} /></div>
            <div><p className="mb-1 text-[10.5px] text-[var(--muted)]">Weather</p><Seg value={world.env.weather} options={['clear', 'rain', 'fog', 'storm']} onChange={(v) => exec(`weather ${v}`, { action: 'SET_WEATHER', weather: v })} /></div>
            <div><p className="mb-1 text-[10.5px] text-[var(--muted)]">Lighting</p><Seg value={world.env.lighting} options={['soft', 'cinematic', 'dramatic']} onChange={(v) => exec(`lighting ${v}`, { action: 'SET_LIGHTING', preset: v })} /></div>
            <div><p className="mb-1 text-[10.5px] text-[var(--muted)]">Render quality</p><Seg value={quality} options={['low', 'medium', 'high']} onChange={(v) => set({ quality: v })} /></div>
          </div>
        </Section>

        <Section title={`Outliner · ${world.entities.length}`} open={!e}>
          <p className="mb-2 text-[10.5px] text-[var(--faint)]">{Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'Empty'}</p>
          <ul className="-mx-2 space-y-px">
            {listed.map((x) => (
              <li key={x.id}>
                <button onClick={() => select(x.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[11.5px] transition ${x.id === selectedId ? 'bg-[var(--accent)]/12 text-[var(--accent-2)]' : 'text-[var(--text)]/85 hover:bg-white/[0.04]'}`}>
                  <span className="font-mono">{x.id}</span>
                  <span className="ml-auto text-[10px] text-[var(--faint)]">{x.state === 'destroyed' ? 'debris' : x.material ?? x.color ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
