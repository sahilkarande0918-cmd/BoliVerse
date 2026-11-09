import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import { rng, type Entity } from './world'
import { pbr } from './pbr'
import { addWind } from './Terrain'

// Procedural, species-specific trees: tapered branching bark tubes (metre UVs, scanned bark PBR)
// + alpha-cut leaf cards whose normals point out of the crown (soft, volumetric shading).
// Each species is built once and drawn with two InstancedMeshes (bark, foliage).

interface Buf { p: number[]; n: number[]; uv: number[]; i: number[] }
const buf = (): Buf => ({ p: [], n: [], uv: [], i: [] })
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)

/** tapered tube along a polyline; u wraps the circumference in metres, v follows length in metres */
function tube(b: Buf, pts: THREE.Vector3[], r0: number, r1: number, seg = 7) {
  let len = 0
  const base = b.p.length / 3
  for (let k = 0; k < pts.length; k++) {
    if (k) len += pts[k].distanceTo(pts[k - 1])
    const t = k / (pts.length - 1), r = r0 + (r1 - r0) * t
    const dir = (k < pts.length - 1 ? pts[k + 1].clone().sub(pts[k]) : pts[k].clone().sub(pts[k - 1])).normalize()
    const side = Math.abs(dir.y) < 0.95 ? V(0, 1, 0).cross(dir).normalize() : V(1, 0, 0)
    const up = dir.clone().cross(side).normalize()
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2
      const nrm = side.clone().multiplyScalar(Math.cos(a)).add(up.clone().multiplyScalar(Math.sin(a)))
      const pos = pts[k].clone().addScaledVector(nrm, r)
      b.p.push(pos.x, pos.y, pos.z); b.n.push(nrm.x, nrm.y, nrm.z); b.uv.push((s / seg) * 2 * Math.PI * Math.max(r0, 0.08), len)
    }
  }
  for (let k = 0; k < pts.length - 1; k++) for (let s = 0; s < seg; s++) {
    const a = base + k * (seg + 1) + s, c = a + seg + 1
    b.i.push(a, c, a + 1, a + 1, c, c + 1)
  }
}

/** a leaf card: quad of size w×h at `c`, oriented by quaternion q; normals radiate from `crown` */
function card(b: Buf, c: THREE.Vector3, w: number, h: number, q: THREE.Quaternion, crown: THREE.Vector3, uv = [0, 0, 1, 1]) {
  const base = b.p.length / 3
  const corners = [V(-w / 2, -h / 2), V(w / 2, -h / 2), V(w / 2, h / 2), V(-w / 2, h / 2)]
  const us = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]]
  corners.forEach((v, k) => {
    const p = v.applyQuaternion(q).add(c)
    const nrm = p.clone().sub(crown).normalize().lerp(V(0, 1, 0), 0.25).normalize()
    b.p.push(p.x, p.y, p.z); b.n.push(nrm.x, nrm.y, nrm.z); b.uv.push(us[k][0], us[k][1])
  })
  b.i.push(base, base + 1, base + 2, base, base + 2, base + 3)
}

function toGeo(b: Buf) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2))
  g.setIndex(b.i)
  g.computeBoundingSphere()
  return g
}

const randQ = (r: () => number) => new THREE.Quaternion().setFromEuler(new THREE.Euler(r() * Math.PI, r() * Math.PI * 2, r() * Math.PI))

