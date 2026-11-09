import { z } from 'zod'

// The allow-listed operation language. Everything the voice/LLM layer produces must parse here,
// otherwise it is rejected. No code, URLs or shaders can travel through these types.

export const OBJECT_TYPES = ['house', 'tree', 'bridge', 'river', 'road', 'rock', 'temple', 'well', 'school', 'lamp', 'cart'] as const
export const ObjectType = z.enum(OBJECT_TYPES)
export type ObjectType = z.infer<typeof ObjectType>

export const MATERIALS = ['wood', 'stone', 'steel', 'brick', 'mud', 'glass', 'gold'] as const
export const Material = z.enum(MATERIALS)
export type Material = z.infer<typeof Material>

export const COLORS = ['red', 'blue', 'green', 'yellow', 'white', 'black', 'orange', 'pink', 'brown', 'purple', 'saffron', 'indigo'] as const
export const Color = z.enum(COLORS)
export type Color = z.infer<typeof Color>

export const Selector = z
  .object({
    id: z.string().max(40).optional(),
    type: ObjectType.optional(),
    ref: z.enum(['last', 'selected', 'all', 'previous']).optional(),
    near: ObjectType.optional(),
    side: z.enum(['west', 'east', 'left', 'right']).optional(),
  })
  .strict()
export type Selector = z.infer<typeof Selector>

export const Placement = z
  .object({
    relation: z.enum(['across', 'near', 'between', 'left_of', 'right_of', 'behind', 'in_front', 'same_place', 'along', 'scatter', 'at']),
    ref: Selector.optional(),
    ref2: Selector.optional(),
    at: z.tuple([z.number().min(-80).max(80), z.number().min(-80).max(80)]).optional(),
    side: z.enum(['west', 'east']).optional(),
  })
  .strict()
export type Placement = z.infer<typeof Placement>

const props = {
  material: Material.optional(),
  color: Color.optional(),
  scale: z.number().min(0.3).max(3).optional(),
  placement: Placement.optional(),
}

const DURATION = z.number().min(2).max(30)
export const CameraPreset = z.enum(['establishing', 'river_reveal', 'bridge_flythrough', 'under_bridge', 'sunset_panorama', 'orbit', 'destruction'])
export type CameraPreset = z.infer<typeof CameraPreset>

export const Operation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CREATE_SCENE'), template: z.enum(['village', 'blank']) }).strict(),
  z.object({ action: z.literal('CREATE_OBJECT'), objectType: ObjectType, ...props }).strict(),
  z.object({ action: z.literal('BATCH_CREATE'), objectType: ObjectType, count: z.number().int().min(1).max(60), ...props }).strict(),
  z.object({ action: z.literal('MODIFY_OBJECT'), target: Selector, color: Color.optional(), material: Material.optional(), scaleBy: z.number().min(0.3).max(3).optional() }).strict(),
  z.object({
    action: z.literal('TRANSFORM_OBJECT'),
    target: Selector,
    move: z.object({ direction: z.enum(['left', 'right', 'forward', 'back', 'up', 'down']), meters: z.number().min(0).max(40) }).strict().optional(),
    rotateDeg: z.number().min(-360).max(360).optional(),
    to: z.tuple([z.number().min(-90).max(90), z.number().min(-90).max(90)]).optional(),
  }).strict(),
  z.object({ action: z.literal('DUPLICATE_OBJECT'), target: Selector, count: z.number().int().min(1).max(20).optional() }).strict(),
  z.object({ action: z.literal('DELETE_OBJECT'), target: Selector }).strict(),
  z.object({ action: z.literal('DESTROY_STRUCTURE'), target: Selector }).strict(),
  z.object({ action: z.literal('REPAIR_STRUCTURE'), target: Selector, material: Material.optional() }).strict(),
  z.object({ action: z.literal('APPLY_FORCE'), target: Selector, strength: z.number().min(0).max(10).optional() }).strict(),
  z.object({ action: z.literal('SET_WEATHER'), weather: z.enum(['clear', 'rain', 'fog', 'storm']) }).strict(),
  z.object({ action: z.literal('SET_LIGHTING'), preset: z.enum(['soft', 'cinematic', 'dramatic']) }).strict(),
  z.object({ action: z.literal('SET_TIME_OF_DAY'), time: z.enum(['dawn', 'morning', 'noon', 'sunset', 'night']) }).strict(),
  z.object({ action: z.literal('SET_CAMERA'), view: z.enum(['overview', 'top', 'low', 'focus', 'free']), target: Selector.optional() }).strict(),
  z.object({ action: z.literal('CREATE_CAMERA_PATH'), preset: CameraPreset, durationSec: DURATION.optional(), target: Selector.optional() }).strict(),
  z.object({ action: z.literal('PLAY_CAMERA_PATH') }).strict(),
  z.object({ action: z.literal('START_RECORDING'), durationSec: DURATION.optional(), aspect: z.enum(['16:9', '9:16']).optional() }).strict(),
  z.object({ action: z.literal('STOP_RECORDING') }).strict(),
  z.object({ action: z.literal('UNDO'), steps: z.number().int().min(1).max(20).optional() }).strict(),
  z.object({ action: z.literal('REDO'), steps: z.number().int().min(1).max(20).optional() }).strict(),
  z.object({ action: z.literal('SAVE_SCENE'), name: z.string().max(60).optional() }).strict(),
  z.object({ action: z.literal('LOAD_SCENE'), name: z.string().max(60).optional() }).strict(),
  z.object({ action: z.literal('CLARIFY_INTENT'), question: z.string().max(200) }).strict(),
])
export type Operation = z.infer<typeof Operation>
export type Action = Operation['action']

export const Plan = z.object({ operations: z.array(Operation).max(12) }).strict()
export type Plan = z.infer<typeof Plan>

const REQUIRED = new Set(['action', 'objectType', 'target', 'count', 'template', 'weather', 'preset', 'time', 'view', 'question'])

/** Validate untrusted input (LLM output). Drops invalid ops individually and reports why. */
export function validatePlan(raw: unknown): { ops: Operation[]; rejected: string[] } {
  const list = (raw as { operations?: unknown })?.operations
  if (!Array.isArray(list)) return { ops: [], rejected: ['missing operations array'] }
  const ops: Operation[] = []
  const rejected: string[] = []
  for (const item of list.slice(0, 12)) {
    let cand = stripNulls(item) as Record<string, unknown>
    let r = Operation.safeParse(cand)
    // Repair: drop invalid OPTIONAL top-level fields (e.g. an unknown placement relation) and retry.
    // Required fields are never dropped, and nothing is invented.
    for (let tries = 0; !r.success && tries < 3 && cand && typeof cand === 'object'; tries++) {
      const key = r.error.issues[0]?.path[0]
      if (typeof key !== 'string' || REQUIRED.has(key) || !(key in cand)) break
      const { [key]: _drop, ...rest } = cand
      void _drop
      cand = rest
      r = Operation.safeParse(cand)
    }
    if (r.success) ops.push(r.data)
    else rejected.push(`${(item as { action?: string })?.action ?? '?'}: ${r.error.issues[0]?.message}`)
  }
  return { ops, rejected }
}

// LLMs often emit `"field": null` for optional fields; treat null as absent.
function stripNulls(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripNulls)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null).map(([k, x]) => [k, stripNulls(x)]))
  }
  return v
}
