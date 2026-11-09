import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html, Instance, Instances } from '@react-three/drei'
import { CuboidCollider, RigidBody, type RapierRigidBody } from '@react-three/rapier'
import type { Color, Material } from '../compiler/schema'
import { useStudio } from '../store'
import { DECK_Y, type Entity, rng, riverSlope, riverX, terrainHeight, WATER_Y } from './world'
import type { Route } from './traversal'
import { footprint } from './spatial'

// ---------- shared materials (one instance each → cheap, and night glow is one uniform update) ----------
const std = (color: string, o: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...o })
export const SHARED = {
  window: std('#2b2520', { emissive: new THREE.Color('#ffae55'), emissiveIntensity: 0 }),
  lamp: std('#fff1c8', { emissive: new THREE.Color('#ffc46b'), emissiveIntensity: 0.2 }),
  door: std('#4a2f1e'),
  plinth: std('#8d806e', { roughness: 0.95 }),
  tile: std('#9a4a32'),
  thatch: std('#b39558', { roughness: 1 }),
  flat: std('#d6cbb5'),
  tank: std('#2c3640', { roughness: 0.5 }),
  trunk: std('#5a4130', { roughness: 1 }),
  rock: std('#7d776e', { roughness: 0.95, flatShading: true }),
  dirt: std('#8c7350', { roughness: 1 }),
  sand: std('#e8d7b0'),
  gold: std('#d8a73a', { metalness: 0.85, roughness: 0.3 }),
  saffron: std('#f08a24', { side: THREE.DoubleSide }),
  white: std('#f2efe6'),
  green: std('#2f8a3a'),
  blue: std('#3f67a8'),
  rope: std('#6b5338'),
  waterDark: std('#16343c', { roughness: 0.2 }),
  ring: new THREE.MeshBasicMaterial({ color: '#E8AB40', transparent: true, opacity: 0.85 }),
}

export const COLOR_HEX: Record<Color, string> = {
  red: '#b8392e', blue: '#3d68b0', green: '#4c8a3c', yellow: '#e2b93b', white: '#eeeae0', black: '#2a2a2c', orange: '#e27a2c',
  pink: '#de8fa0', brown: '#7a5434', purple: '#7a4fa0', saffron: '#f08a24', indigo: '#3a3f8f',
}
const MAT_LOOK: Record<Material, THREE.MeshStandardMaterialParameters> = {
  wood: { color: '#8a5a35', roughness: 0.85 },
  stone: { color: '#9c968c', roughness: 0.95 },
  steel: { color: '#6f7a85', metalness: 0.75, roughness: 0.35 },
  brick: { color: '#a4533a', roughness: 0.9 },
  mud: { color: '#9b7a55', roughness: 1 },
  glass: { color: '#a6d0e0', metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.55 },
  gold: { color: '#d4a73a', metalness: 0.9, roughness: 0.25 },
}
const matCache = new Map<string, THREE.MeshStandardMaterial>()
export function surface(material?: Material, color?: Color, fallback = '#d9a35b') {
  const key = `${material}|${color}|${fallback}`
  let m = matCache.get(key)
  if (!m) {
    m = std(fallback, material ? MAT_LOOK[material] : {})
    if (color) m.color.set(COLOR_HEX[color])
    matCache.set(key, m)
  }
  return m
}

// ---------- shared geometry ----------
const BOX = new THREE.BoxGeometry(1, 1, 1)
const CYL = new THREE.CylinderGeometry(1, 1, 1, 12)
const GABLE = (() => {
  const s = new THREE.Shape([new THREE.Vector2(-2.5, 0), new THREE.Vector2(2.5, 0), new THREE.Vector2(0, 1.6)])
  const g = new THREE.ExtrudeGeometry(s, { depth: 5, bevelEnabled: false })
  g.translate(0, 0, -2.5)
  return g
})()
const HIP = new THREE.ConeGeometry(4.3, 2.3, 4, 1)
HIP.rotateY(Math.PI / 4)

