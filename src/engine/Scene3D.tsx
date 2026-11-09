import { Component, Suspense, memo, useEffect, useMemo, useRef, type ReactElement, type ReactNode } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree, type RootState } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Physics } from '@react-three/rapier'
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import type { OrbitControls as OrbitImpl } from 'three-stdlib'
import { type Quality, useStudio } from '../store'
import { Terrain, Water, waterUniforms } from './Terrain'
import { Atmosphere } from './Atmosphere'
import { WorldEntities } from './Entities'
import { computeRoute } from './traversal'
import { buildShot, poseAt, villageCentre, type ShotPath } from './shots'
import { riverX, type World } from './world'
import { encodeFrames, pickExport, recordRealtime } from '../video/exporter'

// ---------- camera: orbit controls + spoken view changes + shot preview ----------
function CameraDirector({ world }: { world: World }) {
  const controls = useRef<OrbitImpl>(null)
  const { camera } = useThree()
  const cmd = useStudio((s) => s.cameraCmd)
  const shot = useStudio((s) => s.shot)
  const anim = useRef<{ p: THREE.Vector3; t: THREE.Vector3 } | null>(null)
  const play = useRef<{ path: ShotPath; start: number; dur: number } | null>(null)

  useEffect(() => {
    if (!cmd.seq) return
    const C = villageCentre(world)
    const e = world.entities.find((x) => x.id === cmd.targetId) ?? world.entities.find((x) => x.id === world.recent.at(-1))
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
    const poses: Record<string, { p: THREE.Vector3; t: THREE.Vector3 }> = {
      overview: { p: C.clone().add(V(62, 48, 74)), t: C.clone() },
      top: { p: C.clone().add(V(0, 150, 0.1)), t: C.clone() },
      low: { p: V(riverX(40) + 12, 2.5, 40), t: V(riverX(0), 2, 0) },
      focus: e ? { p: V(e.pos[0] + 12, e.pos[1] + 8, e.pos[2] + 14), t: V(e.pos[0], e.pos[1] + 1.5, e.pos[2]) } : { p: C.clone().add(V(30, 20, 30)), t: C.clone() },
    }
    anim.current = poses[cmd.view] ?? null
  }, [cmd, world])

  useEffect(() => {
    if (!shot || shot.record) return
    play.current = { path: buildShot(shot.preset, useStudio.getState().world, shot.targetId), start: -1, dur: shot.durationSec }
    useStudio.getState().set({ message: `Previewing “${shot.preset.replace('_', ' ')}” (${shot.durationSec}s)` })
  }, [shot])

  useFrame(({ clock }, dt) => {
    const ctl = controls.current
    if (!ctl || useStudio.getState().recording.state === 'recording') return
    if (play.current) {
      const pl = play.current
      if (pl.start < 0) pl.start = clock.elapsedTime
      const t = (clock.elapsedTime - pl.start) / pl.dur
      poseAt(pl.path, t, camera as THREE.PerspectiveCamera)
      ctl.target.copy(pl.path.look.getPoint(Math.min(1, t)))
      if (t >= 1) play.current = null
      return
    }
    if (anim.current) {
      const k = 1 - Math.exp(-dt * 2.5)
      camera.position.lerp(anim.current.p, k)
      ctl.target.lerp(anim.current.t, k)
      if (camera.position.distanceTo(anim.current.p) < 0.3) anim.current = null
    }
  })
  return <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={0.08} maxPolarAngle={1.5} minDistance={3} maxDistance={260} onStart={() => { anim.current = null; play.current = null }} />
}

