import { MAX_PHRASE, NUMBER_WORDS, PHRASES, STOPWORDS } from './lexicon'
import { INTERIOR_TYPES, type CameraPreset, type Color, type Material, type ObjectType, type Operation, type Placement, type Selector } from './schema'

// Path A: deterministic, zero-latency multilingual intent parser. Handles the common command
// vocabulary in English / Hindi / Marathi / code-mixed speech. Anything it is unsure about is
// reported with low confidence so the router can escalate to the LLM planner.

export interface ParseContext {
  /** operations of the previous successful utterance (for corrections like "5 not 50") */
  lastOps?: Operation[]
}

export interface ParseResult {
  ops: Operation[]
  confidence: number
  normalized: string
  unknown: string[]
}

interface Tok { raw: string; c: string[]; num?: number }

const DEVA_DIGITS = '०१२३४५६७८९'
const GENITIVE = new Set(['ke', 'ki', 'ka', 'के', 'की', 'का', 'च्या', 'ची', 'चा', 'chya', 'chi', 'cha', 'of'])

export function normalize(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[०-९]/g, (d) => String(DEVA_DIGITS.indexOf(d)))
    .replace(/़/g, '') // nukta: ड़ → ड so both spellings match
    .replace(/[ँ]/g, 'ं') // chandrabindu → anusvara
    .replace(/(\d+)\s*(s|sec|secs)\b/g, '$1 seconds')
    .replace(/[“”"'`’!?¿¡()[\]{}]/g, ' ')
    .replace(/[,;।॥.]+/g, ' , ')
    .replace(/(\p{L})-(\p{L})/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

// re-apply the nukta stripping to lexicon keys so lookups match normalised text
const LEX = new Map<string, string[]>()
for (const [k, v] of PHRASES) LEX.set(k.replace(/़/g, '').replace(/ँ/g, 'ं'), v)
const STOP = new Set([...STOPWORDS].map((s) => s.replace(/_/g, ' ').replace(/़/g, '')))

function tokenize(text: string): Tok[] {
  const words = text.split(' ').filter(Boolean)
  const out: Tok[] = []
  for (let i = 0; i < words.length; ) {
    let matched = false
    for (let n = Math.min(MAX_PHRASE, words.length - i); n >= 1; n--) {
      const phrase = words.slice(i, i + n).join(' ')
      const c = LEX.get(phrase) ?? (n === 1 && /^[a-z]{4,}s$/.test(phrase) ? LEX.get(phrase.slice(0, -1)) ?? LEX.get(phrase.replace(/es$/, '')) : undefined)
      if (c) { out.push({ raw: phrase, c }); i += n; matched = true; break }
    }
    if (matched) continue
    const w = words[i]
    if (/^\d+(\.\d+)?$/.test(w)) out.push({ raw: w, c: ['NUM'], num: parseFloat(w) })
    else if (NUMBER_WORDS[w] !== undefined) out.push({ raw: w, c: ['NUM'], num: NUMBER_WORDS[w] })
    else out.push({ raw: w, c: [] })
    i++
  }
  // "do" / "don" are both "two" and verb helpers ("tod do"). Keep the number only before a noun.
  return out.filter((t, k) => {
    if (t.c[0] === 'NUM' && (t.raw === 'do' || t.raw === 'दो')) {
      const next = out.slice(k + 1, k + 3)
      return next.some((n) => n.c.some((c) => c.startsWith('OBJ:')))
    }
    return true
  })
}

const has = (toks: Tok[], prefix: string) => toks.some((t) => t.c.some((c) => c === prefix || c.startsWith(prefix + ':')))
const val = (toks: Tok[], prefix: string) => {
  for (const t of toks) for (const c of t.c) if (c.startsWith(prefix + ':')) return c.slice(prefix.length + 1)
  return undefined
}
const vals = (toks: Tok[], prefix: string) => toks.flatMap((t) => t.c.filter((c) => c.startsWith(prefix + ':')).map((c) => c.slice(prefix.length + 1)))

const ACTION_CONCEPTS = ['OBJ', 'SCENE', 'V', 'TIME', 'WEATHER', 'LIGHT', 'CAM', 'REC', 'CINE', 'FLY']

function splitClauses(toks: Tok[]): Tok[][] {
  const clauses: Tok[][] = [[]]
  for (const t of toks) {
    if (t.raw === ',' || t.raw === 'and' || t.raw === 'aur' || t.raw === 'और' || t.raw === 'आणि' || t.raw === 'ani' || t.raw === 'then' || t.raw === 'phir' || t.raw === 'fir' || t.raw === 'फिर' || t.raw === 'मग') {
      clauses.push([])
    } else clauses[clauses.length - 1].push(t)
  }
  // Fragments with no noun or action ("same jagah", "red colour me") modify the previous clause.
  const merged: Tok[][] = []
  for (const c of clauses) {
    if (!c.length) continue
    const standalone = ACTION_CONCEPTS.some((p) => has(c, p))
    const prev = merged[merged.length - 1]
    // "A bridge, tod do" / "पुल, तोड़ दो": an object-only fragment followed by a verb-only one is a single command
    const verbOnly = has(c, 'V') && !has(c, 'OBJ') && !has(c, 'SCENE')
    const prevObjOnly = prev && has(prev, 'OBJ') && !has(prev, 'V')
    if ((!standalone || (verbOnly && prevObjOnly)) && prev) prev.push(...c)
    else merged.push(c)
  }
  return merged
}

/** Pick target vs reference objects. Hindi/Marathi use postpositions ("school ke paas"), English
 *  prepositions ("near the school"); an object adjacent to a relation word is the reference. */
function roles(toks: Tok[]) {
  const objs: { type: ObjectType; i: number; ref: boolean }[] = []
  toks.forEach((t, i) => {
    const o = t.c.find((c) => c.startsWith('OBJ:'))
    if (o) objs.push({ type: o.slice(4) as ObjectType, i, ref: false })
  })
  const relIdx = toks.map((t, i) => (t.c.some((c) => c.startsWith('REL:')) ? i : -1)).filter((i) => i >= 0)
  // Postposition languages: "<ref> ke/की/च्या <REL>" — a genitive link marks the reference unambiguously.
  for (const o of objs) {
    for (const r of relIdx) {
      const between = toks.slice(o.i + 1, r)
      const fusedGen = GENITIVE.has(toks[r].raw.split(' ')[0]) // "ke andar", "के पास" matched as one token
      if (r > o.i && r - o.i <= 3 && (fusedGen || between.some((t) => GENITIVE.has(t.raw))) && between.every((t) => STOP.has(t.raw))) o.ref = true
    }
  }
  if (objs.some((o) => o.ref)) {
    const target = objs.find((o) => !o.ref)
    return { target: target?.type, refs: objs.filter((o) => o.ref).map((o) => o.type) }
  }
  for (const o of objs) {
    for (const r of relIdx) {
      const between = toks.slice(Math.min(o.i, r) + 1, Math.max(o.i, r))
      if (Math.abs(o.i - r) <= 3 && between.every((t) => STOP.has(t.raw))) o.ref = true
    }
  }
  if (objs.length && objs.every((o) => o.ref)) objs[0].ref = false
  // Locatives ("बंगले में कालीन", "बंगल्यात पलंग"): furniture + mansion → the mansion is the container.
  if (objs.some((o) => o.type === 'mansion') && objs.some((o) => INTERIOR_TYPES.includes(o.type))) {
    for (const o of objs) o.ref = o.type === 'mansion'
  }
  const target = objs.find((o) => !o.ref)
  const refs = objs.filter((o) => o.ref)
  return { target: target?.type, refs: refs.map((r) => r.type) }
}

function countOf(toks: Tok[], type?: ObjectType): number | undefined {
  const nums = toks.filter((t) => t.c[0] === 'NUM' && !isUnitNum(toks, t))
  if (nums.length) return Math.round(nums[nums.length - 1].num!)
  if (has(toks, 'MANY') || has(toks, 'SCENE') && toks.some((t) => t.c.includes('SCENE:forest'))) return 15
  if (has(toks, 'FEW')) return 5
  if (type && toks.some((t) => t.c.includes(`OBJ:${type}`) && /^[a-z]+s$|^(gharon|pedon|makaanon|jhaadon)$|ों$|े$/.test(t.raw))) return 3
  return undefined
}
function isUnitNum(toks: Tok[], t: Tok) {
  const i = toks.indexOf(t)
  const next = toks[i + 1]
  return !!next && next.c.some((c) => c === 'SECONDS' || c === 'METERS' || c === 'DEGREES')
}
const numBefore = (toks: Tok[], unit: string) => {
  const i = toks.findIndex((t) => t.c.includes(unit))
  return i > 0 && toks[i - 1].c[0] === 'NUM' ? toks[i - 1].num : undefined
}

function selector(toks: Tok[], type: ObjectType | undefined, refs: ObjectType[]): Selector {
  const s: Selector = {}
  if (type) s.type = type
  if (has(toks, 'ALL')) s.ref = 'all'
  else if (has(toks, 'PRON') && !type) s.ref = 'last'
  if (refs.length && (has(toks, 'REL:near') || has(toks, 'REL:behind') || has(toks, 'REL:in_front'))) s.near = refs[0]
  const side = val(toks, 'SIDE')
  if (side) s.side = side as 'west' | 'east'
  return s
}

function placement(toks: Tok[], type: ObjectType, refs: ObjectType[]): Placement | undefined {
  if (has(toks, 'SAME')) return { relation: 'same_place' }
  if (INTERIOR_TYPES.includes(type) && (!refs.length || refs[0] === 'mansion' || has(toks, 'REL:inside'))) return { relation: 'inside', ref: { type: 'mansion' } }
  const side = val(toks, 'SIDE') as 'west' | 'east' | undefined
  const rel = val(toks, 'REL') as Placement['relation'] | undefined
  if (rel === 'between' && refs.length) return { relation: 'between', ref: { type: refs[0] }, ref2: { type: refs[1] ?? refs[0], ref: 'previous' } }
  if (rel && refs.length) return { relation: rel === 'across' && refs[0] !== 'river' ? 'near' : rel, ref: { type: refs[0] }, side }
  if (type === 'bridge' || rel === 'across') return { relation: 'across', ref: { type: 'river' } }
  if (side) return { relation: 'scatter', side }
  return undefined
}

function cameraOps(toks: Tok[], text: string): Operation[] {
  const dur = numBefore(toks, 'SECONDS')
  const durationSec = dur ? Math.min(30, Math.max(2, dur)) : undefined
  const mentions = (t: ObjectType) => toks.some((k) => k.c.includes(`OBJ:${t}`))
  const ops: Operation[] = []
  let preset: CameraPreset | undefined
  if (has(toks, 'TIME:sunset')) { ops.push({ action: 'SET_TIME_OF_DAY', time: 'sunset' }); if (!mentions('bridge')) preset = 'sunset_panorama' }
  const interiorWords = has(toks, 'REL:inside') || has(toks, 'INTERIOR') || INTERIOR_TYPES.some((t) => mentions(t as ObjectType))
  if (has(toks, 'ORBIT')) preset = 'orbit'
  else if (mentions('mansion') || interiorWords) preset = interiorWords ? 'interior' : 'mansion_reveal'
  else if (has(toks, 'V:destroy')) preset = 'destruction'
  else if (mentions('bridge') && has(toks, 'LOW') && !has(toks, 'HIGH') && !has(toks, 'REL:across')) preset = 'under_bridge'
  else if (mentions('bridge')) preset = 'bridge_flythrough'
  else if (mentions('river') || has(toks, 'REVEAL')) preset = preset ?? 'river_reveal'
  else if (has(toks, 'PANO')) preset = 'sunset_panorama'
  else if (has(toks, 'SCENE:village') || has(toks, 'CINE') || has(toks, 'FLY') || has(toks, 'REC')) preset = preset ?? 'establishing'

  const wantsVideo = has(toks, 'REC') || (has(toks, 'CINE') && (has(toks, 'V:create') || durationSec !== undefined))
  if (has(toks, 'V:stop') && has(toks, 'REC')) return [{ action: 'STOP_RECORDING' }]

  if (!preset) {
    if (has(toks, 'HIGH') && !has(toks, 'FLY')) return [{ action: 'SET_CAMERA', view: 'top' }]
    if (has(toks, 'LOW')) return [{ action: 'SET_CAMERA', view: 'low' }]
    if (has(toks, 'CLOSE')) return [{ action: 'SET_CAMERA', view: 'focus', target: { ref: 'last' } }]
    return [{ action: 'SET_CAMERA', view: 'overview' }]
  }
  ops.push({ action: 'CREATE_CAMERA_PATH', preset, durationSec })
  if (wantsVideo) ops.push({ action: 'START_RECORDING', durationSec, aspect: has(toks, 'VERTICAL') || /9\s*:\s*16/.test(text) ? '9:16' : undefined })
  else ops.push({ action: 'PLAY_CAMERA_PATH' })
  return ops
}

function correction(toks: Tok[], ctx: ParseContext): Operation[] | null {
  const prev = ctx.lastOps?.find((o) => o.action === 'BATCH_CREATE' || o.action === 'CREATE_OBJECT')
  if (!has(toks, 'NEG') || !prev || (prev.action !== 'BATCH_CREATE' && prev.action !== 'CREATE_OBJECT')) return null
  const nums = toks.map((t, i) => ({ t, i })).filter(({ t }) => t.c[0] === 'NUM')
  if (!nums.length) return null
  const negated = (i: number) => [toks[i - 1], toks[i + 1]].some((n) => n?.c.includes('NEG'))
  const good = [...nums].reverse().find(({ i }) => !negated(i)) ?? nums[nums.length - 1]
  const { target } = roles(toks)
  const n = Math.max(1, Math.min(60, Math.round(good.t.num!)))
  const { action: _a, ...rest } = prev
  void _a
  const base = { ...rest, objectType: target ?? prev.objectType } as Omit<Extract<Operation, { action: 'BATCH_CREATE' }>, 'action' | 'count'> & { count?: number }
  delete base.count
  return [{ action: 'UNDO' }, n === 1 ? { action: 'CREATE_OBJECT', ...base } : { action: 'BATCH_CREATE', ...base, count: n }]
}

/** "woh wala nahi, school ke piche wala" → redo the last targeted edit against a different entity */
function retarget(toks: Tok[], ctx: ParseContext): Operation[] | null {
  const prev = ctx.lastOps?.find((o) => 'target' in o)
  if (!prev || !('target' in prev) || !has(toks, 'NEG') || !has(toks, 'REL')) return null
  const { refs } = roles(toks)
  if (!refs.length) return null
  const target: Selector = { type: prev.target?.type, near: refs[0] }
  return [{ action: 'UNDO' }, { ...prev, target } as Operation]
}

function clauseOps(toks: Tok[], ctx: ParseContext, inherited?: string): Operation[] {
  const { target, refs } = roles(toks)
  const color = val(toks, 'COLOR') as Color | undefined
  const material = val(toks, 'MAT') as Material | undefined
  const verbs = vals(toks, 'V')
  const verb = verbs.find((v) => v !== 'create') ?? verbs[0] ?? inherited

  if (has(toks, 'V:undo')) return [{ action: 'UNDO', steps: countOf(toks) }]
  if (has(toks, 'V:redo')) return [{ action: 'REDO', steps: countOf(toks) }]
  if (has(toks, 'V:save')) return [{ action: 'SAVE_SCENE' }]
  if (has(toks, 'V:load')) return [{ action: 'LOAD_SCENE' }]

  const fix = correction(toks, ctx) ?? retarget(toks, ctx)
  if (fix) return fix

  const ops: Operation[] = []
  const weather = val(toks, 'WEATHER')
  if (weather) ops.push({ action: 'SET_WEATHER', weather: has(toks, 'V:stop') || has(toks, 'NEG') ? 'clear' : (weather as 'rain') })
  const time = val(toks, 'TIME')
  if (time) ops.push({ action: 'SET_TIME_OF_DAY', time: time as 'sunset' })
  const light = val(toks, 'LIGHT')
  if (light) ops.push({ action: 'SET_LIGHTING', preset: light as 'soft' })
  if (has(toks, 'SCENE:blank')) return [{ action: 'CREATE_SCENE', template: 'blank' }]
  // "पाऊस पाडा" (make it rain) uses a verb that also means "knock down": with no object named,
  // an environment clause never triggers structure verbs.
  if (ops.length && !target && !has(toks, 'PRON') && !has(toks, 'SCENE')) return ops

  const sel = () => selector(toks, target, refs)
  const scaleBy = has(toks, 'DOUBLE') ? 2 : has(toks, 'HALF') ? 0.5 : has(toks, 'MUCH') ? 1.8 : has(toks, 'LITTLE') ? 1.3 : 1.5

  switch (verb) {
    case 'destroy':
      return [...ops, { action: 'DESTROY_STRUCTURE', target: target ? sel() : { ref: 'last', type: 'bridge' } }]
    case 'repair':
      return [...ops, { action: 'REPAIR_STRUCTURE', target: { type: target ?? 'bridge' }, material }]
    case 'delete':
      if (!target && !has(toks, 'PRON')) break
      return [...ops, { action: 'DELETE_OBJECT', target: sel() }]
    case 'bigger':
    case 'smaller':
      return [...ops, { action: 'MODIFY_OBJECT', target: target ? sel() : { ref: 'last' }, scaleBy: verb === 'bigger' ? scaleBy : 1 / scaleBy }]
    case 'move': {
      const dir = (val(toks, 'DIR') ?? val(toks, 'REL')?.replace('_of', '')) as 'left' | 'right' | 'forward' | 'back' | 'up' | 'down' | undefined
      return [...ops, { action: 'TRANSFORM_OBJECT', target: target ? sel() : { ref: 'last' }, move: { direction: dir === 'left' || dir === 'right' || dir === 'up' || dir === 'down' || dir === 'back' ? dir : 'forward', meters: numBefore(toks, 'METERS') ?? countOf(toks) ?? 5 } }]
    }
    case 'rotate':
      return [...ops, { action: 'TRANSFORM_OBJECT', target: target ? sel() : { ref: 'last' }, rotateDeg: numBefore(toks, 'DEGREES') ?? countOf(toks) ?? 90 }]
    case 'duplicate':
      return [...ops, { action: 'DUPLICATE_OBJECT', target: target ? sel() : { ref: 'last' }, count: countOf(toks) }]
    case 'push':
      return [...ops, { action: 'APPLY_FORCE', target: target ? { ...sel(), ref: sel().ref ?? 'all' } : { type: 'rock', ref: 'all' }, strength: has(toks, 'MUCH') ? 9 : 5 }]
  }

  const isCreate = verb === 'create' || verb === undefined
  if (has(toks, 'SCENE:village') && isCreate) return [...ops, { action: 'CREATE_SCENE', template: 'village' }]
  if (has(toks, 'SCENE:forest') && isCreate) return [...ops, { action: 'BATCH_CREATE', objectType: 'tree', count: countOf(toks) ?? 15 }]

  if (target && (color || material) && !isCreate) {
    return [...ops, { action: 'MODIFY_OBJECT', target: sel(), color, material }]
  }
  if (!target && (color || material) && (has(toks, 'PRON') || verb === 'paint')) {
    return [...ops, { action: 'MODIFY_OBJECT', target: { ref: 'last' }, color, material }]
  }
  if (target && (isCreate || verb === 'paint')) {
    if (verb === 'paint' && (color || material)) return [...ops, { action: 'MODIFY_OBJECT', target: sel(), color, material }]
    if (has(toks, 'AGAIN') && ['bridge', 'house', 'temple', 'school', 'well'].includes(target) && !has(toks, 'SAME')) {
      return [...ops, { action: 'REPAIR_STRUCTURE', target: { type: target }, material }]
    }
    const count = countOf(toks, target) ?? 1
    const p = placement(toks, target, refs)
    const base = { objectType: target, color, material, placement: p }
    return [...ops, count > 1 ? { action: 'BATCH_CREATE', ...base, count: Math.min(60, count) } : { action: 'CREATE_OBJECT', ...base }]
  }
  return ops
}

export function parseLocal(text: string, ctx: ParseContext = {}): ParseResult {
  const normalized = normalize(text)
  const toks = tokenize(normalized)
  const unknown = toks.filter((t) => !t.c.length && t.raw !== ',' && !STOP.has(t.raw) && !/^\d/.test(t.raw)).map((t) => t.raw)
  let ops: Operation[] = []

  const film = has(toks, 'CAM') || has(toks, 'CINE') || has(toks, 'FLY') || (has(toks, 'REC') && !has(toks, 'V:save'))
  const whole = toks.filter((t) => t.raw !== ',')
  const fix = has(whole, 'NEG') ? correction(whole, ctx) ?? retarget(whole, ctx) : null
  if (fix) ops = fix
  else if (film) ops = cameraOps(whole, normalized)
  else {
    const clauses = splitClauses(toks)
    let inherited: string | undefined
    for (const c of clauses) {
      const v = vals(c, 'V')[0]
      ops.push(...clauseOps(c, ctx, v || !has(c, 'OBJ') ? undefined : inherited))
      if (v) inherited = v
    }
  }
  const words = toks.filter((t) => t.raw !== ',').length || 1
  const confidence = ops.length ? Math.max(0.2, 1 - (unknown.length / words) * 0.9) : 0
  return { ops: ops.slice(0, 12), confidence, normalized, unknown }
}
