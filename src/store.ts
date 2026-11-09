import { create } from 'zustand'
import { applyOperation, type Effect } from './compiler/apply'
import { parseLocal } from './compiler/localParser'
import type { CameraPreset, Operation } from './compiler/schema'
import { type World, emptyWorld, riverX } from './engine/world'
import { ApiError, type Health, interpretRemote, speak } from './voice/api'
import { idbGet, idbSet } from './persist'

export type Phase = 'idle' | 'listening' | 'transcribing' | 'interpreting' | 'applying' | 'done' | 'error'
export type Mode = 'build' | 'simulate' | 'film'
export type Quality = 'ultra' | 'high' | 'medium' | 'low'

export interface LogEntry {
  id: number
  transcript: string
  normalized?: string
  source: 'voice' | 'text' | 'chip'
  planner: 'local' | 'groq' | 'none'
  language?: string
  provider?: string
  ops: Operation[]
  notes: string[]
  errors: string[]
  affected: string[]
  /** stt: Gnani round trip · parse: local/Groq planning · apply: world transaction · total: speech end → world applied · frame: render of first frame after apply (separate) */
  t: { stt?: number; parse?: number; apply?: number; frame?: number; total?: number }
  status: 'pending' | 'ok' | 'partial' | 'error'
}

export interface Shot { seq: number; preset: CameraPreset; durationSec: number; targetId?: string; record: boolean; aspect: '16:9' | '9:16' }
export interface Recording { state: 'idle' | 'recording' | 'encoding' | 'ready' | 'error'; progress: number; url?: string; format?: string; sizeBytes?: number; durationSec?: number; message?: string; fileName?: string }

interface State {
  world: World
  past: World[]
  future: World[]
  selectedId: string | null
  log: LogEntry[]
  phase: Phase
  message: string
  level: number
  mode: Mode
  quality: Quality
  paused: boolean
  health: Health | null
  language: string
  speakReplies: boolean
  cameraCmd: { seq: number; view: string; targetId?: string }
  shot: Shot | null
  recording: Recording
  force: { seq: number; ids: string[]; strength: number }
  fps: number
  set: (p: Partial<State>) => void
  select: (id: string | null) => void
  undo: (steps?: number) => void
  redo: (steps?: number) => void
  run: (text: string, source: LogEntry['source'], extra?: { stt?: number; t0?: number; language?: string; provider?: string }, presetOps?: Operation[]) => Promise<void>
  sttCalls: number
  save: (name?: string) => Promise<void>
  load: (name?: string) => Promise<void>
  importJson: (json: string) => void
}

let utterSeq = 0
let latest = 0
const ACTIONS_THAT_EDIT = new Set(['CREATE_SCENE', 'CREATE_OBJECT', 'BATCH_CREATE', 'MODIFY_OBJECT', 'TRANSFORM_OBJECT', 'DUPLICATE_OBJECT', 'DELETE_OBJECT', 'DESTROY_STRUCTURE', 'REPAIR_STRUCTURE', 'SET_WEATHER', 'SET_LIGHTING', 'SET_TIME_OF_DAY'])

export function sceneSummary(w: World, selectedId: string | null, lastOps: Operation[]) {
  const counts: Record<string, number> = {}
  for (const e of w.entities) counts[e.type] = (counts[e.type] ?? 0) + 1
  return {
    entities: w.entities
      .filter((e) => e.type !== 'tree' && e.type !== 'rock' && e.type !== 'road')
      .slice(0, 50)
      .map((e) => ({ id: e.id, type: e.type, x: Math.round(e.pos[0]), z: Math.round(e.pos[2]), bank: e.pos[0] < riverX(e.pos[2]) ? 'west' : 'east', state: e.state, material: e.material, color: e.color, scale: +e.scale.toFixed(2) })),
    counts,
    recent: w.recent.slice(-5),
    selected: selectedId,
    env: w.env,
    lastOps: lastOps.slice(0, 4),
  }
}