function broadleaf(seed: number) {
  const r = rng(seed), bark = buf(), leaf = buf()
  const lean = V((r() - 0.5) * 0.4, 0, (r() - 0.5) * 0.4)
  const trunk = [V(0, 0, 0), V(0, 1.4, 0).add(lean.clone().multiplyScalar(0.3)), V(0, 2.8, 0).add(lean), V(0, 3.6, 0).add(lean)]
  tube(bark, trunk, 0.34, 0.2)
  const top = trunk[3], crown = top.clone().add(V(0, 2.4, 0))
  const nb = 5 + Math.floor(r() * 2)
  for (let k = 0; k < nb; k++) {
    const a = (k / nb) * Math.PI * 2 + r() * 0.6, el = 0.55 + r() * 0.45, L = 2.6 + r() * 1.4
    const from = trunk[2].clone().lerp(top, r())
    const dir = V(Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el))
    const mid = from.clone().addScaledVector(dir, L * 0.55).add(V(0, 0.25, 0))
    const tip = from.clone().addScaledVector(dir, L)
    tube(bark, [from, mid, tip], 0.15, 0.05, 5)
    for (const t of [tip, mid.clone().lerp(tip, 0.4)]) {
      for (let j = 0; j < 18; j++) {
        const c = t.clone().add(V((r() - 0.5) * 2.6, (r() - 0.2) * 1.8, (r() - 0.5) * 2.6))
        const s = 1.1 + r() * 0.7
        card(leaf, c, s, s, randQ(r), crown)
      }
    }
  }
  for (let j = 0; j < 26; j++) { // fill the crown centre
    const c = crown.clone().add(V((r() - 0.5) * 3.2, (r() - 0.5) * 2, (r() - 0.5) * 3.2))
    card(leaf, c, 1.4, 1.4, randQ(r), crown)
  }
  return { bark: toGeo(bark), leaf: toGeo(leaf), height: 7.5 }
}

function conifer(seed: number) {
  const r = rng(seed), bark = buf(), leaf = buf()
  const H = 11
  tube(bark, [V(0, 0, 0), V(0, H * 0.5, 0), V(0, H, 0)], 0.3, 0.04, 6)
  const axis = V(0, H * 0.6, 0)
  for (let y = 2.2; y < H - 0.4; y += 0.55) {
    const n = 5 + Math.floor(r() * 2), L = (1 - y / H) * 3.4 + 0.4
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + y * 1.7 + r() * 0.4
      const dir = V(Math.cos(a), -0.18 - r() * 0.12, Math.sin(a)).normalize()
      const from = V(0, y, 0), tip = from.clone().addScaledVector(dir, L)
      if (y < H - 3) tube(bark, [from, tip], 0.05, 0.015, 3)
      for (let s = 0; s < 3; s++) {
        const c = from.clone().lerp(tip, 0.3 + s * 0.3)
        const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), dir).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2 + (r() - 0.5) * 0.6, 0, 0)))
        card(leaf, c, L * 0.55 + 0.4, L * 0.55 + 0.4, q, axis.clone().setY(c.y))
      }
    }
  }
  return { bark: toGeo(bark), leaf: toGeo(leaf), height: H }
}

function palm(seed: number) {
  const r = rng(seed), bark = buf(), leaf = buf()
  const H = 9.5, bend = 0.6 + r() * 0.8
  const pts = Array.from({ length: 7 }, (_, k) => { const t = k / 6; return V(Math.sin(t * 1.2) * bend, t * H, 0) })
  tube(bark, pts, 0.26, 0.17, 8)
  const top = pts[6].clone().add(V(0, 0.2, 0))
  for (let k = 0; k < 13; k++) {
    const a = (k / 13) * Math.PI * 2 + r() * 0.3, droop = 0.25 + r() * 0.5, L = 3.6 + r() * 1.2
    const dir = V(Math.cos(a), 0, Math.sin(a))
    // frond as a ribbon of cards along a drooping arc
    for (let s = 0; s < 5; s++) {
      const t0 = s / 5, t1 = (s + 1) / 5
      const p0 = top.clone().addScaledVector(dir, L * t0).add(V(0, 0.9 * t0 - droop * 3 * t0 * t0, 0))
      const p1 = top.clone().addScaledVector(dir, L * t1).add(V(0, 0.9 * t1 - droop * 3 * t1 * t1, 0))
      const c = p0.clone().lerp(p1, 0.5), seg = p1.clone().sub(p0)
      const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), seg.clone().normalize())
      q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)))
      card(leaf, c, 1.3 * (1 - t0 * 0.6), seg.length() * 1.05, q, top.clone().add(V(0, -1, 0)), [0, t0, 1, t1])
    }
  }
  return { bark: toGeo(bark), leaf: toGeo(leaf), height: H }
}

