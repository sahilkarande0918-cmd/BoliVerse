import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshReflectorMaterial } from '@react-three/drei'
import * as THREE from 'three'
import { RigidBody } from '@react-three/rapier'
import { BANK_D, riverX, rng, terrainHeight, WATER_Y } from './world'
import { pbrMaps } from './pbr'

const SIZE = 300

/** Shared clock for shader animation (water flow, wind); advanced by Atmosphere each frame. */
export const SHADER_TIME = { value: 0 }
/** 0 = dry, 1 = soaked (rain): darkens albedo and makes ground glossy so it reflects the sky. */
export const WETNESS = { value: 0 }

// ---------- terrain: scanned grass / forest floor / river mud blended per vertex ----------
function terrainMaterial() {
  const grass = pbrMaps('grass', 7)
  const dirt = pbrMaps('ground', 5)
  const mud = pbrMaps('mud', 4)
  const m = new THREE.MeshStandardMaterial({ ...grass, vertexColors: true, roughness: 1, metalness: 0 })
  m.normalScale.setScalar(0.9)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDirt = { value: dirt.map }
    sh.uniforms.tMud = { value: mud.map }
    sh.uniforms.uWet = WETNESS
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tDirt; uniform sampler2D tMud; uniform float uWet;')
      .replace('#include <color_fragment>', '') // vertex colours carry blend weights, not albedo
      .replace('#include <map_fragment>', /* glsl */ `
        vec3 bw = vColor.rgb / max(1e-3, vColor.r + vColor.g + vColor.b);
        vec3 g1 = texture2D(map, vMapUv).rgb;
        vec3 g2 = texture2D(map, vMapUv * 0.21 + vec2(0.37, 0.11)).rgb; // macro layer breaks up tiling
        vec3 grassC = mix(g1, g2, 0.38) * vec3(0.86, 1.02, 0.74); // post-monsoon green grade on the scanned grass
        vec3 dirtC = texture2D(tDirt, vMapUv * 1.4).rgb;
        vec3 mudC = texture2D(tMud, vMapUv * 1.75).rgb;
        diffuseColor.rgb *= (grassC * bw.r + dirtC * bw.g + mudC * bw.b) * mix(1.0, 0.72, uWet);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor *= mix(1.0, 0.45, bw.b) * mix(1.0, 0.38, uWet); // wet mud / rain-soaked ground is glossier')
  }
  return m
}

export function Terrain({ segments }: { segments: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    const w = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const y = terrainHeight(x, z)
      pos.setY(i, y)
      uv.setXY(i, x, z) // metres
      const d = Math.abs(x - riverX(z))
      const patch = (Math.sin(x * 0.13 + 1.3) * Math.cos(z * 0.11) + Math.sin(x * 0.041 + z * 0.057) * 0.8) * 0.5 + 0.5
      let mud = 1 - THREE.MathUtils.smoothstep(d, BANK_D - 1.2, BANK_D + 1.6)
      if (y < WATER_Y + 0.3) mud = 1
      const dirt = (1 - mud) * Math.max(THREE.MathUtils.smoothstep(patch, 0.74, 0.92) * 0.8, THREE.MathUtils.smoothstep(y, 4, 9) * 0.45, (1 - THREE.MathUtils.smoothstep(d, BANK_D + 1.6, BANK_D + 4)) * 0.8)
      const grass = Math.max(0, 1 - mud - dirt)
      w.set([grass, dirt, mud], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(w, 3))
    g.computeVertexNormals()
    return g
  }, [segments])
  const mat = useMemo(terrainMaterial, [])
  return (
    <RigidBody type="fixed" colliders="trimesh" name="terrain">
      <mesh geometry={geo} material={mat} receiveShadow />
    </RigidBody>
  )
}

// ---------- river: PBR water with two flowing normal layers, depth tint and soft shoreline ----------
export function waterUniforms() {
  return { uTime: SHADER_TIME }
}


let waterNormals: THREE.Texture | null = null
function waterMaterial() {
  waterNormals ??= new THREE.TextureLoader().load('/assets/pbr/waternormals.jpg', (t) => { t.needsUpdate = true })
  waterNormals.wrapS = waterNormals.wrapT = THREE.RepeatWrapping
  waterNormals.repeat.set(1 / 9, 1 / 9)
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, transparent: true, roughness: 0.06, metalness: 0, normalMap: waterNormals, depthWrite: false, envMapIntensity: 1.1 })
  m.normalScale.setScalar(0.45)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHADER_TIME
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      // two normal layers scrolling downstream at different scales → no repeating stripes
      .replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
        'vec3 mapN = texture2D( normalMap, vNormalMapUv + vec2(0.0, -uTime * 0.035) ).xyz + texture2D( normalMap, vNormalMapUv * 2.3 + vec2(uTime * 0.012, -uTime * 0.06) ).xyz - 1.0;')
  }
  return m
}

function riverRibbon(planar: boolean) {
  const rows = 220, cols = 6, half = BANK_D - 0.4
  const verts: number[] = [], uvs: number[] = [], cols4: number[] = [], idx: number[] = []
  const deep = new THREE.Color('#0d2a2c'), shallow = new THREE.Color('#47533c')
  for (let i = 0; i <= rows; i++) {
    const z = -SIZE / 2 + (SIZE * i) / rows
    const cx = riverX(z)
    for (let j = 0; j <= cols; j++) {
      const a = j / cols, x = cx - half + a * half * 2
      const edge = 1 - Math.abs(a - 0.5) * 2 // 0 at banks, 1 at centre
      // planar: built in local XY so a reflector's +Z normal faces up once rotated −90° about X
      if (planar) verts.push(x, -z, 0)
      else verts.push(x, WATER_Y, z)
      uvs.push(x, z)
      const c = shallow.clone().lerp(deep, THREE.MathUtils.smoothstep(edge, 0.05, 0.75))
      cols4.push(c.r, c.g, c.b, 0.35 + 0.6 * THREE.MathUtils.smoothstep(edge, 0, 0.45))
      if (i < rows && j < cols) { const a0 = i * (cols + 1) + j, b0 = a0 + cols + 1; idx.push(a0, b0, a0 + 1, a0 + 1, b0, b0 + 1) /* front faces point up in both layouts */ }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols4, 4))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const REFLECT_RES: Record<string, number> = { medium: 512, high: 1024, ultra: 2048 }

/** River. Low: PBR water with flowing normals. Medium+: true planar mirror reflections (sky, sun, trees,
 *  houses) distorted by the same flowing normals, tinted by depth and faded at the shoreline. */
export function Water({ quality }: { quality: string }) {
  const planar = quality !== 'low'
  const geo = useMemo(() => riverRibbon(planar), [planar])
  const mat = useMemo(waterMaterial, [])
  useFrame((_, dt) => { if (waterNormals) waterNormals.offset.y -= Math.min(dt, 0.1) * 0.035 })
  if (!planar) return <mesh geometry={geo} material={mat} renderOrder={1} receiveShadow />
  const res = REFLECT_RES[quality] ?? 1024
  return (
    <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, WATER_Y, 0]} renderOrder={1}>
      <MeshReflectorMaterial
        resolution={res} blur={quality === 'ultra' ? [30, 10] : [50, 18]} mixBlur={0.15} mixStrength={1.7} mixContrast={1.05} mirror={0.85}
        depthScale={0} distortion={0.07} distortionMap={waterNormals!} normalMap={waterNormals!} normalScale={new THREE.Vector2(0.18, 0.18)}
        color="#ffffff" vertexColors transparent depthWrite={false} roughness={0.12} metalness={0} envMapIntensity={0.6}
      />
    </mesh>
  )
}

// ---------- grass: instanced blade clumps with tapered, curved blades and wind sway ----------
function bladeClump() {
  const r = rng(5)
  const pos: number[] = [], col: number[] = [], idx: number[] = []
  const base = new THREE.Color('#2b3a17'), tip = new THREE.Color('#9aa65a')
  for (let b = 0; b < 13; b++) {
    const a = r() * Math.PI * 2, lean = 0.15 + r() * 0.35, h = 0.35 + r() * 0.45, w = 0.025 + r() * 0.02
    const ox = (r() - 0.5) * 0.25, oz = (r() - 0.5) * 0.25
    const dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx
    const start = pos.length / 3
    for (let s = 0; s <= 3; s++) {
      const t = s / 3, bend = lean * t * t, ww = w * (1 - t * 0.9)
      const cx = ox + dx * bend * h, cz = oz + dz * bend * h, y = h * t
      pos.push(cx - px * ww, y, cz - pz * ww, cx + px * ww, y, cz + pz * ww)
      const c = base.clone().lerp(tip, t * (0.7 + r() * 0.3))
      col.push(c.r, c.g, c.b, c.r, c.g, c.b)
      if (s < 3) { const k = start + s * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2) }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/** Wind sway for instanced vegetation: displaces vertices by height above the instance origin. */
export function addWind(m: THREE.Material, strength: number) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHADER_TIME
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        #else
          vec3 ip = vec3(0.0);
        #endif
        float sway = sin(uTime * 1.7 + ip.x * 0.31 + ip.z * 0.23) * 0.6 + sin(uTime * 3.1 + ip.x * 0.7) * 0.25;
        transformed.x += sway * ${strength.toFixed(3)} * transformed.y * transformed.y;
        transformed.z += sway * ${(strength * 0.6).toFixed(3)} * transformed.y * transformed.y;`)
  }
  m.customProgramCacheKey = () => `wind${strength}`
  return m
}