function B({ p, s, m, r, cast = true }: { p: [number, number, number]; s: [number, number, number]; m: THREE.Material; r?: [number, number, number]; cast?: boolean }) {
  return <mesh geometry={BOX} position={p} scale={s} rotation={r} material={m} castShadow={cast} receiveShadow />
}

// ---------- spawn animation ----------
function Pop({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const ref = useRef<THREE.Group>(null)
  const start = useRef(-1)
  const done = useRef(false)
  useFrame(({ clock }) => {
    if (done.current || !ref.current) return
    if (start.current < 0) start.current = clock.elapsedTime + delay
    const k = Math.min(1, Math.max(0, (clock.elapsedTime - start.current) / 0.55))
    const c = 1.70158
    const e = k === 0 ? 0.001 : 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2)
    ref.current.scale.setScalar(Math.max(0.001, e))
    if (k >= 1) done.current = true
  })
  return <group ref={ref} scale={0.001}>{children}</group>
}

// ---------- structures ----------
const WALLS = ['#d9a35b', '#c46a4a', '#ece4d4', '#5b7db3', '#8fbfa6', '#d98f8a', '#e0c27a']

function House({ e }: { e: Entity }) {
  const v = e.meta.variant ?? 0
  const wall = surface(e.material, e.color, WALLS[(e.meta.seed ?? 0) % WALLS.length])
  const h = v === 2 ? 2.6 : 3
  return (
    <group>
      <B p={[0, 0.2, 0]} s={[5.6, 0.4, 5.6]} m={SHARED.plinth} />
      <B p={[0, 0.4 + h / 2, 0]} s={[5, h, 5]} m={wall} />
      <B p={[0, 1.4, 2.52]} s={[1.1, 2, 0.08]} m={SHARED.door} cast={false} />
      <B p={[-1.6, 2, 2.52]} s={[0.8, 0.8, 0.06]} m={SHARED.window} cast={false} />
      <B p={[1.6, 2, 2.52]} s={[0.8, 0.8, 0.06]} m={SHARED.window} cast={false} />
      <B p={[2.52, 2, 0]} s={[0.06, 0.8, 0.8]} m={SHARED.window} cast={false} />
      {v === 0 && (
        <group position={[0, 0.4 + h, 0]}>
          <mesh geometry={GABLE} material={wall} castShadow />
          <B p={[0, 0.82, 1.35]} s={[5.6, 0.16, 3.25]} r={[0.56, 0, 0]} m={SHARED.tile} />
          <B p={[0, 0.82, -1.35]} s={[5.6, 0.16, 3.25]} r={[-0.56, 0, 0]} m={SHARED.tile} />
        </group>
      )}
      {v === 1 && (
        <group position={[0, 0.4 + h, 0]}>
          <B p={[0, 0.12, 0]} s={[5.3, 0.25, 5.3]} m={SHARED.flat} />
          <B p={[1.3, 1, -1.3]} s={[2, 1.8, 2]} m={wall} />
          <mesh geometry={CYL} position={[-1.4, 0.75, -1.4]} scale={[0.6, 1, 0.6]} material={SHARED.tank} castShadow />
        </group>
      )}
      {(v === 2 || v === 3) && (
        <group position={[0, 0.4 + h + 1.1, 0]}>
          <mesh geometry={HIP} material={v === 2 ? SHARED.thatch : SHARED.tile} castShadow />
        </group>
      )}
      {v === 3 && (
        <group>
          <B p={[0, 2.75, 3.4]} s={[5.6, 0.15, 1.9]} m={SHARED.tile} />
          <B p={[-2.5, 1.5, 4.2]} s={[0.18, 2.4, 0.18]} m={SHARED.door} />
          <B p={[2.5, 1.5, 4.2]} s={[0.18, 2.4, 0.18]} m={SHARED.door} />
        </group>
      )}
    </group>
  )
}

