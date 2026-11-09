import { INTERIOR_TYPES, type ObjectType, type Placement } from '../compiler/schema'
import { BANK_D, DECK_Y, type Entity, type World, bridgeEnds, rng, riverSlope, riverX, terrainHeight, WATER_Y } from './world'

// Deterministic spatial solvers. Everything is in metres; +x east, +z south, river runs along z.

const FOOTPRINT: Partial<Record<ObjectType, number>> = { house: 6.5, temple: 9, school: 10, well: 3.5, tree: 2.2, rock: 1.6, lamp: 1, cart: 3, mansion: 30, sofa: 0.1, bed: 0.1, table: 0.1, chandelier: 0.1, plant: 0.1, rug: 0.1 }
export const footprint = (t: ObjectType) => FOOTPRINT[t] ?? 3

const LAND_MIN_D = BANK_D + 3 // keep buildings off the river banks
const ROAD_D = 15 // bank roads run parallel to the river at this offset

export function isFree(w: World, x: number, z: number, r: number, ignore?: string) {
  if (Math.abs(x) > 82 || Math.abs(z) > 82) return false
  const d = Math.abs(x - riverX(z))
  if (d < LAND_MIN_D + r * 0.4) return false
  if (Math.abs(d - ROAD_D) < 2.2 + r * 0.45 && w.entities.some((e) => e.type === 'road')) return false
  for (const e of w.entities) {
    if (e.id === ignore || e.type === 'river' || e.type === 'road' || e.type === 'bridge' || INTERIOR_TYPES.includes(e.type)) continue
    if (r >= 20 && (e.type === 'tree' || e.type === 'rock' || e.type === 'lamp')) continue // big builds clear their site
    const min = (footprint(e.type) + r) * 0.5
    if ((e.pos[0] - x) ** 2 + (e.pos[2] - z) ** 2 < min * min) return false
  }
  for (const b of w.entities) {
    if (b.type !== 'bridge') continue
    const [a, c] = bridgeEnds(b)
    for (const [ex, ez] of [a, c]) if ((ex - x) ** 2 + (ez - z) ** 2 < (r + 6) ** 2) return false
  }
  return true
}

/** Bridge geometry for a crossing at river station z: centred on the river, perpendicular to flow. */
export function solveAcross(z: number) {
  const slope = riverSlope(z)
  const nx = 1 / Math.hypot(1, slope), nz = -slope / Math.hypot(1, slope)
  const rotY = Math.atan2(-nz, nx)
  const span = 2 * (BANK_D + 1.5) * Math.hypot(1, slope)
  return { pos: [riverX(z), DECK_Y, z] as [number, number, number], rotY, span }
}

export function pickCrossingZ(w: World, hint?: number) {
  const taken = w.entities.filter((e) => e.type === 'bridge' && e.state === 'intact').map((e) => e.pos[2])
  const candidates = hint !== undefined ? [hint] : [0, 22, -22, 40, -40, 58, -58]
  return candidates.find((z) => taken.every((t) => Math.abs(t - z) > 12)) ?? candidates[0]
}

const facingRiver = (x: number, z: number) => (x < riverX(z) ? Math.PI / 2 : -Math.PI / 2)

/** Sample a free spot. `around` biases the search; side restricts to a bank. */
export function sampleSpot(
  w: World,
  type: ObjectType,
  r: () => number,
  opts: { around?: [number, number]; radius?: number; side?: 'west' | 'east'; dMin?: number; dMax?: number } = {},
): [number, number] | null {
  const fp = footprint(type)
  for (let i = 0; i < 400; i++) {
    let x: number, z: number
    if (opts.around) {
      const a = r() * Math.PI * 2, rad = fp + (opts.radius ?? 10) * Math.sqrt(r())
      x = opts.around[0] + Math.cos(a) * rad
      z = opts.around[1] + Math.sin(a) * rad
    } else {
      const side = opts.side ?? (r() < 0.5 ? 'west' : 'east')
      z = (r() - 0.5) * 120
      const d = (opts.dMin ?? LAND_MIN_D + 2) + r() * ((opts.dMax ?? 45) - (opts.dMin ?? LAND_MIN_D + 2))
      x = riverX(z) + (side === 'west' ? -d : d)
    }
    if (opts.side && (opts.side === 'west') !== x < riverX(z)) continue
    if (isFree(w, x, z, fp)) return [x, z]
  }
  return null
}

export interface Resolved { pos: [number, number, number]; rotY: number; span?: number; note?: string }