export const useStudio = create<State>()((set, get) => ({
  world: emptyWorld(),
  past: [],
  future: [],
  selectedId: null,
  log: [],
  phase: 'idle',
  message: 'Ready — speak or type a command',
  level: 0,
  mode: 'build',
  // medium by default (High is opt-in); phones and ≤4-core machines start on Low. PerformanceMonitor adapts further.
  quality: 'ultra', // user rule: everything builds at Ultra (Inspector can still lower it manually)
  paused: false,
  health: null,
  language: 'indic-auto',
  speakReplies: false,
  cameraCmd: { seq: 0, view: 'overview' },
  shot: null,
  recording: { state: 'idle', progress: 0 },
  force: { seq: 0, ids: [], strength: 0 },
  fps: 0,
  sttCalls: 0,
  set: (p) => set(p),
  select: (id) => set({ selectedId: id }),

  undo: (steps = 1) => {
    const { past, future, world } = get()
    if (!past.length) return
    const n = Math.min(steps, past.length)
    const target = past[past.length - n]
    set({ world: target, past: past.slice(0, past.length - n), future: [...past.slice(past.length - n + 1), world, ...future].slice(0, 50) })
  },
  redo: (steps = 1) => {
    const { past, future, world } = get()
    if (!future.length) return
    const n = Math.min(steps, future.length)
    set({ world: future[n - 1], future: future.slice(n), past: [...past, world, ...future.slice(0, n - 1)].slice(-50) })
  },

  async run(text, source, extra = {}, presetOps) {
    const id = ++utterSeq
    latest = id
    const t0 = extra.t0 ?? performance.now()
    const lastOps = [...get().log].reverse().find((l) => l.status !== 'error' && l.ops.length)?.ops ?? []
    const entry: LogEntry = { id, transcript: text, source, planner: 'local', language: extra.language, provider: extra.provider, ops: [], notes: [], errors: [], affected: [], t: { stt: extra.stt }, status: 'pending' }
    const patch = (p: Partial<LogEntry>) => set({ log: get().log.map((l) => (l.id === id ? { ...l, ...p, t: { ...l.t, ...p.t } } : l)) })
    set({ log: [...get().log.slice(-60), entry], phase: 'interpreting', message: 'Understanding…' })

    const tp = performance.now()
    const local = presetOps ? { ops: presetOps, confidence: 1, normalized: text, unknown: [] } : parseLocal(text, { lastOps })
    let ops = local.ops
    let planner: LogEntry['planner'] = 'local'
    const notes: string[] = []
    if ((local.confidence < 0.6 || !ops.length) && get().health?.groq) {
      try {
        set({ message: 'Planning with Groq…' })
        const r = await interpretRemote(text, sceneSummary(get().world, get().selectedId, lastOps))
        if (id !== latest) { patch({ status: 'error', errors: ['Superseded by a newer command'] }); return }
        if (r.operations.length) { ops = r.operations; planner = 'groq' }
        if (r.rejected.length) notes.push(`Rejected ${r.rejected.length} invalid op(s) from planner`)
      } catch (e) {
        notes.push(e instanceof ApiError && e.code === 'RATE_LIMIT' ? 'Groq free-tier limit hit — used local parser' : `Planner unavailable: ${(e as Error).message}`)
      }
    }
    const parseMs = performance.now() - tp
    if (!ops.length) {
      patch({ normalized: local.normalized, planner: 'none', status: 'error', errors: ['No world edit recognised'], notes, t: { parse: parseMs } })
      set({ phase: 'error', message: `Didn't catch a world edit in “${text.slice(0, 60)}”. Try “ek ghar banao” or “make a bridge”.` })
      return
    }

    set({ phase: 'applying', message: 'Applying to world…' })
    const ta = performance.now()
    let base = get().world
    let world = base
    const affected: string[] = [], errors: string[] = []
    const effects: Effect[] = []
    for (const op of ops) {
      if (op.action === 'UNDO' || op.action === 'REDO') {
        if (world !== base) { set({ past: [...get().past, base].slice(-50), future: [] }); base = world }
        op.action === 'UNDO' ? get().undo(op.steps) : get().redo(op.steps)
        base = world = get().world
        notes.push(op.action === 'UNDO' ? 'Reverted previous change' : 'Re-applied change')
        continue
      }
      const r = applyOperation(world, op, get().selectedId)
      if (r.error) { errors.push(r.error); continue }
      world = r.world
      affected.push(...r.affected); notes.push(...r.notes); effects.push(...r.effects)
    }
    if (world !== base) set({ world, past: [...get().past, base].slice(-50), future: [] })
    const firstNew = affected[affected.length - 1]
    if (firstNew && world.entities.some((e) => e.id === firstNew)) set({ selectedId: firstNew })

    for (const fx of effects) handleEffect(fx)
    const applyEnd = performance.now()
    const applyMs = applyEnd - ta

    const editedSomething = ops.some((o) => ACTIONS_THAT_EDIT.has(o.action)) && !errors.length
    const status: LogEntry['status'] = errors.length ? (affected.length || effects.length ? 'partial' : 'error') : 'ok'
    // total = end of speech (or submit) → world state applied. Rendering is measured separately.
    patch({ normalized: local.normalized, planner, ops, notes, errors, affected, status, t: { parse: parseMs, apply: applyMs, total: applyEnd - t0 } })
    set({ phase: status === 'error' ? 'error' : 'done', message: errors[0] ?? notes[0] ?? (editedSomething ? 'World updated' : 'Done') })

    // first visible frame after the state change
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const now = performance.now()
      patch({ t: { frame: now - applyEnd } })
    }))
    if (get().speakReplies && get().health?.gnani && status !== 'error') void say(ops, extra.language)
  },

  async save(name = 'autosave') {
    await idbSet(`scene:${name}`, get().world)
    set({ message: `Saved “${name}” to this browser` })
  },
  async load(name = 'autosave') {
    const w = await idbGet<World>(`scene:${name}`)
    if (!w || w.version !== 1) { set({ phase: 'error', message: `No saved scene “${name}” in this browser` }); return }
    set({ world: w, past: [...get().past, get().world].slice(-50), future: [], message: `Loaded “${name}”` })
  },
  importJson(json) {
    try {
      const w = JSON.parse(json) as World
      if (w.version !== 1 || !Array.isArray(w.entities)) throw new Error('not a BoliVerse scene')
      set({ world: w, past: [...get().past, get().world].slice(-50), future: [], message: 'Scene imported' })
    } catch (e) {
      set({ phase: 'error', message: `Import failed: ${(e as Error).message}` })
    }
  },
}))

