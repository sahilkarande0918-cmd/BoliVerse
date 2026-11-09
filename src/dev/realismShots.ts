// DEV-ONLY: repeatable before/after captures of the same seeded scene, rendered frame-exact
// (works even when the browser tab is not visible), plus measured ms per rendered frame.
import * as THREE from 'three'
import type { RootState } from '@react-three/fiber'
import { useStudio, type Quality } from '../store'
import { villageCentre } from '../engine/shots'
import { riverX } from '../engine/world'

const W = 1280, H = 720
const r3f = () => (window as unknown as { __r3f: RootState }).__r3f.get()

export async function captureSet(tag: string, quality: Quality = 'medium', log: (s: string) => void = console.log) {
  for (let i = 0; i < 100 && !(window as unknown as { __r3f?: RootState }).__r3f; i++) await new Promise((r) => setTimeout(r, 100))
  const st = useStudio
  st.setState({ log: [], past: [], future: [], selectedId: null, mode: 'build', quality })
  st.getState().set({ world: { ...st.getState().world, entities: [], counters: {}, recent: [], template: 'blank', env: { time: 'morning', weather: 'clear', lighting: 'cinematic' } } })
  await new Promise((r) => setTimeout(r, 300))
  await st.getState().run('Ek beautiful Indian village banao, beech mein nadi ho, aur wooden bridge ho.', 'text')
  st.getState().set({ recording: { state: 'recording', progress: 0 } }) // freeze the interactive camera director
  st.getState().select(null)
  await new Promise((r) => setTimeout(r, 1500)) // textures / async loads
  const s0 = r3f()
  const prev = { w: s0.size.width, h: s0.size.height, top: s0.size.top, left: s0.size.left, dpr: s0.viewport.dpr }
  s0.setDpr(1); s0.setSize(W, H, prev.top, prev.left); s0.setFrameloop('never')
  await new Promise((r) => setTimeout(r, 400))
  let t = r3f().clock.elapsedTime
  // yield between frames: Rapier must not be re-entered synchronously
  const step = async (n: number) => { for (let i = 0; i < n; i++) { t += 1 / 30; r3f().advance(t); await new Promise((r) => setTimeout(r, 0)) } }
  const cam = () => r3f().camera as THREE.PerspectiveCamera
  const pose = (p: THREE.Vector3, look: THREE.Vector3) => {
    cam().position.copy(p); cam().lookAt(look)
    ;(r3f().controls as unknown as { target?: THREE.Vector3 } | null)?.target?.copy(look)
  }
  const save = async (name: string) => {
    const blob = await new Promise<Blob>((res) => r3f().gl.domElement.toBlob((b) => res(b!), 'image/jpeg', 0.9))
    await fetch(`/__save?dir=realism&name=${tag}-${name}.jpg`, { method: 'POST', body: blob })
    log(`saved ${tag}-${name}.jpg`)
  }
  const w = st.getState().world
  const C = villageCentre(w)
  const bridge = w.entities.find((e) => e.type === 'bridge')!
  const house = w.entities.filter((e) => e.type === 'house').sort((a, b) => Math.hypot(a.pos[0] - bridge.pos[0], a.pos[2] - bridge.pos[2]) - Math.hypot(b.pos[0] - bridge.pos[0], b.pos[2] - bridge.pos[2]))[0]
  const B = new THREE.Vector3(...bridge.pos), Hs = new THREE.Vector3(...house.pos)
  const views: [string, THREE.Vector3, THREE.Vector3][] = [
    ['overview', C.clone().add(new THREE.Vector3(62, 48, 74)), C.clone()],
    ['river', new THREE.Vector3(riverX(34) + 7, 3.2, 34), new THREE.Vector3(riverX(8), -0.5, 8)],
    ['house', Hs.clone().add(new THREE.Vector3(10, 4.5, 10)), Hs.clone().add(new THREE.Vector3(0, 2, 0))],
    ['bridge', B.clone().add(new THREE.Vector3(12, 5, 14)), B.clone()],
  ]
  await step(150) // settle spawn animations, atmosphere transitions, physics
  // ms per rendered frame (CPU submit + GPU finish), same view, after warm-up
  pose(views[0][1], views[0][2]); await step(10)
  const gl = r3f().gl.getContext()
  const times: number[] = []
  for (let i = 0; i < 60; i++) { t += 1 / 30; const a = performance.now(); r3f().advance(t); gl.finish(); times.push(performance.now() - a); await new Promise((r) => setTimeout(r, 0)) }
  times.sort((x, y) => x - y)
  // whole-frame counters (composer passes reset them per render otherwise)
  const info = r3f().gl.info
  info.autoReset = false; info.reset(); t += 1 / 30; r3f().advance(t)
  const frameCalls = info.render.calls, frameTris = info.render.triangles
  info.autoReset = true
  const perf = { quality, width: W, height: H, medianMs: +times[30].toFixed(2), p95Ms: +times[57].toFixed(2), drawCalls: frameCalls, triangles: frameTris, textures: r3f().gl.info.memory.textures, geometries: r3f().gl.info.memory.geometries }
  log(JSON.stringify(perf))
  const setEnv = async (time: 'dawn' | 'morning' | 'sunset' | 'night', weather: 'clear' | 'rain') => {
    st.getState().set({ world: { ...st.getState().world, env: { ...st.getState().world.env, time, weather } } })
    await step(140)
  }
  const shoot = async (name: string, v = views[0]) => { pose(v[1], v[2]); await step(3); await save(name) }
  for (const v of views) await shoot(`day-${v[0]}`, v)
  await setEnv('sunset', 'clear'); await shoot('sunset-overview'); await shoot('sunset-river', views[1])
  await setEnv('dawn', 'clear'); await shoot('sunrise-overview'); await shoot('sunrise-river', views[1])
  await setEnv('morning', 'rain'); await shoot('rain-overview'); await shoot('rain-river', views[1])
  await setEnv('night', 'clear'); await shoot('night-overview')
  await fetch(`/__save?dir=realism&name=${tag}-perf.json`, { method: 'POST', body: JSON.stringify(perf, null, 1) })
  const s1 = r3f()
  s1.setFrameloop('always'); s1.setSize(prev.w, prev.h, prev.top, prev.left); s1.setDpr(prev.dpr)
  st.getState().set({ recording: { state: 'idle', progress: 0 } })
  return perf
}
