import { useMemo } from 'react'
import * as THREE from 'three'
import { RigidBody } from '@react-three/rapier'
import { BANK_D, riverX, rng, terrainHeight, WATER_Y } from './world'
import { TEX } from './textures'

const SIZE = 300

export function Terrain({ segments }: { segments: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE, SIZE, segments, segments)
    g.rotateX(-Math.PI / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const grassA = new THREE.Color('#4d6b2c'), grassB = new THREE.Color('#6f8038'), dry = new THREE.Color('#8f7d52')
    const sand = new THREE.Color('#a8926c'), mud = new THREE.Color('#3b3024'), c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i)
      const y = terrainHeight(x, z)
      pos.setY(i, y)
      const d = Math.abs(x - riverX(z))
      const n = (Math.sin(x * 0.21) * Math.cos(z * 0.17) + Math.sin(x * 0.05 + z * 0.07)) * 0.25 + 0.5
      c.copy(grassA).lerp(grassB, n).lerp(dry, Math.max(0, (y - 2) / 8))
      if (d < BANK_D + 2.5) c.lerp(sand, 1 - Math.max(0, (d - BANK_D) / 2.5))
      if (y < WATER_Y + 0.25) c.copy(mud)
      colors.set([c.r, c.g, c.b], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [segments])

  return (
    <RigidBody type="fixed" colliders="trimesh" name="terrain">
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors map={TEX.grass} roughness={0.95} metalness={0} />
      </mesh>
    </RigidBody>
  )
}

// ---------- water: flowing river ribbon with fresnel + sun glint ----------
const waterVert = /* glsl */ `
  varying vec3 vWorld; varying vec2 vUv;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`
const waterFrag = /* glsl */ `
  uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uSky; uniform vec3 uDeep; uniform vec3 uShallow; uniform float uRain;
  varying vec3 vWorld; varying vec2 vUv;
  #include <fog_pars_fragment>
  float h(vec2 p){ return sin(p.x*1.7+uTime*1.3)*0.5 + sin(p.y*2.3 - uTime*2.1 + p.x*0.6)*0.35 + sin((p.x+p.y)*4.1 - uTime*3.4)*0.15 + sin(p.y*9.0 - uTime*6.0 + p.x*3.0)*0.08*(1.0+uRain*3.0); }
  void main() {
    vec2 p = vWorld.xz * 0.9 + vec2(0.0, -uTime * 1.6);
    float e = 0.05;
    vec3 n = normalize(vec3(h(p) - h(p + vec2(e, 0.0)), 0.35, h(p) - h(p + vec2(0.0, e))));
    vec3 v = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    float edge = smoothstep(0.0, 0.35, min(vUv.x, 1.0 - vUv.x));
    vec3 col = mix(uShallow, uDeep, edge);
    col = mix(col, uSky, 0.12 + fres * 0.7);
    vec3 r = reflect(-uSunDir, n);
    col += uSunColor * pow(max(dot(r, v), 0.0), 120.0) * 2.5;
    float foam = smoothstep(0.82, 1.0, h(p * 1.7)) * (1.0 - edge) * 0.35;
    col += foam;
    gl_FragColor = vec4(col, 0.92);
    #include <fog_fragment>
  }`

export function waterUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2) },
    uSunColor: { value: new THREE.Color('#fff2d8') },
    uSky: { value: new THREE.Color('#9fc0dc') },
    uDeep: { value: new THREE.Color('#123845') },
    uShallow: { value: new THREE.Color('#3f7a72') },
    uRain: { value: 0 },
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
  }
}

export function Water({ uniforms }: { uniforms: ReturnType<typeof waterUniforms> }) {
  const geo = useMemo(() => {
    // ribbon following the river centre line
    const rows = 160, half = BANK_D - 0.6
    const verts: number[] = [], uvs: number[] = [], idx: number[] = []
    for (let i = 0; i <= rows; i++) {
      const z = -SIZE / 2 + (SIZE * i) / rows
      const cx = riverX(z)
      verts.push(cx - half, WATER_Y, z, cx + half, WATER_Y, z)
      uvs.push(0, i / rows, 1, i / rows)
      if (i < rows) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} renderOrder={1}>
      <shaderMaterial vertexShader={waterVert} fragmentShader={waterFrag} uniforms={uniforms} transparent fog depthWrite={false} />
    </mesh>
  )
}

// ---------- instanced grass tufts (self-made geometry; skipped on Low) ----------
export function GrassField({ count, avoid }: { count: number; avoid: [number, number, number][] }) {
  const mesh = useMemo(() => {
    const blade = new THREE.BufferGeometry()
    const v: number[] = []
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI, cx = Math.cos(a) * 0.18, cz = Math.sin(a) * 0.18
      v.push(-cx, 0, -cz, cx, 0, cz, 0, 0.55, 0)
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    blade.computeVertexNormals()
    const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1 })
    const im = new THREE.InstancedMesh(blade, mat, count)
    const r = rng(91)
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color()
    let n = 0
    for (let tries = 0; n < count && tries < count * 4; tries++) {
      const z = (r() - 0.5) * 170, side = r() < 0.5 ? -1 : 1
      const d = BANK_D + 0.5 + r() * 60, x = riverX(z) + side * d
      if (Math.abs(d - 15) < 2.4) continue
      if (avoid.some(([ax, az, rad]) => (ax - x) ** 2 + (az - z) ** 2 < rad * rad)) continue
      const y = terrainHeight(x, z)
      if (y < WATER_Y + 0.3) continue
      const s = 0.6 + r() * 1.1
      m.compose(new THREE.Vector3(x, y, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28), new THREE.Vector3(s, s * (0.7 + r() * 0.8), s))
      im.setMatrixAt(n, m)
      im.setColorAt(n, col.setHSL(0.19 + r() * 0.06, 0.5, 0.13 + r() * 0.08))
      n++
    }
    im.count = n
    im.receiveShadow = true
    return im
  }, [count, avoid])
  return <primitive object={mesh} />
}