function Temple({ e }: { e: Entity }) {
  const stone = surface(e.material, e.color, '#e8d7b0')
  return (
    <group>
      <B p={[0, 0.25, 0]} s={[9, 0.5, 9]} m={SHARED.plinth} />
      <B p={[0, 0.7, 0]} s={[7.5, 0.4, 7.5]} m={SHARED.plinth} />
      <B p={[0, 2.2, 0]} s={[4.6, 2.6, 4.6]} m={stone} />
      <B p={[0, 1.9, 3.1]} s={[3.4, 2, 1.8]} m={stone} />
      <B p={[0, 1.6, 4.05]} s={[1.1, 1.6, 0.08]} m={SHARED.door} cast={false} />
      <mesh position={[0, 6.4, 0]} scale={[2.3, 6, 2.3]} castShadow material={stone}><coneGeometry args={[1, 1, 8, 4]} /></mesh>
      <mesh position={[0, 9.5, 0]} material={SHARED.gold}><sphereGeometry args={[0.35, 16, 12]} /></mesh>
      <B p={[0, 10.6, 0]} s={[0.05, 2, 0.05]} m={SHARED.rope} />
      <mesh position={[0.45, 11.3, 0]} material={SHARED.saffron}><planeGeometry args={[0.9, 0.55]} /></mesh>
    </group>
  )
}

function School({ e }: { e: Entity }) {
  const wall = surface(e.material, e.color, '#f1ead8')
  return (
    <group>
      <B p={[0, 0.2, 0]} s={[12.6, 0.4, 5.6]} m={SHARED.plinth} />
      <B p={[0, 2.1, 0]} s={[12, 3.4, 5]} m={wall} />
      <B p={[0, 1, 0]} s={[12.05, 0.6, 5.05]} m={SHARED.blue} />
      <B p={[0, 3.95, 0]} s={[12.6, 0.3, 5.6]} m={SHARED.flat} />
      {[-4.5, -2.25, 2.25, 4.5].map((x) => <B key={x} p={[x, 2.4, 2.52]} s={[1.2, 1, 0.06]} m={SHARED.window} cast={false} />)}
      <B p={[0, 1.6, 2.52]} s={[1.4, 2.2, 0.08]} m={SHARED.door} cast={false} />
      <B p={[7.5, 3, 2.5]} s={[0.08, 6, 0.08]} m={SHARED.white} />
      <B p={[8.1, 5.6, 2.5]} s={[1.2, 0.25, 0.04]} m={SHARED.saffron} />
      <B p={[8.1, 5.35, 2.5]} s={[1.2, 0.25, 0.04]} m={SHARED.white} />
      <B p={[8.1, 5.1, 2.5]} s={[1.2, 0.25, 0.04]} m={SHARED.green} />
    </group>
  )
}

function Well({ e }: { e: Entity }) {
  const stone = surface(e.material, e.color, '#a49d90')
  return (
    <group>
      <mesh geometry={CYL} position={[0, 0.45, 0]} scale={[1.3, 0.9, 1.3]} material={stone} castShadow receiveShadow />
      <mesh geometry={CYL} position={[0, 0.88, 0]} scale={[1.05, 0.05, 1.05]} material={SHARED.waterDark} />
      <B p={[-1.1, 1.5, 0]} s={[0.15, 2, 0.15]} m={SHARED.door} />
      <B p={[1.1, 1.5, 0]} s={[0.15, 2, 0.15]} m={SHARED.door} />
      <B p={[0, 2.45, 0]} s={[2.5, 0.15, 0.15]} m={SHARED.door} />
      <B p={[0, 1.85, 0]} s={[0.03, 1.2, 0.03]} m={SHARED.rope} />
      <mesh geometry={CYL} position={[0, 1.2, 0]} scale={[0.22, 0.3, 0.22]} material={SHARED.gold} />
    </group>
  )
}

function Lamp() {
  return (
    <group>
      <mesh geometry={CYL} position={[0, 2, 0]} scale={[0.07, 4, 0.07]} material={SHARED.tank} castShadow />
      <B p={[0.35, 3.95, 0]} s={[0.8, 0.06, 0.06]} m={SHARED.tank} />
      <mesh position={[0.7, 3.8, 0]} material={SHARED.lamp}><sphereGeometry args={[0.2, 12, 8]} /></mesh>
    </group>
  )
}

