import { useEffect, useState } from 'react'
import { COLORS, MATERIALS, type Operation } from '../compiler/schema'
import { COLOR_HEX } from '../engine/Entities'
import { riverX } from '../engine/world'
import { useStudio } from '../store'
import { Icon } from './Icon'

const STRUCT = ['bridge', 'house', 'temple', 'school', 'well', 'mansion']

function Num({ label, value, onCommit, readOnly, suffix }: { label: string; value: number; onCommit?: (v: number) => void; readOnly?: boolean; suffix?: string }) {
  const [v, setV] = useState(value.toFixed(1))
  useEffect(() => setV(value.toFixed(1)), [value])
  const commit = () => { const n = parseFloat(v); if (onCommit && Number.isFinite(n) && Math.abs(n - value) > 1e-3) onCommit(n); else setV(value.toFixed(1)) }
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">{label}</span>
      <span className="mt-1 flex items-baseline border-b border-[var(--line-2)] transition focus-within:border-[var(--ink)]">
        <input inputMode="decimal" readOnly={readOnly} value={v} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={`tnum h-7 w-full min-w-0 bg-transparent text-[13.5px] focus:outline-none ${readOnly ? 'text-[var(--faint)]' : ''}`} aria-label={label} />
        {suffix && <span className="text-[11px] text-[var(--faint)]">{suffix}</span>}
      </span>
    </label>
  )
}