/** Turn a placement relation into a concrete pose. `ref`/`ref2` are already-resolved entities. */
export function solvePlacement(
  w: World,
  type: ObjectType,
  placement: Placement | undefined,
  ref: Entity | undefined,
  ref2: Entity | undefined,
  r: () => number,
  sameSpot?: Entity,
): Resolved | null {
  const rel = placement?.relation

  if (type === 'bridge') {
    if (rel === 'same_place' && sameSpot) return { pos: [...sameSpot.pos], rotY: sameSpot.rotY, span: sameSpot.meta.span }
    const hint = ref && ref.type !== 'river' ? ref.pos[2] : undefined
    const s = solveAcross(pickCrossingZ(w, hint))
    return { pos: s.pos, rotY: s.rotY, span: s.span }
  }
  if (type === 'river') return { pos: [0, WATER_Y, 0], rotY: 0 }
  if (type === 'road') return { pos: [0, 0.02, 0], rotY: 0 }

  if (rel === 'inside' && ref?.type === 'mansion') return interiorSlot(w, type, ref, r)
  if (type === 'mansion') {
    const at = placement?.at ?? (ref && ref.type !== 'river' ? [ref.pos[0], ref.pos[2]] as [number, number] : undefined)
    // prefer flat valley floor (hills start ~30 m from the river), then anywhere
    const s = (at && sampleSpot(w, type, r, { around: at, radius: 30 }))
      ?? sampleSpot(w, type, r, { side: placement?.side, dMin: 21, dMax: 27 })
      ?? sampleSpot(w, type, r, { side: placement?.side, dMin: 27, dMax: 45 })
      ?? sampleSpot(w, type, r, { dMin: 21, dMax: 70 })
    if (!s) return null
    return { pos: [s[0], Math.max(0, terrainHeight(s[0], s[1])), s[1]], rotY: facingRiver(s[0], s[1]) }
  }

  let spot: [number, number] | null = null
  const fp = footprint(type)
  if (placement?.at) spot = isFree(w, placement.at[0], placement.at[1], fp) ? placement.at : sampleSpot(w, type, r, { around: placement.at, radius: 8 })
  else if (rel === 'between' && ref && ref2) {
    const mx = (ref.pos[0] + ref2.pos[0]) / 2, mz = (ref.pos[2] + ref2.pos[2]) / 2
    spot = isFree(w, mx, mz, fp) ? [mx, mz] : sampleSpot(w, type, r, { around: [mx, mz], radius: 5 })
  } else if (ref && rel && ['left_of', 'right_of', 'behind', 'in_front'].includes(rel)) {
    // relative to the reference's own facing (houses face the river)
    const f = ref.rotY
    const fwd: [number, number] = [Math.sin(f), Math.cos(f)]
    const right: [number, number] = [Math.cos(f), -Math.sin(f)]
    const dir = rel === 'in_front' ? fwd : rel === 'behind' ? [-fwd[0], -fwd[1]] : rel === 'right_of' ? right : [-right[0], -right[1]]
    const dist = (footprint(ref.type) + fp) * 0.6 + 1.5
    const tx = ref.pos[0] + dir[0] * dist, tz = ref.pos[2] + dir[1] * dist
    spot = isFree(w, tx, tz, fp) ? [tx, tz] : sampleSpot(w, type, r, { around: [tx, tz], radius: 4 })
  } else if (ref && ref.type !== 'river' && (rel === 'near' || rel === 'same_place' || !rel)) {
    spot = sampleSpot(w, type, r, { around: [ref.pos[0], ref.pos[2]], radius: 9 })
  } else if (rel === 'along' || (ref?.type === 'river')) {
    spot = sampleSpot(w, type, r, { side: placement?.side, dMin: LAND_MIN_D, dMax: LAND_MIN_D + 8 })
  } else {
    spot = sampleSpot(w, type, r, { side: placement?.side, dMax: type === 'tree' ? 75 : 40 })
  }
  if (!spot) return null
  const [x, z] = spot
  const y = Math.max(terrainHeight(x, z), type === 'rock' ? -2 : 0)
  return { pos: [x, y, z], rotY: type === 'tree' || type === 'rock' ? r() * Math.PI * 2 : facingRiver(x, z) + (r() - 0.5) * 0.25 }
}

