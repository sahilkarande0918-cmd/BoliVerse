import { INTERIOR_TYPES, type CameraPreset, type ObjectType, type Operation, type Selector } from './schema'
import { type Entity, type World, emptyWorld, riverX as riverXAt, rng, terrainHeight } from '../engine/world'
import { solvePlacement, villageEntities } from '../engine/spatial'

export type Effect =
  | { kind: 'camera'; view: 'overview' | 'top' | 'low' | 'focus' | 'free'; targetId?: string }
  | { kind: 'path'; preset: CameraPreset; durationSec: number; targetId?: string }
  | { kind: 'play' }
  | { kind: 'record'; durationSec?: number; aspect?: '16:9' | '9:16' }
  | { kind: 'stopRecord' }
  | { kind: 'undo'; steps: number }
  | { kind: 'redo'; steps: number }
  | { kind: 'save'; name?: string }
  | { kind: 'load'; name?: string }
  | { kind: 'clarify'; question: string }
  | { kind: 'force'; targetIds: string[]; strength: number }

export interface ApplyResult {
  world: World
  affected: string[]
  notes: string[]
  effects: Effect[]
  error?: string
}

const STRUCTURES: ObjectType[] = ['bridge', 'house', 'temple', 'school', 'well', 'mansion']

/** Resolve a reference selector against the live world. Pure + deterministic. */
export function resolve(w: World, sel: Selector | undefined, selectedId: string | null, purpose?: 'destroy' | 'repair'): Entity[] {
  if (!sel) return []
  let pool = w.entities
  if (sel.id) return pool.filter((e) => e.id === sel.id)
  if (sel.type) pool = pool.filter((e) => e.type === sel.type)
  if (sel.side) {
    const west = sel.side === 'west' || sel.side === 'left'
    pool = pool.filter((e) => (e.pos[0] < riverXAt(e.pos[2])) === west)
  }
  if (purpose === 'destroy') pool = pool.filter((e) => e.state === 'intact')
  if (purpose === 'repair') pool = pool.filter((e) => e.state === 'destroyed')
  if (!pool.length) return []
  if (sel.ref === 'all') return pool

  if (sel.near) {
    const anchors = w.entities.filter((e) => e.type === sel.near)
    if (anchors.length) {
      const anchor = byRecency(w, anchors)[0]
      return [pool.slice().sort((a, b) => dist(a, anchor) - dist(b, anchor))[0]]
    }
  }
  const selected = pool.find((e) => e.id === selectedId)
  if (sel.ref === 'selected' && selected) return [selected]
  const ordered = byRecency(w, pool)
  if (sel.ref === 'previous') return [ordered[1] ?? ordered[0]]
  if (selected && sel.ref !== 'last') return [selected]
  return [ordered[0]]
}

const dist = (a: Entity, b: Entity) => Math.hypot(a.pos[0] - b.pos[0], a.pos[2] - b.pos[2])
function byRecency(w: World, list: Entity[]) {
  const rank = (e: Entity) => w.recent.lastIndexOf(e.id)
  return list.slice().sort((a, b) => rank(b) - rank(a))
}

function touch(w: World, ids: string[]): World {
  const recent = [...w.recent.filter((id) => !ids.includes(id)), ...ids].slice(-40)
  return { ...w, recent }
}

function newId(w: World, type: ObjectType): [string, World] {
  const n = (w.counters[type] ?? 0) + 1
  return [`${type}_${n}`, { ...w, counters: { ...w.counters, [type]: n } }]
}

