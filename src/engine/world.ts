import type { Color, Material, ObjectType } from '../compiler/schema'

export type Vec3 = [number, number, number]

export interface Entity {
  id: string
  type: ObjectType
  pos: Vec3
  rotY: number
  scale: number
  material?: Material
  color?: Color
  /** bridges: intact | destroyed. Others always intact. */
  state: 'intact' | 'destroyed'
  /** bumps every destruction so the debris simulation re-spawns deterministically */
  gen: number
  /** type-specific numbers: bridge span/width, house variant, road points … */
  meta: { span?: number; width?: number; variant?: number; seed?: number; points?: [number, number][] }
}

export type TimeOfDay = 'dawn' | 'morning' | 'noon' | 'sunset' | 'night'
export type Weather = 'clear' | 'rain' | 'fog' | 'storm'

export interface World {
  version: 1
  seed: number
  template: 'blank' | 'village'
  entities: Entity[]
  counters: Partial<Record<ObjectType, number>>
  /** most-recently touched entity ids, newest last — drives "it"/"that" resolution */
  recent: string[]
  env: { time: TimeOfDay; weather: Weather; lighting: 'soft' | 'cinematic' | 'dramatic' }
}

export const emptyWorld = (seed = 7): World => ({
  version: 1,
  seed,
  template: 'blank',
  entities: [],
  counters: {},
  recent: [],
  env: { time: 'morning', weather: 'clear', lighting: 'cinematic' },
})

// ---------- deterministic randomness ----------
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- terrain & river geometry (shared by renderer, physics and solver) ----------
export const WORLD_SIZE = 180
export const WATER_Y = -0.9
export const BANK_D = 8 // distance from river centre where the bank top is reached
export const DECK_Y = 0.55

export const riverX = (z: number) => 5 * Math.sin(z * 0.04) + 2 * Math.sin(z * 0.11 + 1)
export const riverSlope = (z: number) => 0.2 * Math.cos(z * 0.04) + 0.22 * Math.cos(z * 0.11 + 1)

const smooth = (e0: number, e1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise(x: number, z: number) {
  const xi = Math.floor(x), zi = Math.floor(z)
  const xf = x - xi, zf = z - zi
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}

export function terrainHeight(x: number, z: number): number {
  const d = Math.abs(x - riverX(z))
  const channel = -2.6 * (1 - smooth(4.5, BANK_D, d))
  const hills = smooth(30, 75, d) * 9 * noise(x * 0.035 + 3, z * 0.035)
  const ripple = 0.35 * (noise(x * 0.12, z * 0.12) - 0.5) * smooth(BANK_D, BANK_D + 6, d)
  return channel + hills + ripple
}

/** distance from the river centre line, signed: negative = west bank, positive = east bank */
export const riverOffset = (x: number, z: number) => x - riverX(z)

export function hasRiver(w: World) {
  return w.entities.some((e) => e.type === 'river')
}

export function bridgeEnds(b: Entity): [[number, number], [number, number]] {
  const half = (b.meta.span ?? 18) / 2
  const c = Math.cos(b.rotY), s = Math.sin(b.rotY)
  // local +x maps to (cos θ, -sin θ) in (x, z)
  return [
    [b.pos[0] - c * half, b.pos[2] + s * half],
    [b.pos[0] + c * half, b.pos[2] - s * half],
  ]
}
