import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Realistic object library: Poly Haven's CC0 photoscanned models, searched by spoken keyword and
// streamed on demand (CORS-enabled CDN). Only these two hosts are ever fetched; nothing else is
// executed — a glTF is data. Models are real-world scale in metres.

const API = 'https://api.polyhaven.com'
const CDN = 'https://dl.polyhaven.org/'
const MAX_BYTES = 12e6

// Hindi / Marathi / Hinglish → English search words (the catalogue is English)
const SYNONYMS: Record<string, string> = {
  kursi: 'chair', कुर्सी: 'chair', khurchi: 'chair', खुर्ची: 'chair', mez: 'table', मेज: 'table', palang: 'bed', पलंग: 'bed', bistar: 'bed',
  lalten: 'lantern', लालटेन: 'lantern', kandil: 'lantern', diya: 'diya lantern', दिया: 'diya lantern', gamla: 'planter pot', गमला: 'planter pot',
  almari: 'cabinet', अलमारी: 'cabinet', kapat: 'cabinet', ghadi: 'clock', घड़ी: 'clock', ghadyal: 'clock', peti: 'crate', पेटी: 'crate', dabba: 'box',
  dholak: 'drum', matka: 'pot', मटका: 'pot', handi: 'pot', balti: 'bucket', बाल्टी: 'bucket', seedhi: 'ladder', सीढ़ी: 'ladder', shida: 'ladder',
  pathar: 'boulder', patthar: 'boulder', chattan: 'boulder', jhadi: 'shrub', झाड़ी: 'shrub', phool: 'flower', फूल: 'flower', ped: 'tree',
  bench: 'bench', sofa: 'sofa', lamp: 'lamp', khamba: 'street lamp', haathi: 'elephant', हाथी: 'elephant', ghoda: 'horse', घोड़ा: 'horse',
}
// Requests we know the CC0 library cannot satisfy realistically — say so instead of faking it.
const NOT_AVAILABLE = ['cow', 'gaay', 'gai', 'गाय', 'buffalo', 'bhains', 'dog', 'kutta', 'कुत्ता', 'goat', 'bakri', 'car', 'gaadi', 'bus', 'truck', 'bike', 'motorcycle', 'scooter', 'person', 'human', 'aadmi', 'people']

interface Entry { id: string; name: string; words: string[] }
let catalog: Promise<Entry[]> | null = null
function loadCatalog() {
  catalog ??= fetch(`${API}/assets?t=models`).then((r) => r.json()).then((d: Record<string, { name: string; tags?: string[]; categories?: string[] }>) =>
    Object.entries(d).map(([id, a]) => ({ id, name: a.name, words: [...id.toLowerCase().split(/[_\d]+/), ...a.name.toLowerCase().split(/\W+/), ...(a.tags ?? []).map((t) => t.toLowerCase()), ...(a.categories ?? []).map((c) => c.toLowerCase())].filter(Boolean) })))
  return catalog
}

export type Resolution = { ok: true; id: string; name: string } | { ok: false; reason: string }

/** Best CC0 model for a spoken query (deterministic: highest score, then shortest id). */
export async function resolveAsset(query: string): Promise<Resolution> {
  const raw = query.toLowerCase().trim()
  const words = raw.split(/\s+/).flatMap((w) => (SYNONYMS[w] ?? w).split(' ')).filter((w) => w.length > 1)
  if (words.some((w) => NOT_AVAILABLE.includes(w))) return { ok: false, reason: `No realistic free (CC0) model of “${query}” is available yet, so BoliVerse won't fake one with a cartoon.` }
  const list = await loadCatalog()
  let best: Entry | null = null, bestScore = 0
  for (const e of list) {
    let s = 0
    for (const w of words) {
      if (e.id.toLowerCase().includes(w)) s += 3
      else if (e.words.includes(w)) s += 2
      else if (e.words.some((x) => x.startsWith(w) || w.startsWith(x) && x.length > 3)) s += 1
    }
    if (s > bestScore || (s === bestScore && s > 0 && best && e.id.length < best.id.length)) { best = e; bestScore = s }
  }
  if (!best || bestScore < 2) return { ok: false, reason: `No realistic CC0 model matches “${query}”.` }
  return { ok: true, id: best.id, name: best.name }
}

const gltfLoader = new GLTFLoader()
const modelCache = new Map<string, Promise<THREE.Group>>()
/** Load (once) and return a fresh clone of a Poly Haven model at 1k textures. */
export async function loadModel(id: string): Promise<THREE.Group> {
  if (!/^[A-Za-z0-9_]+$/.test(id)) throw new Error('bad asset id')
  let p = modelCache.get(id)
  if (!p) {
    p = fetch(`${API}/files/${id}`).then((r) => r.json()).then(async (f) => {
      const g = f?.gltf?.['1k']?.gltf ?? f?.gltf?.['2k']?.gltf
      if (!g?.url?.startsWith(CDN)) throw new Error('model unavailable')
      const size = g.size + Object.values(g.include ?? {}).reduce((n: number, v) => n + ((v as { size?: number }).size ?? 0), 0)
      if (size > MAX_BYTES) throw new Error('model too heavy for real-time use')
      const gltf = await gltfLoader.loadAsync(g.url)
      gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true } })
      return gltf.scene
    })
    modelCache.set(id, p)
    p.catch(() => modelCache.delete(id))
  }
  return (await p).clone(true)
}

/** Fixed, verified CC0 picks for built-in furniture types. */
export const FURNITURE: Partial<Record<string, string>> = {
  sofa: 'sofa_03', table: 'WoodenTable_01', bed: 'GothicBed_01', chandelier: 'lantern_chandelier_01',
}