// ---------- bridge (intact) ----------
function bridgeDims(e: Entity) {
  return { L: e.meta.span ?? 18, W: e.meta.width ?? 3.6, vs: Math.min(1.6, Math.max(0.7, e.scale)) }
}

function Bridge({ e }: { e: Entity }) {
  const { L, W, vs } = bridgeDims(e)
  const m = surface(e.material ?? 'wood', e.color, '#8a5a35')
  const kind = e.material === 'stone' || e.material === 'brick' ? 'stone' : e.material === 'steel' || e.material === 'gold' ? 'steel' : 'wood'
  const planks = Math.floor(L / 0.55)
  const posts = Math.floor(L / 1.6)
  return (
    <group>
      {kind === 'wood' && (
        <>
          <Instances limit={planks} geometry={BOX} material={m} castShadow receiveShadow>
            {Array.from({ length: planks }, (_, i) => (
              <Instance key={i} position={[-L / 2 + 0.28 + i * 0.55, 0, 0]} scale={[0.48, 0.12, W]} rotation={[0, 0, ((i * 7919) % 5 - 2) * 0.01]} />
            ))}
          </Instances>
          <B p={[0, -0.2, W / 2 - 0.2]} s={[L, 0.25, 0.25]} m={m} />
          <B p={[0, -0.2, -W / 2 + 0.2]} s={[L, 0.25, 0.25]} m={m} />
          {[-1, 1].map((side) => (
            <group key={side} position={[0, 0, (side * W) / 2]} scale={[1, vs, 1]}>
              <B p={[0, 1.0, 0]} s={[L, 0.1, 0.1]} m={m} />
              <B p={[0, 0.55, 0]} s={[L, 0.07, 0.07]} m={m} />
              {Array.from({ length: posts + 1 }, (_, i) => <B key={i} p={[-L / 2 + (i * L) / posts, 0.5, 0]} s={[0.12, 1.1, 0.12]} m={m} />)}
            </group>
          ))}
          {[-L / 6, L / 6].map((x) => [-1, 1].map((s) => <B key={`${x}${s}`} p={[x, -1.8, (s * W) / 2.4]} s={[0.25, 3.4, 0.25]} m={m} />))}
        </>
      )}
      {kind === 'stone' && (
        <>
          <B p={[0, -0.05, 0]} s={[L, 0.5, W + 0.4]} m={m} />
          <group scale={[1, vs, 1]}>
            <B p={[0, 0.45, W / 2 + 0.05]} s={[L, 0.6, 0.35]} m={m} />
            <B p={[0, 0.45, -W / 2 - 0.05]} s={[L, 0.6, 0.35]} m={m} />
          </group>
          {[-L / 6, L / 6].map((x) => <B key={x} p={[x, -1.9, 0]} s={[1.4, 3.3, W + 0.4]} m={m} />)}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[0, -0.3, (s * (W + 0.4)) / 2]} rotation={[0, 0, Math.PI]} material={m} castShadow>
              <torusGeometry args={[L / 6 - 0.6, 0.45, 6, 18, Math.PI]} />
            </mesh>
          ))}
        </>
      )}
      {kind === 'steel' && (
        <>
          <B p={[0, 0, 0]} s={[L, 0.3, W]} m={SHARED.tank} />
          {[-1, 1].map((side) => (
            <group key={side} position={[0, 0, (side * W) / 2]} scale={[1, vs, 1]}>
              <B p={[0, 2.4, 0]} s={[L * 0.86, 0.22, 0.22]} m={m} />
              <B p={[0, 0.2, 0]} s={[L, 0.22, 0.22]} m={m} />
              {Array.from({ length: 7 }, (_, i) => {
                const x = -L * 0.43 + (i * L * 0.86) / 6
                return (
                  <group key={i}>
                    <B p={[x, 1.3, 0]} s={[0.18, 2.2, 0.18]} m={m} />
                    {i < 6 && <B p={[x + (L * 0.86) / 12, 1.3, 0]} s={[0.12, Math.hypot(2.2, (L * 0.86) / 6), 0.12]} r={[0, 0, Math.atan2((L * 0.86) / 6, 2.2) * (i % 2 ? 1 : -1)]} m={m} />}
                  </group>
                )
              })}
            </group>
          ))}
        </>
      )}
      {/* dirt approaches onto each bank */}
      {[-1, 1].map((s) => <B key={s} p={[s * (L / 2 + 3), -DECK_Y + 0.06, 0]} s={[6, 0.08, W]} m={SHARED.dirt} cast={false} />)}
    </group>
  )
}