// ---------- film: frame-exact export of the live scene ----------
function FilmRecorder({ world }: { world: World }) {
  const three = useThree()
  const shot = useStudio((s) => s.shot)
  const busy = useRef(false)
  const realtime = useRef<{ path: ShotPath; start: number; dur: number } | null>(null)

  useFrame(({ clock, camera }) => {
    const r = realtime.current
    if (!r) return
    if (r.start < 0) r.start = clock.elapsedTime
    poseAt(r.path, (clock.elapsedTime - r.start) / r.dur, camera as THREE.PerspectiveCamera)
  })

  useEffect(() => {
    if (!shot?.record || busy.current) return
    busy.current = true
    const st = useStudio.getState()
    const state = three as RootState
    const run = async () => {
      const res = st.quality === 'low' ? 720 : 720
      const [W, H] = shot.aspect === '9:16' ? [res, Math.round((res * 16) / 9 / 2) * 2] : [Math.round((res * 16) / 9 / 2) * 2, res]
      const plan = await pickExport(W, H)
      if (plan.kind === 'none') {
        st.set({ recording: { state: 'error', progress: 0, message: 'This browser cannot encode video (no WebCodecs or MediaRecorder)' } })
        return
      }
      const prev = { w: state.size.width, h: state.size.height, top: state.size.top, left: state.size.left, dpr: state.viewport.dpr }
      const set = (p: Partial<ReturnType<typeof useStudio.getState>['recording']>) => useStudio.getState().set({ recording: { ...useStudio.getState().recording, ...p } })
      set({ state: 'recording', progress: 0, url: undefined, message: undefined })
      const cancelled = () => useStudio.getState().recording.state !== 'recording'
      const path = buildShot(shot.preset, useStudio.getState().world, shot.targetId)
      let blob: Blob | null = null
      let label = ''
      try {
        state.setDpr(1)
        state.setSize(W, H, prev.top, prev.left)
        await new Promise((r) => setTimeout(r, 150))
        if (plan.kind === 'webcodecs') {
          label = plan.container === 'mp4' ? 'MP4 · H.264' : `WebM · ${plan.codec.toUpperCase()}`
          const fps = 30
          const frames = Math.round(shot.durationSec * fps)
          state.setFrameloop('never')
          const base = state.clock.elapsedTime
          blob = await encodeFrames({
            canvas: state.gl.domElement, plan, fps, frames, cancelled,
            renderFrame: (i) => { poseAt(path, i / (frames - 1), state.camera as THREE.PerspectiveCamera); state.advance(base + (i + 1) / fps) },
            onProgress: (p) => set({ progress: p }),
          })
        } else {
          label = 'WebM (MediaRecorder, realtime)'
          realtime.current = { path, start: -1, dur: shot.durationSec }
          blob = await recordRealtime(state.gl.domElement, plan.mime, shot.durationSec, cancelled)
        }
      } catch (e) {
        set({ state: 'error', message: `Export failed: ${(e as Error).message}` })
      } finally {
        realtime.current = null
        state.setFrameloop('always')
        state.setSize(prev.w, prev.h, prev.top, prev.left)
        state.setDpr(prev.dpr)
      }
      if (blob) {
        const old = useStudio.getState().recording.url
        if (old) URL.revokeObjectURL(old)
        const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'
        set({ state: 'ready', progress: 1, url: URL.createObjectURL(blob), format: label, sizeBytes: blob.size, durationSec: shot.durationSec, fileName: `boliverse-${shot.preset}-${shot.aspect.replace(':', 'x')}-${Date.now()}.${ext}` })
        useStudio.getState().set({ message: `Video ready — ${label}, ${(blob.size / 1e6).toFixed(1)} MB` })
      } else if (useStudio.getState().recording.state === 'recording') set({ state: 'idle' })
    }
    void run().finally(() => { busy.current = false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shot?.seq])
  void world
  return null
}

function FpsProbe() {
  const acc = useRef({ n: 0, t: 0 })
  useFrame((_, dt) => {
    const a = acc.current
    a.n++; a.t += dt
    if (a.t >= 1) { useStudio.getState().set({ fps: Math.round(a.n / a.t) }); a.n = 0; a.t = 0 }
  })
  return null
}

// memo: EffectComposer recompiles its merged shader (~1 s) if its children change identity.
const Effects = memo(function Effects({ quality }: { quality: Quality }) {
  if (quality === 'low') return null
  const fx = [
    <Bloom key="bloom" mipmapBlur intensity={0.55} luminanceThreshold={0.82} luminanceSmoothing={0.25} />,
    <ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />,
    <Vignette key="vig" offset={0.28} darkness={0.55} />,
    <Noise key="grain" opacity={0.022} premultiply blendFunction={BlendFunction.SOFT_LIGHT} />,
  ].filter(Boolean) as ReactElement[]
  return <EffectComposer multisampling={quality === 'high' ? 4 : 0}>{fx}</EffectComposer>
})

class GLBoundary extends Component<{ children: ReactNode }, { err?: string }> {
  state: { err?: string } = {}
  static getDerivedStateFromError(e: Error) { return { err: e.message } }
  render() {
    return this.state.err ? (
      <div className="grid h-full place-items-center p-8 text-center text-sm text-[var(--muted)]">
        <div><p className="mb-2 font-display text-2xl text-[var(--text)]">3D viewport could not start</p><p>WebGL failed on this device ({this.state.err}). Try another browser or the Low graphics preset.</p></div>
      </div>
    ) : this.props.children
  }
}

export function WorldView({ world, quality, paused = false, hero = false }: { world: World; quality: Quality; paused?: boolean; hero?: boolean }) {
  const selectedId = useStudio((s) => s.selectedId)
  const routeKey = world.entities.filter((e) => e.type === 'bridge' || e.type === 'river').map((e) => `${e.id}:${e.state}:${e.pos.join(',')}:${e.meta.span}`).join('|')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const route = useMemo(() => computeRoute(world), [routeKey])
  const water = useMemo(waterUniforms, [])
  return (
    <GLBoundary>
      <Canvas
        shadows={quality !== 'low'}
        flat={quality !== 'low'}
        dpr={quality === 'high' ? [1, 2] : [1, 1.5]}
        gl={{ preserveDrawingBuffer: !hero, powerPreference: 'high-performance', antialias: quality === 'low' }}
        camera={{ position: [70, 50, 85], fov: 45, near: 0.1, far: 3000 }}
        onPointerMissed={() => useStudio.getState().select(null)}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap }}
      >
        <Suspense fallback={null}>
          <Physics timeStep={1 / 60} paused={paused} gravity={[0, -9.81, 0]}>
            <Terrain segments={quality === 'high' ? 180 : quality === 'medium' ? 130 : 90} />
            <WorldEntities entities={world.entities} selectedId={hero ? null : selectedId} route={route} />
          </Physics>
        </Suspense>
        {world.entities.some((e) => e.type === 'river') && <Water uniforms={water} />}
        <Atmosphere env={world.env} quality={quality} water={water} />
        {hero ? <HeroCamera /> : <><CameraDirector world={world} /><FilmRecorder world={world} /><FpsProbe /></>}
        <Effects quality={quality} />
      </Canvas>
    </GLBoundary>
  )
}

function HeroCamera() {
  useFrame(({ camera, clock }) => {
    const t = clock.elapsedTime * 0.05
    camera.position.set(riverX(0) + Math.cos(t) * 78, 30 + Math.sin(t * 2) * 4, Math.sin(t) * 78)
    camera.lookAt(riverX(0), 2, 0)
  })
  return null
}