export function GrassField({ count, avoid }: { count: number; avoid: [number, number, number][] }) {
  const mesh = useMemo(() => {
    const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }), 0.35)
    const im = new THREE.InstancedMesh(bladeClump(), mat, count)
    const r = rng(91)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color()
    let n = 0
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      // denser near the village, sparser out on the hills
      const z = (r() - 0.5) * 170, side = r() < 0.5 ? -1 : 1
      const d = BANK_D - 0.5 + Math.pow(r(), 1.6) * 62, x = riverX(z) + side * d
      if (Math.abs(d - 15) < 2.2) continue
      if (avoid.some(([ax, az, rad]) => (ax - x) ** 2 + (az - z) ** 2 < rad * rad)) continue
      const y = terrainHeight(x, z)
      if (y < WATER_Y + 0.15) continue
      const s = 0.8 + r() * 0.9
      m.compose(new THREE.Vector3(x, y - 0.02, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s * (0.7 + r() * 0.7), s))
      im.setMatrixAt(n, m)
      im.setColorAt(n, col.setHSL(0.17 + r() * 0.08, 0.35 + r() * 0.2, 0.42 + r() * 0.2))
      n++
    }
    im.count = n
    im.receiveShadow = true
    // wildflowers: small instanced blooms on stems, seeded among the grass
    const fl = new THREE.InstancedMesh(flowerGeo(), addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), 0.35), Math.ceil(count / 9))
    const hues = ['#f2d24a', '#f5f1ea', '#e58fb4', '#b78ee0', '#f08a3c']
    let k = 0
    for (let tries = 0; k < fl.count && tries < fl.count * 6; tries++) {
      const z = (r() - 0.5) * 160, side = r() < 0.5 ? -1 : 1, d = BANK_D + 1 + r() * 45, x = riverX(z) + side * d
      if (Math.abs(d - 15) < 2.4 || avoid.some(([ax, az, rad]) => (ax - x) ** 2 + (az - z) ** 2 < rad * rad)) continue
      const y = terrainHeight(x, z), s2 = 0.7 + r() * 0.6
      m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s2, s2, s2))
      fl.setMatrixAt(k, m); fl.setColorAt(k, col.set(hues[Math.floor(r() * hues.length)])); k++
    }
    fl.count = k
    // layer 1: drawn by the main camera, skipped by the mirror-reflection camera (big saving, invisible in reflections)
    im.layers.set(1); fl.layers.set(1)
    const group = new THREE.Group()
    group.add(im, fl)
    return group
  }, [count, avoid])
  return <primitive object={mesh} />
}

function flowerGeo() {
  // stem + four-petal head (white vertex colour; instance colour tints the petals)
  const g = new THREE.BufferGeometry()
  const p: number[] = [0, 0, 0, 0.012, 0.42, 0, -0.012, 0.42, 0]
  const c: number[] = [0.2, 0.35, 0.12, 0.2, 0.35, 0.12, 0.2, 0.35, 0.12]
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2, x = Math.cos(a) * 0.07, z = Math.sin(a) * 0.07
    p.push(0, 0.43, 0, x + z * 0.4, 0.45, z - x * 0.4, x - z * 0.4, 0.45, z + x * 0.4)
    c.push(1, 0.95, 0.6, 1, 1, 1, 1, 1, 1)
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3))
  g.computeVertexNormals()
  return g
}
