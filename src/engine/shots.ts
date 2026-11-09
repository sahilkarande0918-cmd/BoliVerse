import * as THREE from 'three'
import type { CameraPreset } from '../compiler/schema'
import { type World, riverSlope, riverX } from './world'

// Deterministic camera paths. Keyframes are derived from the live world (bridge pose, village
// centre), sampled along Catmull-Rom splines with ease-in-out timing.

export interface ShotPath { pos: THREE.CatmullRomCurve3; look: THREE.CatmullRomCurve3; fov: number }

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

export function villageCentre(w: World) {
  const hs = w.entities.filter((e) => e.type === 'house' || e.type === 'temple' || e.type === 'school')
  if (!hs.length) return V(riverX(0), 0, 0)
  const c = hs.reduce((a, e) => a.add(V(e.pos[0], 0, e.pos[2])), V(0, 0, 0)).divideScalar(hs.length)
  return c.setY(1)
}

export function buildShot(preset: CameraPreset, w: World, targetId?: string): ShotPath {
  const C = villageCentre(w)
  const t = w.entities.find((e) => e.id === targetId) ?? w.entities.filter((e) => e.type === 'bridge').at(-1)
  const B = t ? V(t.pos[0], t.pos[1], t.pos[2]) : V(riverX(0), 0.5, 0)
  const s = riverSlope(B.z)
  const T = V(s, 0, 1).normalize() // downstream
  const N = V(1, 0, -s).normalize() // across
  const at = (base: THREE.Vector3, along: number, across: number, y: number) => base.clone().addScaledVector(T, along).addScaledVector(N, across).setY(y)
  let pos: THREE.Vector3[], look: THREE.Vector3[], fov = 45, closed = false

  switch (preset) {
    case 'bridge_flythrough':
      pos = [at(B, 48, 2, 1.4), at(B, 20, 1, 1.1), at(B, 4, 0, 4.5), at(B, -14, -2, 9), at(B, -36, -9, 17)]
      look = [at(B, 0, 0, 1.5), at(B, 0, 0, 1), at(B, -12, 0, 1.5), at(B, -34, 0, 2), C.clone()]
      fov = 50
      break
    case 'under_bridge':
      pos = [at(B, 36, 1, -0.2), at(B, 12, 0, -0.35), at(B, 0, 0, -0.35), at(B, -12, 0, 0.6), at(B, -30, 3, 7)]
      look = [at(B, 0, 0, 0), at(B, -6, 0, -0.2), at(B, -20, 0, 0), at(B, -40, 0, 1.5), at(B, -60, 0, 2)]
      fov = 55
      break
    case 'establishing':
      pos = [C.clone().add(V(95, 62, 95)), C.clone().add(V(60, 34, 62)), C.clone().add(V(28, 15, 34))]
      look = [C.clone(), C.clone(), C.clone().add(V(-6, 0, -4))]
      break
    case 'river_reveal':
      pos = [V(riverX(85), 0.4, 85), V(riverX(50) + 2, 3, 50), V(riverX(18) + 16, 22, 26)]
      look = [V(riverX(50), 0, 50), V(riverX(15), 0, 15), C.clone()]
      fov = 50
      break
    case 'sunset_panorama':
      pos = [C.clone().add(V(-72, 22, 52)), C.clone().add(V(-80, 25, 0)), C.clone().add(V(-72, 22, -52))]
      look = [C.clone().add(V(25, 0, 10)), C.clone().add(V(25, 0, 0)), C.clone().add(V(25, 0, -10))]
      fov = 40
      break
    case 'orbit': {
      const target = t && t.type !== 'bridge' ? V(t.pos[0], 1, t.pos[2]) : t ? B : C
      pos = Array.from({ length: 8 }, (_, i) => target.clone().add(V(Math.cos((i / 8) * Math.PI * 2) * 42, 20, Math.sin((i / 8) * Math.PI * 2) * 42)))
      look = pos.map(() => target.clone())
      closed = true
      break
    }
    case 'mansion_reveal':
    case 'interior': {
      const m = w.entities.find((e) => e.id === targetId && e.type === 'mansion') ?? w.entities.filter((e) => e.type === 'mansion').at(-1)
      const M = m ? V(m.pos[0], m.pos[1], m.pos[2]) : C
      const rot = m?.rotY ?? 0
      // mansion-local → world (local +z is the glass front)
      const L = (x: number, y: number, z: number) => V(M.x + x * Math.cos(rot) + z * Math.sin(rot), M.y + y, M.z - x * Math.sin(rot) + z * Math.cos(rot))
      if (preset === 'mansion_reveal') {
        pos = [L(-34, 20, 34), L(-12, 9, 30), L(10, 5, 24), L(22, 4, 10)]
        look = [L(0, 2, 0), L(0, 2, 0), L(0, 2.5, 0), L(-2, 2, -2)]
        fov = 42
      } else {
        // stays in the aisle between the living (x<-2) and dining (x≈1.5–3.5) zones
        pos = [L(-2, 4, 28), L(-0.6, 2.6, 12), L(-0.4, 2.2, 5.6), L(-0.9, 2.3, 2.6), L(-0.6, 2.6, -1.2), L(0.4, 3, -3.2)]
        look = [L(-1, 1.5, 0), L(-1, 1.6, 0), L(-5.6, 0.8, -1.5), L(-5.6, 0.6, -2), L(2.6, 1.4, 1.6), L(7.4, 0.8, 2)]
        fov = 58
      }
      break
    }
    case 'destruction':
      pos = [at(B, 12, 15, 6), at(B, 8, 10, 3.2)]
      look = [at(B, 0, 0, 0), at(B, 0, 0, -0.5)]
      fov = 48
      break
  }
  return { pos: new THREE.CatmullRomCurve3(pos, closed, 'centripetal'), look: new THREE.CatmullRomCurve3(look, closed, 'centripetal'), fov }
}

const ease = (t: number) => t * t * (3 - 2 * t)

export function poseAt(path: ShotPath, t01: number, cam: THREE.PerspectiveCamera) {
  const k = ease(Math.min(1, Math.max(0, t01)))
  cam.position.copy(path.pos.getPoint(k))
  cam.lookAt(path.look.getPoint(k))
  if (cam.fov !== path.fov) { cam.fov = path.fov; cam.updateProjectionMatrix() }
}
