import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Cloud, Clouds, Environment, Sky, Stars } from '@react-three/drei'
import type { Sky as SkyImpl } from 'three-stdlib'
import type { World } from './world'
import type { Quality } from '../store'
import { SHARED } from './Entities'
import { SHADER_TIME, WETNESS, type waterUniforms } from './Terrain'

// Image-based lighting from CC0 Poly Haven skies. The visible sky is the photographed backdrop;
// the directional sun is derived from where the sun actually sits in that photo (measured offline:
// day u=0.590/elev 50.6°, sunset u=0.629/elev 8.4°) and rotated together with the sky, so shadows
// agree with the sky you see.
type SkyId = 'day' | 'sunset'
const SKY: Record<SkyId, { jpg: string; hdr: string; az: number; elev: number; horizon: string }> = {
  day: { jpg: '/assets/pbr/sky_day.jpg', hdr: '/assets/pbr/sky_day_1k.hdr', az: 57.7, elev: 50.6, horizon: '#a3a8b6' },
  sunset: { jpg: '/assets/pbr/sky_sunset.jpg', hdr: '/assets/pbr/sky_sunset_1k.hdr', az: 43.5, elev: 8.4, horizon: '#9a8a7a' },
}

interface Look { sky: SkyId | null; rot: number; sun: string; sunI: number; env: number; bg: number; hemi: number; fog: string; fogD: number; night: number }
const TIMES: Record<World['env']['time'], Look> = {
  dawn: { sky: 'sunset', rot: 0.99, sun: '#ffd2a8', sunI: 2.2, env: 0.75, bg: 0.85, hemi: 0.08, fog: '#a4968a', fogD: 0.0022, night: 0.15 },
  morning: { sky: 'day', rot: -1.7, sun: '#fff2df', sunI: 3.1, env: 1.0, bg: 1.0, hemi: 0.1, fog: SKY.day.horizon, fogD: 0.0016, night: 0 },
  noon: { sky: 'day', rot: -0.6, sun: '#ffffff', sunI: 3.5, env: 1.1, bg: 1.05, hemi: 0.1, fog: SKY.day.horizon, fogD: 0.0014, night: 0 },
  sunset: { sky: 'sunset', rot: 2.64, sun: '#ffbe85', sunI: 2.8, env: 0.85, bg: 0.95, hemi: 0.08, fog: SKY.sunset.horizon, fogD: 0.0018, night: 0.3 },
  night: { sky: null, rot: 0, sun: '#a9bcff', sunI: 0.55, env: 0.1, bg: 1, hemi: 0.22, fog: '#0e1424', fogD: 0.003, night: 1 },
}

/** Visible sun disc (not fogged / tone-mapped) — the light source for god rays and mirror reflections. */
export const SUN_MESH = new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff3dc', fog: false, toneMapped: false, transparent: true, depthWrite: false }))
SUN_MESH.frustumCulled = false

const texLoader = new THREE.TextureLoader()
const backdrops: Partial<Record<SkyId, THREE.Texture>> = {}
function backdrop(id: SkyId) {
  if (!backdrops[id]) {
    const t = texLoader.load(SKY[id].jpg)
    t.mapping = THREE.EquirectangularReflectionMapping
    t.colorSpace = THREE.SRGBColorSpace
    backdrops[id] = t
  }
  return backdrops[id]!
}

/** Sun direction for a sky photo rotated by `rot` around Y (three rotates the background by +rot). */
function sunDir(id: SkyId, rot: number) {
  const az = THREE.MathUtils.degToRad(SKY[id].az) + rot, el = THREE.MathUtils.degToRad(SKY[id].elev)
  return new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize()
}

