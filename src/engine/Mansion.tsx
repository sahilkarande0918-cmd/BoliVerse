import { useMemo } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Color } from '../compiler/schema'
import { B, BOX, COLOR_HEX, SHARED, surface } from './Entities'
import { MANSION_FLOOR as F, footprint } from './spatial'
import { TEX } from './textures'
import { type Entity, rng } from './world'
import { FURNITURE } from './library'
import { ScannedOr } from './Props'

// Luxury mansion: open-plan glass pavilion. The living/dining ceiling is a downward-facing plane,
// so it is opaque from inside but aerial cameras look straight into the furnished interior.

const M = {
  marble: new THREE.MeshStandardMaterial({ color: '#ece7df', roughness: 0.25, metalness: 0.05, map: TEX.stone }),
  render: new THREE.MeshStandardMaterial({ color: '#f1eee8', roughness: 0.9, map: TEX.plaster }),
  clad: new THREE.MeshStandardMaterial({ color: '#7a5236', roughness: 0.7, map: TEX.wood }),
  dark: new THREE.MeshStandardMaterial({ color: '#1f2328', roughness: 0.5, metalness: 0.4 }),
  glass: new THREE.MeshStandardMaterial({ color: '#a9c6d6', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.22, depthWrite: false }),
  ceiling: new THREE.MeshStandardMaterial({ color: '#f4f1ec', roughness: 0.95 }),
  pool: new THREE.MeshStandardMaterial({ color: '#2aa3c4', roughness: 0.04, metalness: 0.1, emissive: new THREE.Color('#0b5a6e'), emissiveIntensity: 0.35 }),
  deck: new THREE.MeshStandardMaterial({ color: '#9a6a44', roughness: 0.8, map: TEX.wood }),
  white: new THREE.MeshStandardMaterial({ color: '#f5f3ef', roughness: 0.6 }),
  leaf: new THREE.MeshStandardMaterial({ color: '#3f6a34', roughness: 0.9, flatShading: true }),
  pot: new THREE.MeshStandardMaterial({ color: '#b4673f', roughness: 0.9 }),
}
const ART = {
  saffron: new THREE.MeshStandardMaterial({ color: '#d9822b', roughness: 0.8 }),
  indigo: new THREE.MeshStandardMaterial({ color: '#2f3f7a', roughness: 0.8 }),
  cream: new THREE.MeshStandardMaterial({ color: '#efe3c8', roughness: 0.8 }),
}
const fabricCache = new Map<string, THREE.MeshStandardMaterial>()
const fabric = (c: Color | undefined, fallback: string) => {
  const key = c ?? fallback
  let m = fabricCache.get(key)
  if (!m) { m = new THREE.MeshStandardMaterial({ color: c ? COLOR_HEX[c] : fallback, roughness: 0.95 }); fabricCache.set(key, m) }
  return m
}
const CYL = new THREE.CylinderGeometry(1, 1, 1, 16)
const BLOB = new THREE.IcosahedronGeometry(1, 1)