// ---------- foliage textures (self-made on canvas, alpha-cut) ----------
function canvasAlpha(w: number, h: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void) {
  const c = document.createElement('canvas'); c.width = w; c.height = h
  const g = c.getContext('2d')!
  draw(g, rng(w + h))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}
const leafTex = () => canvasAlpha(256, 256, (g, r) => {
  for (let i = 0; i < 70; i++) {
    const x = 128 + (r() - 0.5) * 200, y = 128 + (r() - 0.5) * 200
    if ((x - 128) ** 2 + (y - 128) ** 2 > 100 ** 2) continue
    const a = r() * Math.PI * 2, L = 18 + r() * 16, W = L * 0.42
    g.save(); g.translate(x, y); g.rotate(a)
    const l = 15 + r() * 19
    g.fillStyle = `hsl(${88 + r() * 34}, ${30 + r() * 22}%, ${l}%)`
    g.beginPath(); g.ellipse(0, 0, L, W, 0, 0, Math.PI * 2); g.fill()
    g.strokeStyle = `hsla(90, 30%, ${l + 14}%, 0.6)`; g.lineWidth = 1
    g.beginPath(); g.moveTo(-L, 0); g.lineTo(L, 0); g.stroke()
    g.restore()
  }
})
const needleTex = () => canvasAlpha(256, 256, (g, r) => {
  // dense needle sprays: filled dark masses with stroke detail so alpha-cut cards stay solid at distance
  for (let i = 0; i < 26; i++) {
    const x = 128 + (r() - 0.5) * 170, y = 128 + (r() - 0.5) * 170
    g.fillStyle = `hsl(${118 + r() * 22}, ${28 + r() * 14}%, ${12 + r() * 9}%)`
    g.beginPath(); g.ellipse(x, y, 22 + r() * 18, 12 + r() * 10, r() * Math.PI, 0, Math.PI * 2); g.fill()
  }
  for (let i = 0; i < 1400; i++) {
    const x = 128 + (r() - 0.5) * 220, y = 128 + (r() - 0.5) * 220
    if ((x - 128) ** 2 + (y - 128) ** 2 > 110 ** 2) continue
    const a = Math.atan2(y - 128, x - 128) + (r() - 0.5) * 0.9
    g.strokeStyle = `hsl(${115 + r() * 30}, ${30 + r() * 20}%, ${12 + r() * 16}%)`; g.lineWidth = 2
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke()
  }
})
const frondTex = () => canvasAlpha(128, 512, (g, r) => {
  g.strokeStyle = '#5a6a2c'; g.lineWidth = 4
  g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 512); g.stroke()
  for (let y = 0; y < 512; y += 6) {
    for (const s of [-1, 1]) {
      const len = 58 * (0.5 + 0.5 * Math.sin((y / 512) * Math.PI)) * (0.85 + r() * 0.3)
      g.strokeStyle = `hsl(${85 + r() * 20}, ${40 + r() * 15}%, ${22 + r() * 14}%)`; g.lineWidth = 3.2
      g.beginPath(); g.moveTo(64, y); g.quadraticCurveTo(64 + s * len * 0.6, y + 6, 64 + s * len, y + 18); g.stroke()
    }
  }
})

const SPECIES = [
  { build: broadleaf, tex: leafTex, wind: 0.0035 },
  { build: palm, tex: frondTex, wind: 0.0022 },
  { build: conifer, tex: needleTex, wind: 0.0018 },
]