function create(w: World, op: Extract<Operation, { action: 'CREATE_OBJECT' | 'BATCH_CREATE' }>, selectedId: string | null, count: number): ApplyResult {
  const notes: string[] = []
  let world = w
  const affected: string[] = []
  const type = op.objectType

  if (type === 'river') {
    const existing = world.entities.find((e) => e.type === 'river')
    if (existing) return { world: touch(world, [existing.id]), affected: [existing.id], notes: ['River already flows through the valley'], effects: [] }
  }
  if (type === 'bridge' && !world.entities.some((e) => e.type === 'river')) {
    const r = create(world, { action: 'CREATE_OBJECT', objectType: 'river' }, selectedId, 1)
    world = r.world
    affected.push(...r.affected)
    notes.push('Added a river first — a bridge needs something to cross')
  }
  if (type === 'road' && world.entities.some((e) => e.type === 'road')) {
    return { world, affected: [], notes: ['Bank roads already exist'], effects: [] }
  }

  if (INTERIOR_TYPES.includes(type) && op.placement?.relation === 'inside' && !world.entities.some((e) => e.type === 'mansion')) {
    const r = create(world, { action: 'CREATE_OBJECT', objectType: 'mansion' }, selectedId, 1)
    world = r.world
    affected.push(...r.affected)
    notes.push('Built a mansion first — interiors need a home')
  }
  if (type === 'road') {
    for (const rd of villageEntities(world.seed).filter((v) => v.type === 'road')) {
      const [rid, w2] = newId(world, 'road')
      world = { ...w2, entities: [...w2.entities, { ...rd, id: rid }] }
      affected.push(rid)
    }
    return { world: touch(world, affected), affected, notes: ['Roads laid along both banks'], effects: [] }
  }

  const refSel = op.placement?.ref ?? (op.placement?.relation === 'across' ? { type: 'river' as const } : undefined)
  const ref = resolve(world, refSel, selectedId)[0]
  const ref2 = resolve(world, op.placement?.ref2, selectedId)[0]
  const sameSpot = op.placement?.relation === 'same_place'
    ? byRecency(world, world.entities.filter((e) => e.type === type && e.state === 'destroyed'))[0] ?? byRecency(world, world.entities.filter((e) => e.type === type))[0]
    : undefined
  const r = rng(world.seed * 31 + world.entities.length * 7 + (world.counters[type] ?? 0))

  for (let i = 0; i < count; i++) {
    const pose = solvePlacement(world, type, op.placement, ref, ref2, r, sameSpot)
    if (!pose) { notes.push(`No free space left for ${count - i} more ${type}(s)`); break }
    const [id, w2] = newId(world, type)
    const e: Entity = {
      id, type, pos: pose.pos, rotY: pose.rotY, scale: op.scale ?? (type === 'tree' ? 0.8 + r() * 0.5 : 1),
      material: op.material ?? (type === 'bridge' ? 'wood' : undefined), color: op.color, state: 'intact', gen: 0,
      meta: { span: pose.span, width: type === 'bridge' ? 3.6 * (op.scale ?? 1) : undefined, variant: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) },
    }
    world = { ...w2, entities: [...w2.entities, e] }
    affected.push(id)
    if (type === 'mansion') {
      const near = (x: Entity) => ['tree', 'rock', 'lamp'].includes(x.type) && Math.hypot(x.pos[0] - e.pos[0], x.pos[2] - e.pos[2]) < 22
      const cleared = world.entities.filter(near).length
      if (cleared) { world = { ...world, entities: world.entities.filter((x) => !near(x)) }; notes.push(`Cleared ${cleared} trees/rocks for the site`) }
    }
  }
  if (sameSpot && type === 'bridge') notes.push(`Built on the same banks as ${sameSpot.id}`)
  return { world: touch(world, affected), affected, notes, effects: [] }
}

function mapTargets(w: World, ids: string[], f: (e: Entity) => Entity): World {
  return { ...w, entities: w.entities.map((e) => (ids.includes(e.id) ? f(e) : e)) }
}

