import { useEffect, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import type { Entity } from './world'
import { loadModel, resolveAsset } from './library'
import { useStudio } from '../store'

/** Load a CC0 model; `align` puts its base (or its top, for hanging things) at the entity origin. */
export function useModel(id: string | undefined, align: 'base' | 'top' = 'base') {
  const [model, setModel] = useState<{ obj: THREE.Group; size: THREE.Vector3 } | null>(null)
  useEffect(() => {
    if (!id) return
    let live = true
    loadModel(id).then((obj) => {
      if (!live) return
      const box = new THREE.Box3().setFromObject(obj), c = box.getCenter(new THREE.Vector3())
      obj.position.set(-c.x, align === 'base' ? -box.min.y : -box.max.y, -c.z)
      const wrap = new THREE.Group(); wrap.add(obj)
      setModel({ obj: wrap, size: box.getSize(new THREE.Vector3()) })
    }).catch(() => undefined)
    return () => { live = false }
  }, [id, align])
  return model
}

/** A built-in object type rendered as a real scanned model, with a procedural stand-in while it streams. */
export function ScannedOr({ id, align, children }: { id?: string; align?: 'base' | 'top'; children: ReactNode }) {
  const m = useModel(id, align)
  return m ? <primitive object={m.obj} /> : <>{children}</>
}

/** Any spoken object ("ek kursi banao", "add a barrel"): resolved against the CC0 library. */
export function Prop({ e, onSelect }: { e: Entity; onSelect: (id: string) => void }) {
  const [assetId, setAssetId] = useState<string>()
  useEffect(() => {
    let live = true
    resolveAsset(e.meta.query ?? 'object').then((r) => {
      if (!live) return
      if (r.ok) { setAssetId(r.id); useStudio.getState().set({ message: `Placed a scanned “${r.name}” (Poly Haven, CC0)` }) }
      else {
        useStudio.getState().set({ phase: 'error', message: r.reason })
        void useStudio.getState().run(`remove ${e.id}`, 'text', {}, [{ action: 'DELETE_OBJECT', target: { id: e.id } }])
      }
    }).catch(() => useStudio.getState().set({ phase: 'error', message: 'Could not reach the CC0 model library (offline?)' }))
    return () => { live = false }
  }, [e.id, e.meta.query])
  const m = useModel(assetId)
  if (!m) return null
  const half: [number, number, number] = [Math.max(0.1, m.size.x / 2), Math.max(0.1, m.size.y / 2), Math.max(0.1, m.size.z / 2)]
  return (
    <RigidBody type="fixed" colliders={false} position={e.pos} rotation={[0, e.rotY, 0]}>
      <CuboidCollider args={half.map((v) => v * e.scale) as [number, number, number]} position={[0, half[1] * e.scale, 0]} />
      <group scale={e.scale} onClick={(ev) => { ev.stopPropagation(); onSelect(e.id) }}>
        <primitive object={m.obj} />
      </group>
    </RigidBody>
  )
}