// ---------- debris: the destroyed bridge as real rigid bodies ----------
function Debris({ e }: { e: Entity }) {
  const { L, W } = bridgeDims(e)
  const m = surface(e.material ?? 'wood', e.color, '#8a5a35')
  const floats = !e.material || e.material === 'wood'
  const pieces = useMemo(() => {
    const r = rng((e.meta.seed ?? 1) * 13 + e.gen)
    const n = floats ? Math.max(8, Math.round(L / 1.6)) : Math.max(6, Math.round(L / 2.4))
    const c = Math.cos(e.rotY), s = Math.sin(e.rotY)
    return Array.from({ length: n * (floats ? 1 : 2) }, (_, i) => {
      const k = i % n
      const lane = floats ? 0 : i < n ? -W / 4 : W / 4
      const lx = -L / 2 + (k + 0.5) * (L / n)
      const size: [number, number, number] = floats ? [L / n - 0.08, 0.14, W] : [L / n - 0.05, 0.5, W / 2 - 0.05]
      return {
        pos: [e.pos[0] + c * lx + s * lane, e.pos[1], e.pos[2] - s * lx + c * lane] as [number, number, number],
        size,
        vel: [(r() - 0.5) * 1.5, -0.5 - r() * 1.5, (r() - 0.5) * 1.5] as [number, number, number],
        ang: [(r() - 0.5) * 3, (r() - 0.5) * 2, (r() - 0.5) * 3] as [number, number, number],
      }
    })
  }, [e, L, W, floats])
  const bodies = useRef<(RapierRigidBody | null)[]>([])
  const born = useRef(0)
  useFrame(({ clock }, dt) => {
    born.current ||= clock.elapsedTime
    if (!floats) return
    const age = clock.elapsedTime - born.current
    for (const b of bodies.current) {
      if (!b) continue
      const p = b.translation()
      const depth = WATER_Y + 0.08 - p.y
      if (depth > 0) {
        // crude buoyancy + river drag: wood planks float and drift downstream
        const mass = b.mass()
        const flow = age < 45 ? 1.2 : 0
        const v = b.linvel()
        b.applyImpulse({ x: (riverSlope(p.z) * flow - v.x) * mass * dt * 1.5, y: (Math.min(depth, 0.4) * 30 - v.y * 2) * mass * dt, z: (flow - v.z) * mass * dt * 1.5 }, true)
      }
    }
  })
  return (
    <group>
      {pieces.map((p, i) => (
        <RigidBody key={i} ref={(b) => { bodies.current[i] = b }} position={p.pos} rotation={[0, e.rotY, 0]} linearVelocity={p.vel} angularVelocity={p.ang} colliders={false} angularDamping={0.4} linearDamping={0.1} density={floats ? 0.6 : 2.4}>
          <CuboidCollider args={[p.size[0] / 2, p.size[1] / 2, p.size[2] / 2]} />
          <mesh geometry={BOX} scale={p.size} material={m} castShadow receiveShadow />
        </RigidBody>
      ))}
    </group>
  )
}