export function Atmosphere({ env, quality, water, hero = false }: { env: World['env']; quality: Quality; water: ReturnType<typeof waterUniforms>; hero?: boolean }) {
  const { scene } = useThree()
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const skyRef = useRef<SkyImpl>(null)
  const starsRef = useRef<THREE.Points>(null)
  const fog = useMemo(() => new THREE.FogExp2('#a3a8b6', 0.0016), [])
  const flash = useRef(0)
  const look = TIMES[env.time]
  const live = useRef({ sunI: look.sunI, env: look.env, fog: new THREE.Color(look.fog), fogD: look.fogD, night: look.night, dir: look.sky ? sunDir(look.sky, look.rot) : new THREE.Vector3(-0.4, 0.6, -0.5) })
  void water

  // swap the photographed sky with the time of day (background is not fogged)
  useEffect(() => {
    scene.fog = fog
    scene.background = look.sky ? backdrop(look.sky) : null
    scene.backgroundRotation.set(0, look.rot, 0)
    scene.environmentRotation.set(0, look.rot, 0)
    return () => { scene.background = null }
  }, [scene, fog, look])

  useFrame(({ camera }, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    SHADER_TIME.value += dt
    const wetTarget = env.weather === 'rain' || env.weather === 'storm' ? 1 : 0
    WETNESS.value += (wetTarget - WETNESS.value) * (1 - Math.exp(-dt * 0.8))
    const wet = env.weather === 'rain' ? 1 : env.weather === 'storm' ? 1.4 : 0
    const foggy = env.weather === 'fog' ? 1 : 0
    const L = env.lighting === 'dramatic' ? { sun: 1.25, env: 0.75 } : env.lighting === 'soft' ? { sun: 0.75, env: 1.25 } : { sun: 1, env: 1 }
    const target = {
      sunI: look.sunI * L.sun * (1 - wet * 0.6) * (1 - foggy * 0.45),
      env: look.env * L.env * (1 - wet * 0.35),
      fog: new THREE.Color(look.fog).lerp(new THREE.Color(look.night > 0.8 ? '#0b0f18' : '#8d939b'), Math.min(1, wet * 0.6 + foggy * 0.6)),
      fogD: look.fogD * (1 + wet * 1.6) + foggy * 0.02,
      night: look.night,
      dir: look.sky ? sunDir(look.sky, look.rot) : new THREE.Vector3(-0.45, 0.62, -0.5).normalize(),
    }
    const c = live.current
    const k = 1 - Math.exp(-dt * 1.6)
    c.sunI += (target.sunI - c.sunI) * k; c.env += (target.env - c.env) * k; c.fogD += (target.fogD - c.fogD) * k; c.night += (target.night - c.night) * k
    c.fog.lerp(target.fog, k); c.dir.lerp(target.dir, k).normalize()
    if (env.weather === 'storm' && Math.random() < dt * 0.25) flash.current = 1
    flash.current = Math.max(0, flash.current - dt * 4)

    if (sunRef.current) {
      sunRef.current.position.copy(c.dir).multiplyScalar(140)
      sunRef.current.color.set(look.sun)
      sunRef.current.intensity = c.sunI
    }
    if (hemiRef.current) {
      hemiRef.current.intensity = look.hemi + flash.current * 3
      hemiRef.current.color.set(look.night > 0.8 ? '#2a3a66' : '#cfd8e6')
    }
    // sun disc sits "at infinity" along the sky-photo sun direction, so rays and reflections line up with it
    SUN_MESH.position.copy(camera.position).addScaledVector(c.dir, 900)
    SUN_MESH.visible = !!look.sky && c.dir.y > -0.02
    const sm = SUN_MESH.material as THREE.MeshBasicMaterial
    sm.color.set(look.sky === 'sunset' ? '#ffc58a' : '#fff6e6').multiplyScalar(look.sky === 'sunset' ? 2.2 : 3)
    sm.opacity = 1 - Math.min(1, wet * 0.9 + foggy * 0.7)
    scene.environmentIntensity = c.env + flash.current
    // rain/storm: the same sky photo, blurred and dimmed into an overcast dome
    scene.backgroundIntensity = look.bg * (1 - Math.min(1, wet) * 0.6) * (1 - foggy * 0.3)
    scene.backgroundBlurriness = Math.min(1, wet) * 0.5 + foggy * 0.3
    fog.color.copy(c.fog)
    fog.density = c.fogD
    if (skyRef.current) {
      skyRef.current.visible = !look.sky
      const u = (skyRef.current.material as THREE.ShaderMaterial).uniforms
      u.sunPosition.value.set(0.3, -0.25, -0.5) // below the horizon: deep blue night dome
    }
    if (starsRef.current) starsRef.current.visible = c.night > 0.6
    SHARED.window.emissiveIntensity = c.night * 2.6
    SHARED.lamp.emissiveIntensity = 0.2 + c.night * 5
  })

  const ultra = quality === 'ultra'
  const shadow = ultra ? 4096 : quality === 'high' ? 2048 : 1024
  return (
    <>
      <Suspense fallback={null}>
        <Environment files={look.sky ? SKY[look.sky].hdr : SKY.day.hdr} environmentRotation={[0, look.rot, 0]} />
      </Suspense>

      <primitive object={SUN_MESH} />
      {(quality === 'high' || ultra) && !hero && <SkyClouds count={ultra ? 9 : 6} storm={env.weather === 'rain' || env.weather === 'storm'} night={env.time === 'night'} />}
      <Sky ref={skyRef as never} distance={4500} turbidity={2} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.8} />
      <Stars ref={starsRef as never} radius={300} depth={60} count={quality === 'low' ? 1500 : 4000} factor={4} fade speed={0.4} />
      <hemisphereLight ref={hemiRef} intensity={0.1} groundColor="#3a3226" />
      <directionalLight ref={sunRef} castShadow={quality !== 'low'} shadow-mapSize={[shadow, shadow]} shadow-bias={-0.0003} shadow-normalBias={0.035}
        shadow-camera-left={-90} shadow-camera-right={90} shadow-camera-top={90} shadow-camera-bottom={-90} shadow-camera-far={320} />
      {env.weather !== 'clear' && env.weather !== 'fog' && <Rain count={ultra ? 6000 : quality === 'high' ? 3500 : quality === 'medium' ? 1800 : 700} />}
    </>
  )
}

