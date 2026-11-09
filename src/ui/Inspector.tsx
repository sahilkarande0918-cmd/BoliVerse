import { COLORS, MATERIALS, type Operation } from '../compiler/schema'
import { COLOR_HEX } from '../engine/Entities'
import { riverX } from '../engine/world'
import { useStudio } from '../store'

const STRUCT = ['bridge', 'house', 'temple', 'school', 'well']

export function Inspector() {
  const world = useStudio((s) => s.world)
  const selectedId = useStudio((s) => s.selectedId)
  const select = useStudio((s) => s.select)
  const run = useStudio((s) => s.run)
  const e = world.entities.find((x) => x.id === selectedId)
  const counts = world.entities.reduce<Record<string, number>>((a, x) => ({ ...a, [x.type]: (a[x.type] ?? 0) + 1 }), {})
  const listed = world.entities.filter((x) => x.type !== 'tree' && x.type !== 'rock' && x.type !== 'road')
  const exec = (label: string, op: Operation) => void run(label, 'text', {}, [op])
  const t = e ? { id: e.id } : undefined

  return (
    <div className="flex min-h-0 flex-1 flex-col text-xs">
      <div className="border-b border-[var(--line)] p-4">
        <p className="label mb-2">Scene graph</p>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([k, v]) => <span key={k} className="tnum rounded-full bg-white/[0.04] px-2 py-0.5 text-[11px] text-[var(--muted)]">{k} <b className="font-medium text-[var(--text)]">{v}</b></span>)}
          {!world.entities.length && <span className="text-[var(--muted)]">Empty — speak something into existence.</span>}
        </div>
        <ul className="scroll-thin mt-3 max-h-48 space-y-0.5 overflow-y-auto pr-1">
          {listed.map((x) => (
            <li key={x.id}>
              <button onClick={() => select(x.id)} className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition ${x.id === selectedId ? 'bg-[var(--gold)]/15 text-[var(--gold)]' : 'hover:bg-white/5'}`}>
                <span className="font-mono text-[11px]">{x.id}</span>
                <span className="ml-auto text-[10px] text-[var(--muted)]">{x.state === 'destroyed' ? 'debris' : x.material ?? ''}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        <p className="label mb-3">Inspector</p>
        {!e && <p className="text-[var(--muted)]">Click an object in the viewport, or say “isko laal karo” after creating something — “it/isko/that” resolves to the last touched entity.</p>}
        {e && (
          <div className="space-y-4">
            <div>
              <p className="font-display text-2xl">{e.id}</p>
              <p className="text-[var(--muted)]">{e.type} · {e.pos[0] < riverX(e.pos[2]) ? 'west' : 'east'} bank · {e.state}</p>
            </div>
            <dl className="tnum grid grid-cols-2 gap-x-3 gap-y-1.5">
              <dt className="text-[var(--muted)]">Position</dt><dd>{e.pos.map((v) => v.toFixed(1)).join(', ')}</dd>
              <dt className="text-[var(--muted)]">Rotation</dt><dd>{((e.rotY * 180) / Math.PI).toFixed(0)}°</dd>
              <dt className="text-[var(--muted)]">Scale</dt><dd>{e.scale.toFixed(2)}×</dd>
              {e.meta.span && <><dt className="text-[var(--muted)]">Span</dt><dd>{e.meta.span.toFixed(1)} m × {(e.meta.width ?? 3.6).toFixed(1)} m</dd></>}
              <dt className="text-[var(--muted)]">Physics</dt><dd>{e.type === 'rock' ? 'dynamic · hull' : e.type === 'bridge' && e.state === 'destroyed' ? 'dynamic debris' : e.type === 'tree' || e.type === 'road' ? 'visual only' : 'fixed · cuboid'}</dd>
            </dl>
            {e.type !== 'river' && e.type !== 'road' && (
              <>
                <div>
                  <p className="label mb-1.5">Colour</p>
                  <div className="flex flex-wrap gap-1.5">
                    {COLORS.map((c) => (
                      <button key={c} title={c} aria-label={`Colour ${c}`} onClick={() => exec(`paint ${e.id} ${c}`, { action: 'MODIFY_OBJECT', target: t!, color: c })}
                        className={`h-5 w-5 rounded-full border ${e.color === c ? 'border-white' : 'border-white/15'}`} style={{ background: COLOR_HEX[c] }} />
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="label w-16">Material</p>
                  <select value={e.material ?? ''} onChange={(ev) => exec(`${e.id} → ${ev.target.value}`, { action: 'MODIFY_OBJECT', target: t!, material: ev.target.value as never })} className="h-7 flex-1 rounded-md border border-[var(--line-2)] bg-[var(--panel-2)] px-2">
                    <option value="" disabled>default</option>
                    {MATERIALS.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button className="btn h-7 text-xs" onClick={() => exec(`${e.id} bigger`, { action: 'MODIFY_OBJECT', target: t!, scaleBy: 1.25 })}>Bigger</button>
                  <button className="btn h-7 text-xs" onClick={() => exec(`${e.id} smaller`, { action: 'MODIFY_OBJECT', target: t!, scaleBy: 0.8 })}>Smaller</button>
                  {STRUCT.includes(e.type) && e.state === 'intact' && <button className="btn h-7 text-xs text-[#f0a594]" onClick={() => exec(`destroy ${e.id}`, { action: 'DESTROY_STRUCTURE', target: t! })}>Destroy</button>}
                  {e.state === 'destroyed' && <button className="btn h-7 text-xs" onClick={() => exec(`rebuild ${e.id}`, { action: 'REPAIR_STRUCTURE', target: t! })}>Rebuild</button>}
                  {e.type === 'rock' && <button className="btn h-7 text-xs" onClick={() => exec(`push ${e.id}`, { action: 'APPLY_FORCE', target: t!, strength: 6 })}>Push</button>}
                  <button className="btn h-7 text-xs" onClick={() => exec(`focus ${e.id}`, { action: 'SET_CAMERA', view: 'focus', target: t })}>Focus</button>
                  <button className="btn h-7 text-xs" onClick={() => exec(`delete ${e.id}`, { action: 'DELETE_OBJECT', target: t! })}>Delete</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