// ---------- trees (instanced) ----------
const CANOPY = new THREE.IcosahedronGeometry(1, 1)
const LEAF = ['#3f6b2c', '#4f7d33', '#5c8a3a', '#355f2a', '#6b8f3e']
function Trees({ trees, onSelect }: { trees: Entity[]; onSelect: (id: string) => void }) {
  const groups = [0, 1, 2].map((v) => trees.filter((t) => (t.meta.variant ?? 0) % 3 === v))
  const dims = [
    { th: 2.6, tr: 0.22, cy: 3.8, cs: [2.3, 1.8, 2.3] },
    { th: 5.4, tr: 0.16, cy: 5.7, cs: [2.6, 0.75, 2.6] },
    { th: 2.0, tr: 0.3, cy: 3.6, cs: [3.1, 2.3, 3.1] },
  ]
  return (
    <>
      {groups.map((list, v) => !!list.length && (
        <group key={v}>
          <Instances limit={Math.max(1, list.length)} geometry={CYL} material={SHARED.trunk} castShadow>
            {list.map((t) => <Instance key={t.id} position={[t.pos[0], t.pos[1] + (dims[v].th * t.scale) / 2, t.pos[2]]} scale={[dims[v].tr * t.scale, dims[v].th * t.scale, dims[v].tr * t.scale]} />)}
          </Instances>
          <Instances limit={Math.max(1, list.length)} geometry={CANOPY} castShadow receiveShadow>
            <meshStandardMaterial roughness={0.9} flatShading />
            {list.map((t) => (
              <Instance key={t.id} position={[t.pos[0], t.pos[1] + dims[v].cy * t.scale, t.pos[2]]} rotation={[0, t.rotY, 0]}
                scale={dims[v].cs.map((s) => s * t.scale) as [number, number, number]}
                color={t.color ? COLOR_HEX[t.color] : LEAF[(t.meta.seed ?? 0) % LEAF.length]}
                onClick={(ev) => { ev.stopPropagation(); onSelect(t.id) }} />
            ))}
          </Instances>
        </group>
      ))}
    </>
  )
}

// ---------- rocks: dynamic bodies that react to forces ----------
const ROCK = new THREE.DodecahedronGeometry(0.8, 0)
function Rocks({ rocks, onSelect }: { rocks: Entity[]; onSelect: (id: string) => void }) {
  const refs = useRef(new Map<string, RapierRigidBody>())
  const force = useStudio((s) => s.force)
  useEffect(() => {
    if (!force.seq) return
    const r = rng(force.seq)
    for (const [id, b] of refs.current) {
      if (!force.ids.includes(id)) continue
      const m = b.mass()
      b.applyImpulse({ x: (r() - 0.5) * force.strength * m * 2, y: force.strength * m * 1.2, z: (r() - 0.5) * force.strength * m * 2 }, true)
      b.applyTorqueImpulse({ x: r() * m, y: r() * m, z: r() * m }, true)
    }
  }, [force])
  return (
    <>
      {rocks.map((e) => (
        <RigidBody key={e.id} ref={(b) => { if (b) refs.current.set(e.id, b); else refs.current.delete(e.id) }} position={e.pos} rotation={[0.3, e.rotY, 0.2]} colliders="hull" density={2.6}>
          <mesh geometry={ROCK} scale={[e.scale * 1.2, e.scale * 0.75, e.scale]} material={e.color ? surface(undefined, e.color) : SHARED.rock} castShadow receiveShadow
            onClick={(ev) => { ev.stopPropagation(); onSelect(e.id) }} />
        </RigidBody>
      ))}
    </>
  )
}

// ---------- roads ----------
function Road({ e }: { e: Entity }) {
  const geo = useMemo(() => {
    const pts = e.meta.points ?? []
    const dense: [number, number][] = []
    for (let i = 0; i < pts.length - 1; i++) for (let t = 0; t < 1; t += 0.25) dense.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t])
    const v: number[] = [], idx: number[] = []
    dense.forEach(([x, z], i) => {
      const [nx, nz] = dense[Math.min(i + 1, dense.length - 1)]
      const [px, pz] = dense[Math.max(i - 1, 0)]
      const dx = nx - px, dz = nz - pz, l = Math.hypot(dx, dz) || 1
      const ox = (-dz / l) * 1.6, oz = (dx / l) * 1.6
      for (const s of [-1, 1]) v.push(x + ox * s, Math.max(0, terrainHeight(x + ox * s, z + oz * s)) + 0.04, z + oz * s)
      if (i < dense.length - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2) }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [e])
  return <mesh geometry={geo} material={SHARED.dirt} receiveShadow />
}