export function Mansion({ e }: { e: Entity }) {
  const walls = e.color || e.material ? surface(e.material, e.color, '#f1eee8') : M.render
  return (
    <group>
      {/* plinth + terrace */}
      <B p={[0, F - 1.6, 1]} s={[24, 3.2, 18]} m={SHARED.plinth} />
      <B p={[0, F + 0.03, -1]} s={[20, 0.06, 12]} m={M.marble} cast={false} />
      {/* shell */}
      <B p={[0, F + 2, -7.15]} s={[20.6, 4, 0.3]} m={walls} />
      <B p={[-10.15, F + 2, -1]} s={[0.3, 4, 12.6]} m={walls} />
      <B p={[10.15, F + 2, -1]} s={[0.3, 4, 12.6]} m={M.clad} />
      <B p={[5.6, F + 1.5, 2.6]} s={[0.15, 3, 4.6]} m={walls} />
      <B p={[0, F + 1.95, 5]} s={[20, 3.9, 0.06]} m={M.glass} cast={false} />
      {Array.from({ length: 9 }, (_, i) => <B key={i} p={[-10 + i * 2.5, F + 1.95, 5.02]} s={[0.07, 3.9, 0.1]} m={M.dark} />)}
      <mesh position={[0, F + 3.98, -1]} rotation={[Math.PI / 2, 0, 0]} material={M.ceiling}><planeGeometry args={[20.6, 12.6]} /></mesh>
      <B p={[0, F + 4.15, 5.25]} s={[21.4, 0.45, 0.5]} m={M.dark} />
      <B p={[0, F + 3.88, 5.15]} s={[19.6, 0.05, 0.1]} m={SHARED.window} cast={false} />
      {/* warm interior lighting (no shadows) so the furnished rooms read at night */}
      <pointLight position={[-5, F + 3.4, -1]} intensity={22} distance={16} decay={2} color="#ffd6a0" />
      <pointLight position={[3.5, F + 3.4, 1]} intensity={18} distance={14} decay={2} color="#ffd6a0" />
      {/* living-room feature wall: wood panel, framed artwork, floor lamp */}
      <B p={[-5.6, F + 1.9, -6.96]} s={[8.4, 3.6, 0.06]} m={M.clad} cast={false} />
      <B p={[-5.6, F + 2.2, -6.9]} s={[2.9, 1.7, 0.05]} m={M.dark} cast={false} />
      <B p={[-6.3, F + 2.2, -6.86]} s={[1.3, 1.5, 0.03]} m={ART.saffron} cast={false} />
      <B p={[-4.95, F + 2.45, -6.86]} s={[1.2, 0.95, 0.03]} m={ART.indigo} cast={false} />
      <B p={[-4.95, F + 1.7, -6.86]} s={[1.2, 0.45, 0.03]} m={ART.cream} cast={false} />
      <mesh geometry={CYL} position={[-9.2, F + 0.8, -5.6]} scale={[0.03, 1.6, 0.03]} material={M.dark} />
      <mesh geometry={CYL} position={[-9.2, F + 1.65, -5.6]} scale={[0.28, 0.32, 0.28]} material={SHARED.lamp} />
      {/* kitchen pendants + bedroom wall light */}
      {[4.9, 6.2, 7.5].map((x) => (
        <group key={x} position={[x, F + 2.75, -4.4]}>
          <mesh geometry={CYL} position={[0, 0.6, 0]} scale={[0.012, 1.2, 0.012]} material={M.dark} />
          <mesh material={SHARED.lamp}><sphereGeometry args={[0.13, 12, 10]} /></mesh>
        </group>
      ))}
      <B p={[10, F + 2.3, 2]} s={[0.05, 0.12, 2.4]} m={SHARED.lamp} cast={false} />
      {/* kitchen under the upper floor */}
      <B p={[6.2, F + 0.48, -4.4]} s={[3.6, 0.95, 1.1]} m={M.white} />
      <B p={[6.2, F + 0.97, -4.4]} s={[3.7, 0.05, 1.2]} m={M.dark} />
      <B p={[6.2, F + 0.5, -6.6]} s={[7, 1, 0.7]} m={M.clad} />
      {/* upper floor volume over the back strip */}
      <B p={[5.25, F + 4.15, -4.45]} s={[10.6, 0.3, 6]} m={M.dark} />
      <B p={[5.25, F + 5.9, -4.45]} s={[10.5, 3.2, 5.9]} m={M.clad} />
      <B p={[5.25, F + 5.9, -1.47]} s={[10.2, 1.7, 0.05]} m={SHARED.window} cast={false} />
      <B p={[5.25, F + 7.6, -4.45]} s={[11.4, 0.28, 6.8]} m={M.render} />
      {/* pool + deck */}
      <B p={[-5, F - 0.18, 7.6]} s={[9, 0.06, 3.8]} m={M.pool} cast={false} />
      <B p={[-5, F + 0.02, 5.6]} s={[9.6, 0.1, 0.3]} m={M.white} cast={false} />
      <B p={[-5, F + 0.02, 9.6]} s={[9.6, 0.1, 0.3]} m={M.white} cast={false} />
      <B p={[5.5, F + 0.03, 7.5]} s={[10, 0.06, 4.6]} m={M.deck} cast={false} />
      {[3.5, 6.5].map((x) => (
        <group key={x} position={[x, F + 0.06, 7.8]}>
          <B p={[0, 0.25, 0]} s={[0.8, 0.12, 1.9]} m={M.white} />
          <B p={[0, 0.55, -0.85]} s={[0.8, 0.5, 0.1]} m={M.white} r={[-0.5, 0, 0]} />
        </group>
      ))}
    </group>
  )
}

