import { DECK_Y, type World, bridgeEnds, hasRiver, riverX, terrainHeight } from './world'

// Causal layer: a tiny connectivity graph of the two river banks joined by intact bridges.
// The test cart follows whatever route this returns; destroying a bridge removes its edges.

export interface Route {
  ok: boolean
  via?: string
  reason: string
  waypoints: [number, number, number][]
  edges: [string, string][]
}

const START_Z = 4
const ROAD_D = 15

export function buildGraph(w: World) {
  const edges: [string, string][] = []
  for (const b of w.entities) {
    if (b.type !== 'bridge' || b.state !== 'intact') continue
    edges.push(['bank_w', b.id], [b.id, 'bank_e'])
  }
  return edges
}

/** Breadth-first search over the bank/bridge graph. */
export function findPath(edges: [string, string][], from: string, to: string): string[] | null {
  const adj = new Map<string, string[]>()
  for (const [a, b] of edges) {
    adj.set(a, [...(adj.get(a) ?? []), b])
    adj.set(b, [...(adj.get(b) ?? []), a])
  }
  const prev = new Map<string, string>([[from, '']])
  const q = [from]
  while (q.length) {
    const n = q.shift()!
    if (n === to) {
      const path = [to]
      while (prev.get(path[0])) path.unshift(prev.get(path[0])!)
      return path
    }
    for (const m of adj.get(n) ?? []) if (!prev.has(m)) { prev.set(m, n); q.push(m) }
  }
  return null
}

const ground = (x: number, z: number): [number, number, number] => [x, Math.max(0, terrainHeight(x, z)) + 0.05, z]

export function computeRoute(w: World): Route {
  const start = ground(riverX(START_Z) - ROAD_D, START_Z)
  const goal = ground(riverX(START_Z) + ROAD_D, START_Z)
  if (!hasRiver(w)) return { ok: true, reason: 'No river — open ground', waypoints: [start, goal], edges: [] }

  const edges = buildGraph(w)
  // BFS gives every reachable bridge; prefer the one closest to the cart's road position.
  const bridges = w.entities
    .filter((b) => b.type === 'bridge' && b.state === 'intact' && findPath(edges, 'bank_w', 'bank_e')?.includes(b.id))
    .sort((a, b) => Math.abs(a.pos[2] - START_Z) - Math.abs(b.pos[2] - START_Z))
  const bridge = bridges[0]
  if (!bridge) {
    const edge = ground(riverX(START_Z) - 8.5, START_Z)
    return { ok: false, reason: 'Route blocked — no intact crossing between banks', waypoints: [start, edge], edges }
  }
  let [a, b] = bridgeEnds(bridge)
  if (a[0] > b[0]) [a, b] = [b, a]
  const dir = [b[0] - a[0], b[1] - a[1]]
  const len = Math.hypot(dir[0], dir[1])
  const ux = dir[0] / len, uz = dir[1] / len
  const deck = DECK_Y + 0.35
  return {
    ok: true,
    via: bridge.id,
    reason: `Crossing via ${bridge.id} (${bridge.material ?? 'wood'}, ${len.toFixed(1)} m)`,
    waypoints: [
      start,
      ground(a[0] - ux * 5, a[1] - uz * 5),
      [a[0], deck, a[1]],
      [b[0], deck, b[1]],
      ground(b[0] + ux * 5, b[1] + uz * 5),
      goal,
    ],
    edges,
  }
}