// ---------- traversal agent: bullock cart ----------
function CartModel() {
  return (
    <group>
      <B p={[0, 0.95, -0.6]} s={[1.5, 0.18, 2.2]} m={SHARED.door} />
      <B p={[0, 1.25, -1.7]} s={[1.5, 0.5, 0.08]} m={SHARED.door} />
      {[-0.85, 0.85].map((x) => (
        <mesh key={x} position={[x, 0.6, -0.6]} rotation={[0, 0, Math.PI / 2]} material={SHARED.trunk} castShadow>
          <torusGeometry args={[0.55, 0.07, 6, 14]} />
        </mesh>
      ))}
      <B p={[0, 0.9, 1]} s={[0.12, 0.12, 1.6]} m={SHARED.door} />
      <group position={[0, 0, 2.2]}>
        <B p={[0, 1.2, 0]} s={[0.7, 0.8, 1.6]} m={SHARED.white} />
        <B p={[0, 1.45, 0.95]} s={[0.4, 0.45, 0.5]} m={SHARED.white} />
        <B p={[0.18, 1.8, 0.95]} s={[0.06, 0.3, 0.06]} m={SHARED.door} r={[0, 0, -0.4]} />
        <B p={[-0.18, 1.8, 0.95]} s={[0.06, 0.3, 0.06]} m={SHARED.door} r={[0, 0, 0.4]} />
        {[[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]].map(([x, z]) => <B key={`${x}${z}`} p={[x, 0.45, z]} s={[0.14, 0.9, 0.14]} m={SHARED.white} />)}
      </group>
    </group>
  )
}

function Cart({ route }: { route: Route }) {
  const body = useRef<RapierRigidBody>(null)
  const label = useRef<HTMLDivElement>(null)
  const st = useRef({ path: route.waypoints, i: 0, pos: new THREE.Vector3(...route.waypoints[0]), heading: 0, falling: 0 })
  const [falling, setFalling] = useState(false)

  useEffect(() => {
    const s = st.current
    const onDeck = s.pos.y > DECK_Y + 0.1 && Math.abs(s.pos.x - riverX(s.pos.z)) < 8.5
    if (onDeck && !route.ok) { setFalling(true); s.falling = 1; return }
    const west = s.pos.x < riverX(s.pos.z)
    if (!route.ok) {
      const z = s.pos.z, x = riverX(z) + (west ? -8.5 : 8.5)
      s.path = [[s.pos.x, s.pos.y, s.pos.z], [x, Math.max(0, terrainHeight(x, z)) + 0.05, z]]
    } else {
      const w = west ? route.waypoints : [...route.waypoints].reverse()
      s.path = [[s.pos.x, s.pos.y, s.pos.z], ...w.slice(1)]
    }
    s.i = 0
  }, [route])

  useFrame(({ clock }, dt) => {
    const s = st.current
    const b = body.current
    if (!b) return
    if (s.falling) {
      s.falling += dt
      if (s.falling > 6) {
        s.falling = 0
        s.pos.set(...route.waypoints[0])
        s.path = route.ok ? route.waypoints : [route.waypoints[0], route.waypoints[1]]
        s.i = 0
        setFalling(false)
      }
      return
    }
    const target = s.path[s.i + 1]
    if (!target) {
      if (route.ok) { s.path = [...s.path].reverse(); s.i = 0 }
    } else {
      const to = new THREE.Vector3(...target)
      const d = to.clone().sub(s.pos)
      const step = 5 * Math.min(dt, 0.05)
      if (d.length() <= step) { s.pos.copy(to); s.i++ } else s.pos.add(d.setLength(step))
      const onDeck = s.i >= 1 && s.path[s.i][1] > DECK_Y && target[1] > DECK_Y
      if (!onDeck) s.pos.y = Math.max(0, terrainHeight(s.pos.x, s.pos.z)) + 0.05
      const want = Math.atan2(to.x - s.pos.x, to.z - s.pos.z)
      let diff = want - s.heading
      diff = Math.atan2(Math.sin(diff), Math.cos(diff))
      s.heading += diff * Math.min(1, dt * 6)
    }
    b.setNextKinematicTranslation(s.pos)
    b.setNextKinematicRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, s.heading, 0)))
    if (label.current) label.current.style.opacity = String(0.75 + 0.25 * Math.sin(clock.elapsedTime * 3))
  })

  return (
    <RigidBody ref={body} type={falling ? 'dynamic' : 'kinematicPosition'} colliders={false} position={route.waypoints[0]}>
      <CuboidCollider args={[0.8, 0.6, 1.8]} position={[0, 1, 0.3]} />
      <CartModel />
      <Html position={[0, 3.4, 0]} center distanceFactor={40} zIndexRange={[10, 0]}>
        <div ref={label} className={`cart-tag ${route.ok ? 'ok' : 'bad'}`}>{falling ? 'Fell with the bridge' : route.ok ? 'Route open' : 'Route blocked'}</div>
      </Html>
    </RigidBody>
  )
}