export function Trees({ trees, onSelect }: { trees: Entity[]; onSelect: (id: string) => void }) {
  const kits = useMemo(() => SPECIES.map((s, k) => {
    const g = s.build(11 + k)
    const leafMat = addWind(new THREE.MeshStandardMaterial({ map: s.tex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.78 }), s.wind)
    const barkMat = addWind(pbr('bark', 1.6).clone(), s.wind)
    return { ...g, leafMat, barkMat }
  }), [])
  const groups = useMemo(() => [0, 1, 2].map((v) => trees.filter((t) => (t.meta.variant ?? 0) % 3 === v)), [trees])
  return <>{kits.map((k, v) => groups[v].length > 0 && <SpeciesMesh key={v} kit={k} list={groups[v]} onSelect={onSelect} />)}</>
}

function SpeciesMesh({ kit, list, onSelect }: { kit: { bark: THREE.BufferGeometry; leaf: THREE.BufferGeometry; leafMat: THREE.Material; barkMat: THREE.Material }; list: Entity[]; onSelect: (id: string) => void }) {
  const barkRef = useRef<THREE.InstancedMesh>(null)
  const leafRef = useRef<THREE.InstancedMesh>(null)
  useEffect(() => {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color()
    list.forEach((t, i) => {
      const s = 0.85 + t.scale * 0.35
      m.compose(V(t.pos[0], t.pos[1] - 0.1, t.pos[2]), q.setFromAxisAngle(V(0, 1, 0), t.rotY), V(s, s, s))
      barkRef.current?.setMatrixAt(i, m)
      leafRef.current?.setMatrixAt(i, m)
      // subtle per-tree foliage variation (or the user's chosen colour)
      leafRef.current?.setColorAt(i, t.color ? col.set(t.color === 'red' ? '#a34a2c' : t.color === 'yellow' ? '#c9a83a' : t.color === 'orange' ? '#c4702e' : '#7aa35a') : col.setHSL(0.2 + ((t.meta.seed ?? 0) % 7) * 0.012, 0.22, 0.7 + ((t.meta.seed ?? 0) % 5) * 0.05))
    })
    for (const r of [barkRef, leafRef]) if (r.current) { r.current.count = list.length; r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true; r.current.computeBoundingSphere() }
  }, [list])
  const pick = (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); if (e.instanceId !== undefined) onSelect(list[e.instanceId].id) }
  const cap = Math.max(1, list.length)
  return (
    <>
      <instancedMesh ref={barkRef} args={[kit.bark, kit.barkMat, cap]} castShadow receiveShadow onClick={pick} />
      <instancedMesh ref={leafRef} args={[kit.leaf, kit.leafMat, cap]} castShadow receiveShadow onClick={pick} />
    </>
  )
}

/** Leafy shrubs/bushes: instanced leaf-card balls hugging houses and road edges. */
export function Shrubs({ spots }: { spots: [number, number, number][] }) {
  const mesh = useMemo(() => {
    const r = rng(77), b = buf(), crown = V(0, 0.6, 0)
    for (let j = 0; j < 22; j++) {
      const c = V((r() - 0.5) * 1.5, 0.25 + r() * 0.8, (r() - 0.5) * 1.5)
      const s = 0.55 + r() * 0.45
      card(b, c, s, s, randQ(r), crown)
    }
    const mat = addWind(new THREE.MeshStandardMaterial({ map: leafTex(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: '#b7c79a' }), 0.12)
    const im = new THREE.InstancedMesh(toGeo(b), mat, Math.max(1, spots.length))
    const m = new THREE.Matrix4(), q = new THREE.Quaternion()
    spots.forEach(([x, y, z], i) => { const s = 0.8 + r() * 0.7; m.compose(V(x, y, z), q.setFromAxisAngle(V(0, 1, 0), r() * 6.28), V(s, s * (0.8 + r() * 0.4), s)); im.setMatrixAt(i, m) })
    im.count = spots.length
    im.castShadow = im.receiveShadow = true
    return im
  }, [spots])
  return <primitive object={mesh} />
}