/** Built-in furniture renders as real CC0 scans (Poly Haven); the procedural piece shows while it streams. */
export function InteriorItem({ e }: { e: Entity }) {
  const scan = FURNITURE[e.type]
  if (!scan || e.color) return <ProceduralItem e={e} />
  const hanging = e.type === 'chandelier'
  return <group position={[0, hanging ? 0.43 : 0, 0]}><ScannedOr id={scan} align={hanging ? 'top' : 'base'}><group position={[0, hanging ? -0.43 : 0, 0]}><ProceduralItem e={e} /></group></ScannedOr></group>
}

function ProceduralItem({ e }: { e: Entity }) {
  switch (e.type) {
    case 'sofa': {
      const f = fabric(e.color, '#cbb79c')
      return (
        <group>
          <B p={[0, 0.21, 0]} s={[3, 0.42, 1]} m={f} />
          <B p={[0, 0.49, 0.06]} s={[2.75, 0.14, 0.85]} m={f} />
          <B p={[0, 0.66, -0.38]} s={[3, 0.75, 0.24]} m={f} />
          <B p={[-1.4, 0.34, 0]} s={[0.22, 0.6, 1]} m={f} />
          <B p={[1.4, 0.34, 0]} s={[0.22, 0.6, 1]} m={f} />
          <B p={[-0.7, 0.72, -0.18]} s={[0.55, 0.4, 0.14]} m={fabric(undefined, '#9c3f2e')} r={[-0.25, 0, 0]} />
          <B p={[0.75, 0.72, -0.18]} s={[0.55, 0.4, 0.14]} m={fabric(undefined, '#d9a75a')} r={[-0.25, 0, 0]} />
        </group>
      )
    }
    case 'bed':
      return (
        <group>
          <B p={[0, 0.18, 0]} s={[2.2, 0.36, 2.4]} m={M.clad} />
          <B p={[0, 0.48, 0.02]} s={[2.05, 0.26, 2.25]} m={M.white} />
          <B p={[0, 0.63, 0.4]} s={[2.08, 0.08, 1.45]} m={fabric(e.color, '#2f4a6b')} />
          <B p={[-0.5, 0.68, -0.85]} s={[0.75, 0.15, 0.42]} m={M.white} />
          <B p={[0.5, 0.68, -0.85]} s={[0.75, 0.15, 0.42]} m={M.white} />
          <B p={[0, 0.65, -1.2]} s={[2.4, 1.2, 0.12]} m={M.clad} />
        </group>
      )
    case 'table': {
      const top = e.material ? surface(e.material, e.color) : e.color ? fabric(e.color, '') : M.marble
      return (
        <group>
          <B p={[0, 0.76, 0]} s={[2.2, 0.07, 1.1]} m={top} />
          {[[-0.95, -0.45], [0.95, -0.45], [-0.95, 0.45], [0.95, 0.45]].map(([x, z]) => <B key={`${x}${z}`} p={[x, 0.37, z]} s={[0.07, 0.74, 0.07]} m={M.dark} />)}
          {[-0.6, 0.6].map((x) => [-1, 1].map((side) => (
            <group key={`${x}${side}`} position={[x, 0, side * 0.85]} rotation={[0, side > 0 ? Math.PI : 0, 0]}>
              <B p={[0, 0.46, 0]} s={[0.46, 0.06, 0.44]} m={fabric(undefined, '#5a4636')} />
              <B p={[0, 0.78, -0.2]} s={[0.46, 0.58, 0.05]} m={fabric(undefined, '#5a4636')} />
              {[[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]].map(([lx, lz]) => <B key={`${lx}${lz}`} p={[lx, 0.22, lz]} s={[0.04, 0.44, 0.04]} m={M.dark} cast={false} />)}
            </group>
          )))}
        </group>
      )
    }
    case 'chandelier':
      return (
        <group>
          <mesh geometry={CYL} position={[0, 0.25, 0]} scale={[0.02, 0.5, 0.02]} material={SHARED.gold} />
          <mesh rotation={[Math.PI / 2, 0, 0]} material={SHARED.gold}><torusGeometry args={[0.55, 0.035, 8, 32]} /></mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} material={SHARED.gold}><torusGeometry args={[0.32, 0.03, 8, 24]} /></mesh>
          {Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2
            return <mesh key={i} position={[Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55]} material={SHARED.lamp}><sphereGeometry args={[0.07, 10, 8]} /></mesh>
          })}
          <mesh position={[0, -0.35, 0]} material={SHARED.lamp}><sphereGeometry args={[0.12, 12, 10]} /></mesh>
        </group>
      )
    case 'plant':
      return (
        <group>
          <mesh geometry={CYL} position={[0, 0.28, 0]} scale={[0.28, 0.56, 0.28]} material={M.pot} castShadow />
          <mesh geometry={BLOB} position={[0, 0.95, 0]} scale={[0.5, 0.55, 0.5]} material={M.leaf} castShadow />
          <mesh geometry={BLOB} position={[0.12, 1.35, 0.05]} scale={[0.35, 0.4, 0.35]} material={M.leaf} castShadow />
        </group>
      )
    case 'rug':
      return (
        <group>
          <B p={[0, 0.01, 0]} s={[4.2, 0.02, 3]} m={fabric(e.color, '#7b2d2a')} cast={false} />
          <B p={[0, 0.015, 0]} s={[3.6, 0.02, 2.4]} m={fabric(undefined, '#c08a3e')} cast={false} />
          <B p={[0, 0.02, 0]} s={[2.6, 0.02, 1.4]} m={fabric(e.color, '#7b2d2a')} cast={false} />
        </group>
      )
  }
  return null
}