function handleEffect(fx: Effect) {
  const s = useStudio.getState()
  switch (fx.kind) {
    case 'camera':
      s.set({ cameraCmd: { seq: s.cameraCmd.seq + 1, view: fx.view, targetId: fx.targetId } })
      break
    case 'path':
      s.set({ shot: { seq: (s.shot?.seq ?? 0) + 1, preset: fx.preset, durationSec: fx.durationSec, targetId: fx.targetId, record: false, aspect: s.shot?.aspect ?? '16:9' }, mode: 'film' })
      break
    case 'play':
      if (s.shot) s.set({ shot: { ...s.shot, seq: s.shot.seq + 1, record: false } })
      break
    case 'record': {
      const base = s.shot ?? { seq: 0, preset: 'establishing' as const, durationSec: 8, record: false, aspect: '16:9' as const }
      s.set({ mode: 'film', shot: { ...base, seq: base.seq + 1, record: true, durationSec: fx.durationSec ?? base.durationSec, aspect: fx.aspect ?? base.aspect } })
      break
    }
    case 'stopRecord':
      s.set({ recording: { ...s.recording, state: s.recording.state === 'recording' ? 'idle' : s.recording.state, message: 'Recording cancelled' }, shot: null })
      break
    case 'undo': s.undo(fx.steps); break
    case 'redo': s.redo(fx.steps); break
    case 'save': void s.save(fx.name); break
    case 'load': void s.load(fx.name); break
    case 'clarify': s.set({ phase: 'error', message: fx.question }); break
    case 'force': s.set({ force: { seq: s.force.seq + 1, ids: fx.targetIds, strength: fx.strength } }); break
  }
}

const SAY: Record<string, [string, string, string]> = {
  CREATE_SCENE: ['Your village is ready', 'आपका गाँव तैयार है', 'तुमचं गाव तयार आहे'],
  CREATE_OBJECT: ['Built it', 'बना दिया', 'बनवलं'],
  BATCH_CREATE: ['Added them', 'जोड़ दिए', 'जोडले'],
  MODIFY_OBJECT: ['Updated', 'बदल दिया', 'बदललं'],
  DESTROY_STRUCTURE: ['The bridge has collapsed. The route is blocked', 'पुल टूट गया, रास्ता बंद है', 'पूल तुटला, रस्ता बंद झाला'],
  REPAIR_STRUCTURE: ['Rebuilt. The route is open again', 'फिर से बना दिया, रास्ता खुल गया', 'पुन्हा बांधलं, रस्ता खुला झाला'],
  SET_TIME_OF_DAY: ['Changing the light', 'रोशनी बदल रही है', 'प्रकाश बदलतोय'],
  SET_WEATHER: ['Weather changed', 'मौसम बदल दिया', 'हवामान बदललं'],
  START_RECORDING: ['Rolling camera', 'रिकॉर्डिंग शुरू', 'रेकॉर्डिंग सुरू'],
}
async function say(ops: Operation[], lang?: string) {
  const key = [...ops].reverse().find((o) => SAY[o.action])?.action
  if (!key) return
  const idx = lang?.startsWith('mr') ? 2 : lang?.startsWith('hi') ? 1 : 0
  try {
    const blob = await speak(SAY[key][idx], idx === 2 ? 'mr-IN' : idx === 1 ? 'hi-IN' : 'en-IN')
    const a = new Audio(URL.createObjectURL(blob))
    a.onended = () => URL.revokeObjectURL(a.src)
    await a.play()
  } catch (e) {
    useStudio.getState().set({ message: `Timbre voice reply failed: ${(e as Error).message}` })
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __studio: typeof useStudio }).__studio = useStudio
