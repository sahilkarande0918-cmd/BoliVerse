import { useMemo } from 'react'
import { applyTransaction } from '../compiler/apply'
import { WorldView } from '../engine/Scene3D'
import { emptyWorld } from '../engine/world'

// The landing hero is the real engine rendering a generated world — not pre-recorded footage.
export default function HeroWorld() {
  const world = useMemo(() => {
    const w = applyTransaction(emptyWorld(7), [
      { action: 'CREATE_SCENE', template: 'village' },
      { action: 'CREATE_OBJECT', objectType: 'river' },
      { action: 'CREATE_OBJECT', objectType: 'bridge', material: 'wood' },
    ], null).world
    return { ...w, env: { ...w.env, time: 'sunset' as const } }
  }, [])
  return <WorldView world={world} quality="medium" hero />
}