export function applyOperation(w: World, op: Operation, selectedId: string | null = null): ApplyResult {
  const none = (error: string): ApplyResult => ({ world: w, affected: [], notes: [], effects: [], error })
  const fx = (effects: Effect[]): ApplyResult => ({ world: w, affected: [], notes: [], effects })

  switch (op.action) {
    case 'CREATE_SCENE': {
      let world = { ...emptyWorld(w.seed), env: w.env, template: op.template }
      if (op.template === 'village') {
        const ids: string[] = []
        for (const e of villageEntities(world.seed)) {
          const [id, w2] = newId(world, e.type)
          world = { ...w2, entities: [...w2.entities, { ...e, id }] }
          ids.push(id)
        }
        return { world: touch(world, ids.slice(-3)), affected: ids, notes: [`Village generated: ${ids.length} entities (seed ${world.seed})`], effects: [{ kind: 'camera', view: 'overview' }] }
      }
      return { world, affected: [], notes: ['Blank valley ready'], effects: [{ kind: 'camera', view: 'overview' }] }
    }
    case 'CREATE_OBJECT':
      return create(w, op, selectedId, 1)
    case 'BATCH_CREATE':
      return create(w, op, selectedId, op.count)

    case 'MODIFY_OBJECT': {
      const t = resolve(w, op.target, selectedId)
      if (!t.length) return none(`Nothing matches ${describe(op.target)}`)
      const ids = t.map((e) => e.id)
      const world = mapTargets(w, ids, (e) => {
        const s = op.scaleBy ? Math.min(3, Math.max(0.3, e.scale * op.scaleBy)) : e.scale
        const next: Entity = { ...e, color: op.color ?? e.color, material: op.material ?? e.material, scale: s }
        if (e.type === 'bridge' && op.scaleBy) next.meta = { ...e.meta, width: (e.meta.width ?? 3.6) * op.scaleBy }
        return next
      })
      return { world: touch(world, ids), affected: ids, notes: [], effects: [] }
    }
    case 'TRANSFORM_OBJECT': {
      const t = resolve(w, op.target, selectedId).filter((e) => e.type !== 'river' && e.type !== 'road')
      if (!t.length) return none(`Nothing movable matches ${describe(op.target)}`)
      const ids = t.map((e) => e.id)
      const m = op.move
      const d: Record<string, [number, number, number]> = { left: [-1, 0, 0], right: [1, 0, 0], forward: [0, 0, -1], back: [0, 0, 1], up: [0, 1, 0], down: [0, -1, 0] }
      const world = mapTargets(w, ids, (e) => {
        const v = m ? d[m.direction] : [0, 0, 0]
        const x = op.to ? op.to[0] : e.pos[0] + v[0] * (m?.meters ?? 0), z = op.to ? op.to[1] : e.pos[2] + v[2] * (m?.meters ?? 0)
        const y = e.type === 'bridge' ? e.pos[1] : v[1] ? e.pos[1] + v[1] * (m?.meters ?? 0) : Math.max(0, terrainHeight(x, z))
        return { ...e, pos: [x, y, z], rotY: e.rotY + ((op.rotateDeg ?? 0) * Math.PI) / 180 }
      })
      return { world: touch(world, ids), affected: ids, notes: [], effects: [] }
    }
    case 'DUPLICATE_OBJECT': {
      const src = resolve(w, op.target, selectedId)[0]
      if (!src) return none(`Nothing matches ${describe(op.target)}`)
      return create(w, { action: 'BATCH_CREATE', objectType: src.type, count: op.count ?? 1, color: src.color, material: src.material, scale: src.scale, placement: { relation: 'near', ref: { id: src.id } } }, selectedId, op.count ?? 1)
    }
    case 'DELETE_OBJECT': {
      const t = resolve(w, op.target, selectedId)
      if (!t.length) return none(`Nothing matches ${describe(op.target)}`)
      const ids = t.map((e) => e.id)
      return { world: { ...w, entities: w.entities.filter((e) => !ids.includes(e.id)), recent: w.recent.filter((id) => !ids.includes(id)) }, affected: ids, notes: [], effects: [] }
    }
    case 'DESTROY_STRUCTURE': {
      const t = resolve(w, op.target.type || op.target.id || op.target.ref ? op.target : { type: 'bridge' }, selectedId, 'destroy').filter((e) => STRUCTURES.includes(e.type))
      if (!t.length) return none(`No intact structure matches ${describe(op.target)}`)
      const ids = t.map((e) => e.id)
      const world = mapTargets(w, ids, (e) => ({ ...e, state: 'destroyed', gen: e.gen + 1 }))
      return { world: touch(world, ids), affected: ids, notes: [`${ids.join(', ')} fractured into rigid bodies`], effects: [] }
    }
    case 'REPAIR_STRUCTURE': {
      const t = resolve(w, op.target.type || op.target.id ? op.target : { ...op.target, type: 'bridge' }, selectedId, 'repair')
      if (!t.length) return none(`No destroyed structure matches ${describe(op.target)}`)
      // Rebuild as a fresh entity on the same spot; the ruin's debris stays in the river as history.
      const src = t[0]
      return create(w, { action: 'CREATE_OBJECT', objectType: src.type, material: op.material ?? src.material, placement: { relation: 'same_place', ref: { id: src.id } } }, selectedId, 1)
    }
    case 'APPLY_FORCE': {
      const t = resolve(w, op.target, selectedId)
      if (!t.length) return none(`Nothing matches ${describe(op.target)}`)
      return fx([{ kind: 'force', targetIds: t.map((e) => e.id), strength: op.strength ?? 5 }])
    }
    case 'SET_WEATHER':
      return { world: { ...w, env: { ...w.env, weather: op.weather } }, affected: [], notes: [], effects: [] }
    case 'SET_LIGHTING':
      return { world: { ...w, env: { ...w.env, lighting: op.preset } }, affected: [], notes: [], effects: [] }
    case 'SET_TIME_OF_DAY':
      return { world: { ...w, env: { ...w.env, time: op.time } }, affected: [], notes: [], effects: [] }
    case 'SET_CAMERA':
      return fx([{ kind: 'camera', view: op.view, targetId: resolve(w, op.target, selectedId)[0]?.id }])
    case 'CREATE_CAMERA_PATH': {
      const target = resolve(w, op.target ?? (op.preset.includes('bridge') || op.preset === 'destruction' ? { type: 'bridge' } : op.preset === 'interior' || op.preset === 'mansion_reveal' ? { type: 'mansion' } : undefined), selectedId)[0]
      return fx([{ kind: 'path', preset: op.preset, durationSec: op.durationSec ?? 8, targetId: target?.id }])
    }
    case 'PLAY_CAMERA_PATH':
      return fx([{ kind: 'play' }])
    case 'START_RECORDING':
      return fx([{ kind: 'record', durationSec: op.durationSec, aspect: op.aspect }])
    case 'STOP_RECORDING':
      return fx([{ kind: 'stopRecord' }])
    case 'UNDO':
      return fx([{ kind: 'undo', steps: op.steps ?? 1 }])
    case 'REDO':
      return fx([{ kind: 'redo', steps: op.steps ?? 1 }])
    case 'SAVE_SCENE':
      return fx([{ kind: 'save', name: op.name }])
    case 'LOAD_SCENE':
      return fx([{ kind: 'load', name: op.name }])
    case 'CLARIFY_INTENT':
      return fx([{ kind: 'clarify', question: op.question }])
  }
}

function describe(s: Selector) {
  return [s.ref, s.side, s.type ?? 'object', s.near && `near ${s.near}`, s.id].filter(Boolean).join(' ')
}

/** Apply a list of operations as one transaction: all world changes land together or not at all. */
export function applyTransaction(w: World, ops: Operation[], selectedId: string | null) {
  let world = w
  const affected: string[] = [], notes: string[] = [], effects: Effect[] = [], errors: string[] = []
  for (const op of ops) {
    const r = applyOperation(world, op, selectedId)
    if (r.error) { errors.push(r.error); continue }
    world = r.world
    affected.push(...r.affected); notes.push(...r.notes); effects.push(...r.effects)
  }
  return { world, affected, notes, effects, errors }
}