/** Any destroyed building collapses into seeded rubble rigid bodies (bridges have their own deck fracture). */
export function Rubble({ e }: { e: Entity }) {
  const big = e.type === 'mansion'
  const m = big ? M.render : surface(e.material, e.color, '#cdbb9a')
  const pieces = useMemo(() => {
    const r = rng((e.meta.seed ?? 3) * 17 + e.gen)
    const fp = footprint(e.type) * (big ? 0.7 : 0.75)
    const n = big ? 34 : 14
    const c = Math.cos(e.rotY), s = Math.sin(e.rotY)
    return Array.from({ length: n }, () => {
      const lx = (r() - 0.5) * fp, lz = (r() - 0.5) * fp * (big ? 0.6 : 1)
      const size: [number, number, number] = [0.5 + r() * (big ? 2.2 : 1.2), 0.3 + r() * 0.8, 0.5 + r() * (big ? 1.8 : 1)]
      return {
        pos: [e.pos[0] + lx * c + lz * s, e.pos[1] + 1 + r() * (big ? 5 : 3), e.pos[2] - lx * s + lz * c] as [number, number, number],
        rot: [r() * 3, r() * 3, r() * 3] as [number, number, number],
        size,
        vel: [(r() - 0.5) * 3, r() * 1.5, (r() - 0.5) * 3] as [number, number, number],
      }
    })
  }, [e, big])
  return (
    <group>
      {pieces.map((p, i) => (
        <RigidBody key={i} position={p.pos} rotation={p.rot} linearVelocity={p.vel} colliders={false} density={2}>
          <CuboidCollider args={[p.size[0] / 2, p.size[1] / 2, p.size[2] / 2]} />
          <mesh geometry={BOX} scale={p.size} material={i % 5 === 0 ? SHARED.tile : m} castShadow receiveShadow />
        </RigidBody>
      ))}
    </group>
  )
}