function Rain({ count }: { count: number }) {
  const { camera } = useThree()
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(count * 6)
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 70, y = Math.random() * 40, z = (Math.random() - 0.5) * 70
      p.set([x, y, z, x + 0.05, y + 0.7, z], i * 6)
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [count])
  const ref = useRef<THREE.LineSegments>(null)
  useFrame((_, dt) => {
    const a = geo.attributes.position as THREE.BufferAttribute
    const arr = a.array as Float32Array
    const fall = Math.min(dt, 0.1) * 28
    for (let i = 0; i < count; i++) {
      const o = i * 6
      arr[o + 1] -= fall; arr[o + 4] -= fall
      if (arr[o + 1] < -2) { arr[o + 1] += 42; arr[o + 4] += 42 }
    }
    a.needsUpdate = true
    ref.current?.position.set(camera.position.x, camera.position.y - 20, camera.position.z)
  })
  return (
    <lineSegments ref={ref} geometry={geo} frustumCulled={false}>
      <lineBasicMaterial color="#b8c4d0" transparent opacity={0.4} />
    </lineSegments>
  )
}

/** Volumetric-looking 3D clouds (drei Clouds, self-made sprite) that catch sunlight and show in reflections. */
function SkyClouds({ count, storm, night }: { count: number; storm: boolean; night: boolean }) {
  const spots = useMemo(() => Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 + 0.4, R = 150 + (i % 3) * 45
    return [Math.cos(a) * R, 78 + (i % 4) * 9, Math.sin(a) * R] as [number, number, number]
  }), [count])
  const color = night ? '#2a3046' : storm ? '#7d838c' : '#ffffff'
  return (
    <Clouds texture="/assets/cloud.png" material={THREE.MeshLambertMaterial} limit={count * 22} frustumCulled={false}>
      {spots.map((p, i) => (
        <Cloud key={i} seed={i + 1} position={p} segments={storm ? 22 : 16} bounds={[storm ? 34 : 26, 5, storm ? 26 : 18]} volume={storm ? 22 : 15}
          smallestVolume={0.4} concentrate="inside" growth={3} speed={0.08} fade={420} opacity={storm ? 0.95 : 0.8} color={color} />
      ))}
    </Clouds>
  )
}
