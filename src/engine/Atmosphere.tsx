import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { Sky, Stars } from '@react-three/drei'
import type { Sky as SkyImpl } from 'three-stdlib'
import type { World } from './world'
import type { Quality } from '../store'
import { SHARED } from './Entities'
import type { waterUniforms } from './Terrain'

interface Look { elev: number; azim: number; sun: string; sunI: number; sky: string; ground: string; hemiI: number; fog: string; fogD: number; night: number; turb: number }
const TIMES: Record<World['env']['time'], Look> = {
  dawn: { elev: 5, azim: 100, sun: '#ffb37a', sunI: 1.6, sky: '#a8b9d8', ground: '#4a3a2a', hemiI: 0.55, fog: '#d9b49a', fogD: 0.0045, night: 0.35, turb: 8 },
  morning: { elev: 32, azim: 120, sun: '#fff0d6', sunI: 3.0, sky: '#bcd6ff', ground: '#5a4a35', hemiI: 0.75, fog: '#c7d5e2', fogD: 0.0026, night: 0, turb: 4 },
  noon: { elev: 70, azim: 160, sun: '#ffffff', sunI: 3.4, sky: '#c4dcff', ground: '#5d4d38', hemiI: 0.85, fog: '#d3e1ee', fogD: 0.0024, night: 0, turb: 3 },
  sunset: { elev: 3.5, azim: 255, sun: '#ff8238', sunI: 2.6, sky: '#f0a070', ground: '#3a2418', hemiI: 0.5, fog: '#e39a6c', fogD: 0.0042, night: 0.45, turb: 10 },
  night: { elev: -14, azim: 300, sun: '#8ea6ff', sunI: 0.45, sky: '#1f2a4a', ground: '#07080c', hemiI: 0.28, fog: '#0d1322', fogD: 0.0065, night: 1, turb: 2 },
}

interface Live { dir: THREE.Vector3; sun: THREE.Color; sunI: number; sky: THREE.Color; ground: THREE.Color; hemiI: number; fog: THREE.Color; fogD: number; night: number; rain: number; turb: number }

export function Atmosphere({ env, quality, water }: { env: World['env']; quality: Quality; water: ReturnType<typeof waterUniforms> }) {
  const { scene } = useThree()
  const sunRef = useRef<THREE.DirectionalLight>(null)
  const hemiRef = useRef<THREE.HemisphereLight>(null)
  const skyRef = useRef<SkyImpl>(null)
  const starsRef = useRef<THREE.Points>(null)
  const fog = useMemo(() => new THREE.FogExp2('#c7d5e2', 0.0045), [])
  scene.fog = fog
  const live = useRef<Live | null>(null)
  const flash = useRef(0)

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const t = TIMES[env.time]
    const wet = env.weather === 'rain' ? 1 : env.weather === 'storm' ? 1.4 : 0
    const foggy = env.weather === 'fog' ? 1 : 0
    const L = env.lighting === 'dramatic' ? { sun: 1.25, hemi: 0.6 } : env.lighting === 'soft' ? { sun: 0.8, hemi: 1.3 } : { sun: 1, hemi: 1 }
    const el = THREE.MathUtils.degToRad(t.elev), az = THREE.MathUtils.degToRad(t.azim)
    const target: Live = {
      dir: new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)).normalize(),
      sun: new THREE.Color(t.sun),
      sunI: t.sunI * L.sun * (1 - wet * 0.55) * (1 - foggy * 0.4),
      sky: new THREE.Color(t.sky).lerp(new THREE.Color('#7d8792'), wet * 0.5),
      ground: new THREE.Color(t.ground),
      hemiI: t.hemiI * L.hemi,
      fog: new THREE.Color(t.fog).lerp(new THREE.Color(t.night > 0.8 ? '#0b0f18' : '#8b939b'), Math.min(1, wet * 0.6 + foggy * 0.5)),
      fogD: t.fogD * (1 + wet * 1.2) + foggy * 0.022,
      night: t.night,
      rain: Math.min(1, wet),
      turb: t.turb + wet * 8,
    }
    if (!live.current) live.current = target
    const c = live.current
    const k = 1 - Math.exp(-dt * 1.4) // smooth, frame-rate independent transition
    c.dir.lerp(target.dir, k).normalize()
    c.sun.lerp(target.sun, k); c.sky.lerp(target.sky, k); c.ground.lerp(target.ground, k); c.fog.lerp(target.fog, k)
    c.sunI += (target.sunI - c.sunI) * k; c.hemiI += (target.hemiI - c.hemiI) * k; c.fogD += (target.fogD - c.fogD) * k
    c.night += (target.night - c.night) * k; c.rain += (target.rain - c.rain) * k; c.turb += (target.turb - c.turb) * k

    if (env.weather === 'storm' && Math.random() < dt * 0.25) flash.current = 1
    flash.current = Math.max(0, flash.current - dt * 4)

    const isMoon = c.dir.y < 0
    const lightDir = isMoon ? c.dir.clone().negate().setY(Math.abs(c.dir.y) + 0.5).normalize() : c.dir
    if (sunRef.current) {
      sunRef.current.position.copy(lightDir).multiplyScalar(120)
      sunRef.current.color.copy(c.sun)
      sunRef.current.intensity = c.sunI
    }
    if (hemiRef.current) {
      hemiRef.current.color.copy(c.sky)
      hemiRef.current.groundColor.copy(c.ground)
      hemiRef.current.intensity = c.hemiI + flash.current * 3
    }
    fog.color.copy(c.fog)
    fog.density = c.fogD
    const sky = skyRef.current
    if (sky) {
      const u = (sky.material as THREE.ShaderMaterial).uniforms
      u.sunPosition.value.copy(c.dir).multiplyScalar(1000)
      u.turbidity.value = c.turb
      u.rayleigh.value = 1.2 + c.rain * 2
    }
    if (starsRef.current) starsRef.current.visible = c.night > 0.6
    SHARED.window.emissiveIntensity = c.night * 2.6
    SHARED.lamp.emissiveIntensity = 0.2 + c.night * 5
    water.uTime.value += dt
    water.uSunDir.value.copy(lightDir)
    water.uSunColor.value.copy(c.sun).multiplyScalar(isMoon ? 0.3 : 1)
    water.uSky.value.copy(c.fog)
    water.uRain.value = c.rain
  })

  const shadow = quality === 'high' ? 2048 : 1024
  return (
    <>
      <Sky ref={skyRef as never} distance={4500} mieCoefficient={0.006} mieDirectionalG={0.86} />
      <Stars ref={starsRef as never} radius={300} depth={60} count={quality === 'low' ? 1500 : 4000} factor={4} fade speed={0.4} />
      <hemisphereLight ref={hemiRef} intensity={0.7} />
      <directionalLight ref={sunRef} castShadow={quality !== 'low'} shadow-mapSize={[shadow, shadow]} shadow-bias={-0.0004} shadow-normalBias={0.04}
        shadow-camera-left={-95} shadow-camera-right={95} shadow-camera-top={95} shadow-camera-bottom={-95} shadow-camera-far={300} />
      {env.weather !== 'clear' && env.weather !== 'fog' && <Rain count={quality === 'high' ? 3500 : quality === 'medium' ? 1800 : 700} />}
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