function Section({ title, children, open: initial = true }: { title: string; children: React.ReactNode; open?: boolean }) {
  const [open, setOpen] = useState(initial)
  return (
    <div className="section">
      <button className="flex w-full items-center" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="eyebrow">{title}</span>
        <span className={`ml-auto text-[var(--faint)] transition-transform duration-300 ${open ? 'rotate-90' : ''}`}><Icon name="chev" size={13} /></span>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden"><div className="pt-4">{children}</div></div>
      </div>
    </div>
  )
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: T[]; onChange: (v: T) => void }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--faint)]">{label}</p>
      <div className="tabs sm mt-1 flex-wrap">
        {options.map((o) => <button key={o} aria-selected={value === o} className="capitalize" onClick={() => onChange(o)}>{o}</button>)}
      </div>
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
      <div className="flex h-14 shrink-0 items-center gap-3 px-6">
        <span className="truncate text-[15px] font-medium tracking-[-0.005em]">{e ? e.id.replace('_', ' ') : 'Scene'}</span>
        {e && <span className="text-[12.5px] text-[var(--muted)]">{e.type}</span>}
        {e && <button className="tool -mr-2 ml-auto" onClick={() => select(null)} aria-label="Deselect"><Icon name="x" size={14} /></button>}
        {onClose && <button className={`tool -mr-2 lg:hidden ${e ? '' : 'ml-auto'}`} onClick={onClose} aria-label="Close inspector"><Icon name="x" /></button>}
      </div>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {e && e.type !== 'river' && e.type !== 'road' && (
          <>
            <Section title="Transform">
              <div className="grid grid-cols-3 gap-4">
                <Num label="X" value={e.pos[0]} onCommit={(x) => exec(`move ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, to: [x, e.pos[2]] })} />
                <Num label="Y" value={e.pos[1]} readOnly />
                <Num label="Z" value={e.pos[2]} onCommit={(z) => exec(`move ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, to: [e.pos[0], z] })} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-4">
                <Num label="Rotation" suffix="°" value={((e.rotY * 180) / Math.PI) % 360} onCommit={(d) => exec(`rotate ${e.id}`, { action: 'TRANSFORM_OBJECT', target: t!, rotateDeg: Math.max(-360, Math.min(360, d - (e.rotY * 180) / Math.PI)) })} />
                <Num label="Scale" suffix="×" value={e.scale} onCommit={(s) => exec(`scale ${e.id}`, { action: 'MODIFY_OBJECT', target: t!, scaleBy: Math.max(0.3, Math.min(3, s / e.scale)) })} />
              </div>
              <p className="mt-4 text-[12px] text-[var(--faint)]">{e.pos[0] < riverX(e.pos[2]) ? 'West' : 'East'} bank{e.meta.span ? ` · span ${e.meta.span.toFixed(1)} m × ${(e.meta.width ?? 3.6).toFixed(1)} m` : ''}</p>
            </Section>
            <Section title="Material">
              <select value={e.material ?? ''} onChange={(ev) => exec(`${e.id} → ${ev.target.value}`, { action: 'MODIFY_OBJECT', target: t!, material: ev.target.value as never })} className="field capitalize" aria-label="Material">
                <option value="" disabled>Default</option>
                {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="mt-4 flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button key={c} title={c} aria-label={`Colour ${c}`} onClick={() => exec(`paint ${e.id} ${c}`, { action: 'MODIFY_OBJECT', target: t!, color: c })}
                    className={`h-5 w-5 rounded-full transition duration-300 ${e.color === c ? 'ring-1 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--panel)]' : 'hover:scale-110'}`} style={{ background: COLOR_HEX[c] }} />
                ))}
              </div>
            </Section>
            <Section title="Physics">
              <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-[13px]">
                <dt className="text-[var(--muted)]">Body</dt><dd>{e.type === 'rock' ? 'Dynamic' : e.type === 'bridge' && e.state === 'destroyed' ? 'Dynamic debris' : e.type === 'tree' ? 'Visual only' : 'Fixed'}</dd>
                <dt className="text-[var(--muted)]">Collider</dt><dd>{e.type === 'rock' ? 'Convex hull' : e.type === 'tree' ? '—' : 'Cuboid'}</dd>
                <dt className="text-[var(--muted)]">State</dt><dd className={e.state === 'destroyed' ? 'text-[var(--bad)]' : ''}>{e.state}</dd>
              </dl>
              <div className="mt-5 flex flex-wrap gap-2">
                {STRUCT.includes(e.type) && e.state === 'intact' && <button className="btn-line !h-8" onClick={() => exec(`destroy ${e.id}`, { action: 'DESTROY_STRUCTURE', target: t! })}>Destroy</button>}
                {e.state === 'destroyed' && <button className="btn-line !h-8" onClick={() => exec(`rebuild ${e.id}`, { action: 'REPAIR_STRUCTURE', target: t! })}>Rebuild</button>}
                {e.type === 'rock' && <button className="btn-line !h-8" onClick={() => exec(`push ${e.id}`, { action: 'APPLY_FORCE', target: t!, strength: 6 })}>Impulse</button>}
                <button className="btn-line !h-8" onClick={() => exec(`focus ${e.id}`, { action: 'SET_CAMERA', view: 'focus', target: t })}>Frame</button>
                <button className="btn-line !h-8" onClick={() => exec(`delete ${e.id}`, { action: 'DELETE_OBJECT', target: t! })}>Delete</button>
              </div>
            </Section>
          </>
        )}

        <Section title="Environment">
          <div className="space-y-5">
            <Choice label="Time of day" value={world.env.time} options={['dawn', 'morning', 'noon', 'sunset', 'night']} onChange={(v) => exec(`time ${v}`, { action: 'SET_TIME_OF_DAY', time: v })} />
            <Choice label="Weather" value={world.env.weather} options={['clear', 'rain', 'fog', 'storm']} onChange={(v) => exec(`weather ${v}`, { action: 'SET_WEATHER', weather: v })} />
            <Choice label="Lighting" value={world.env.lighting} options={['soft', 'cinematic', 'dramatic']} onChange={(v) => exec(`lighting ${v}`, { action: 'SET_LIGHTING', preset: v })} />
            <Choice label="Render quality" value={quality} options={['low', 'medium', 'high', 'ultra']} onChange={(v) => set({ quality: v })} />
          </div>
        </Section>

        <Section title={`Outliner · ${world.entities.length}`} open={!e}>
          <p className="mb-3 text-[12px] leading-relaxed text-[var(--faint)]">{Object.entries(counts).map(([k, v]) => `${v} ${k}`).join(' · ') || 'Nothing yet.'}</p>
          <ul>
            {listed.map((x) => (
              <li key={x.id}>
                <button onClick={() => select(x.id)} className={`flex w-full items-center gap-2 border-b border-[var(--line)] py-2 text-left text-[13px] transition ${x.id === selectedId ? 'text-[var(--text)]' : 'text-[var(--text)]/75 hover:text-[var(--text)]'}`}>
                  {x.id === selectedId && <span className="h-1 w-1 rounded-full bg-[var(--ink)]" />}
                  <span>{x.id.replace('_', ' ')}</span>
                  <span className="ml-auto text-[11.5px] text-[var(--faint)]">{x.state === 'destroyed' ? 'debris' : x.material ?? x.color ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  )
}