// ---------- village template ----------
export function villageEntities(seed: number): Omit<Entity, 'id'>[] {
  const r = rng(seed)
  const out: Omit<Entity, 'id'>[] = []
  const scratch: World = { version: 1, seed, template: 'village', entities: [], counters: {}, recent: [], env: { time: 'morning', weather: 'clear', lighting: 'cinematic' } }
  const push = (e: Omit<Entity, 'id'>) => { out.push(e); scratch.entities.push({ ...e, id: `t${out.length}` }) }
  const base = { scale: 1, state: 'intact' as const, gen: 0 }

  for (const side of [-1, 1]) {
    const pts: [number, number][] = []
    for (let z = -80; z <= 80; z += 8) pts.push([riverX(z) + side * ROAD_D, z])
    push({ ...base, type: 'road', pos: [0, 0.02, 0], rotY: 0, meta: { points: pts } })
  }
  const place = (type: ObjectType, opts: Parameters<typeof sampleSpot>[3], extra: Partial<Entity> = {}) => {
    const s = sampleSpot(scratch, type, r, opts)
    if (!s) return
    const y = Math.max(0, terrainHeight(s[0], s[1]))
    push({ ...base, type, pos: [s[0], y, s[1]], rotY: type === 'tree' || type === 'rock' ? r() * 6.28 : facingRiver(s[0], s[1]), meta: { variant: Math.floor(r() * 4), seed: Math.floor(r() * 1e6) }, ...extra })
  }
  place('temple', { around: [riverX(-14) - 24, -14], radius: 4 })
  place('school', { around: [riverX(16) + 25, 16], radius: 4 })
  place('well', { around: [riverX(-2) - 19, 6], radius: 3 })
  for (let i = 0; i < 8; i++) place('house', { side: 'west', dMin: 18, dMax: 34 })
  for (let i = 0; i < 7; i++) place('house', { side: 'east', dMin: 18, dMax: 34 })
  for (let i = 0; i < 6; i++) place('lamp', { side: i % 2 ? 'west' : 'east', dMin: 12.5, dMax: 13 })
  for (let i = 0; i < 70; i++) place('tree', { dMin: 11, dMax: 78 })
  for (let i = 0; i < 7; i++) {
    const z = (r() - 0.5) * 90, side = r() < 0.5 ? -1 : 1
    const x = riverX(z) + side * (6 + r() * 2)
    push({ ...base, type: 'rock', pos: [x, terrainHeight(x, z) + 0.6, z], rotY: r() * 6.28, scale: 0.7 + r() * 0.8, meta: { seed: Math.floor(r() * 1e6) } })
  }
  return out
}

// ---------- interior design: furniture slots inside a mansion (mansion-local metres, +z = glass front) ----------
const SLOTS: Record<string, [number, number, number, number][]> = { // x, z, rotY, y
  sofa: [[-5.6, -3.6, 0, 0], [-8.6, -0.4, Math.PI / 2, 0], [-2.6, -0.4, -Math.PI / 2, 0]],
  rug: [[-5.6, -0.6, 0, 0]],
  table: [[2.6, 1.6, 0, 0], [-5.6, -0.6, 0, 0], [-8.5, 3.6, 0, 0]],
  chandelier: [[2.6, 1.6, 0, 3.55], [-5.6, -0.6, 0, 3.55], [7.4, 2, 0, 3.55]],
  plant: [[-9.2, -6.2, 0, 0], [-9.3, 4.2, 0, 0], [4.8, -1.3, 0, 0], [9.3, 4.2, 0, 0], [-2.3, -6.3, 0, 0]],
  bed: [[7.4, 2, Math.PI, 0]],
}
export const MANSION_FLOOR = 0.62

function interiorSlot(w: World, type: ObjectType, m: Entity, r: () => number): Resolved | null {
  const c = Math.cos(m.rotY), s = Math.sin(m.rotY)
  const toWorld = (x: number, z: number): [number, number] => [m.pos[0] + x * c + z * s, m.pos[2] - x * s + z * c]
  const taken = (x: number, z: number) => w.entities.some((e) => e.type === type && (e.pos[0] - x) ** 2 + (e.pos[2] - z) ** 2 < 0.8)
  for (const [lx, lz, rot, y] of SLOTS[type] ?? []) {
    const [x, z] = toWorld(lx, lz)
    if (!taken(x, z)) return { pos: [x, m.pos[1] + MANSION_FLOOR + y, z], rotY: m.rotY + rot }
  }
  // slots full: anywhere free on the open-plan floor
  for (let i = 0; i < 40; i++) {
    const [x, z] = toWorld(-9 + r() * 12, -5 + r() * 9)
    if (!taken(x, z)) return { pos: [x, m.pos[1] + MANSION_FLOOR + (type === 'chandelier' ? 3.55 : 0), z], rotY: m.rotY + Math.floor(r() * 4) * (Math.PI / 2) }
  }
  return null
}
