import * as THREE from 'three'

// Physically based material sets from CC0 Poly Haven scans (public/assets/pbr, see docs/ASSET_LICENSES.md).
// Each set: diffuse (sRGB), OpenGL normal, ARM = AO (R) / roughness (G) / metalness (B).
// UVs in BoliVerse geometry are in metres, so `tile` = metres covered by one texture repeat.

const BASE = '/assets/pbr/'
const loader = new THREE.TextureLoader()
const srcCache = new Map<string, THREE.Texture>()
const texCache = new Map<string, THREE.Texture>()

function tex(file: string, srgb: boolean, tile: number) {
  const key = `${file}|${tile}|${srgb}`
  let t = texCache.get(key)
  if (!t) {
    let src = srcCache.get(file)
    if (!src) { src = loader.load(BASE + file); srcCache.set(file, src) }
    t = src.clone() // shares the image Source: uploads once loaded, per-clone repeat/colour space
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1 / tile, 1 / tile)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.anisotropy = 8
    texCache.set(key, t)
  }
  return t
}

export type PbrName = 'grass' | 'ground' | 'mud' | 'gravel' | 'plaster' | 'rooftiles' | 'planks' | 'bark' | 'rock' | 'stone' | 'brick' | 'marble'

export function pbrMaps(name: PbrName, tile: number) {
  return {
    map: tex(`${name}_diff.jpg`, true, tile),
    normalMap: tex(`${name}_nor.jpg`, false, tile),
    roughnessMap: tex(`${name}_arm.jpg`, false, tile),
    aoMap: tex(`${name}_arm.jpg`, false, tile),
  }
}

const matCache = new Map<string, THREE.MeshStandardMaterial>()
/** Cached PBR material. `tint` multiplies the scanned albedo (e.g. coloured plaster). */
export function pbr(name: PbrName, tile: number, o: { tint?: string; normal?: number; rough?: number; side?: THREE.Side } = {}) {
  const key = `${name}|${tile}|${o.tint}|${o.normal}|${o.rough}|${o.side}`
  let m = matCache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ ...pbrMaps(name, tile), color: o.tint ?? '#ffffff', roughness: o.rough ?? 1, metalness: 0, aoMapIntensity: 0.8, side: o.side ?? THREE.FrontSide })
    m.normalScale.setScalar(o.normal ?? 1)
    matCache.set(key, m)
  }
  return m
}

// ---------- geometry with metre-scaled UVs (no stretched textures) ----------
const boxCache = new Map<string, THREE.BoxGeometry>()
/** Box of the given size whose UVs are in metres, so tiled PBR maps keep real-world scale. */
export function uvBox(w: number, h: number, d: number) {
  const key = `${w.toFixed(2)}|${h.toFixed(2)}|${d.toFixed(2)}`
  let g = boxCache.get(key)
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d)
    const uv = g.attributes.uv as THREE.BufferAttribute
    const n = g.attributes.normal as THREE.BufferAttribute
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) {
      const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i))
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      if (ax > 0.5) uv.setXY(i, z, y)
      else if (ay > 0.5) uv.setXY(i, x, z)
      else uv.setXY(i, x, y)
    }
    boxCache.set(key, g)
  }
  return g
}