// ---------- entity dispatch ----------
const Structure = memo(function Structure({ e, selected, onSelect, delay }: { e: Entity; selected: boolean; onSelect: (id: string) => void; delay: number }) {
  const inner = e.type === 'house' ? <House e={e} /> : e.type === 'temple' ? <Temple e={e} /> : e.type === 'school' ? <School e={e} /> : e.type === 'well' ? <Well e={e} /> : e.type === 'lamp' ? <Lamp /> : <B p={[0, 1, 0]} s={[2, 2, 2]} m={surface(e.material, e.color)} />
  const fp = footprint(e.type)
  const half: [number, number, number] = e.type === 'school' ? [6.3, 2, 2.8] : e.type === 'temple' ? [4.5, 3, 4.5] : e.type === 'lamp' ? [0.2, 2, 0.2] : [fp / 2.3, 1.8, fp / 2.3]
  return (
    <RigidBody type="fixed" colliders={false} position={e.pos} rotation={[0, e.rotY, 0]}>
      <CuboidCollider args={half} position={[0, half[1], 0]} />
      <group scale={e.scale} onClick={(ev) => { ev.stopPropagation(); onSelect(e.id) }}>
        <Pop delay={delay}>{inner}</Pop>
      </group>
      {selected && <SelectRing r={fp * 0.75 * e.scale} />}
    </RigidBody>
  )
})

function SelectRing({ r }: { r: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => ref.current?.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.04))
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} material={SHARED.ring}>
      <ringGeometry args={[r, r + 0.25, 48]} />
    </mesh>
  )
}

export function WorldEntities({ entities, selectedId, route }: { entities: Entity[]; selectedId: string | null; route: Route }) {
  const select = useStudio((s) => s.select)
  const trees = useMemo(() => entities.filter((e) => e.type === 'tree'), [entities])
  const rocks = useMemo(() => entities.filter((e) => e.type === 'rock'), [entities])
  let n = 0
  return (
    <group>
      {entities.map((e) => {
        if (e.type === 'tree' || e.type === 'rock' || e.type === 'river' || e.type === 'cart') return null
        if (e.type === 'road') return <Road key={e.id} e={e} />
        if (e.type === 'bridge') {
          return e.state === 'intact' ? (
            <RigidBody key={`${e.id}-ok`} type="fixed" colliders={false} position={e.pos} rotation={[0, e.rotY, 0]}>
              <CuboidCollider args={[(e.meta.span ?? 18) / 2, 0.15, (e.meta.width ?? 3.6) / 2]} />
              <group onClick={(ev) => { ev.stopPropagation(); select(e.id) }}><Pop><Bridge e={e} /></Pop></group>
              {selectedId === e.id && <SelectRing r={(e.meta.span ?? 18) / 2} />}
            </RigidBody>
          ) : <Debris key={`${e.id}-${e.gen}`} e={e} />
        }
        return <Structure key={e.id} e={e} selected={selectedId === e.id} onSelect={select} delay={Math.min(1.2, n++ * 0.03)} />
      })}
      <Trees trees={trees} onSelect={select} />
      <Rocks rocks={rocks} onSelect={select} />
      {entities.some((e) => e.type === 'river') && <Cart route={route} />}
    </group>
  )
}
