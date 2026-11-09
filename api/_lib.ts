// Shared guards for the API routes. Files prefixed with _ are not deployed as functions.

export const env = (k: string) => process.env[k]?.trim() || undefined

export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

// ponytail: per-instance sliding window. Serverless instances don't share memory, so this caps
// burst abuse per warm instance only; add Vercel WAF rate limiting if the demo gets real traffic.
const hits = new Map<string, number[]>()
function limited(key: string, max: number, windowMs: number) {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) hits.clear()
  return list.length > max
}

/** Returns an error Response, or null when the request may proceed. */
export function guard(req: Request, opts: { maxBytes: number; perMinute: number; route: string }): Response | null {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  const len = Number(req.headers.get('content-length') ?? 0)
  if (len > opts.maxBytes) return json({ error: `Payload too large (max ${opts.maxBytes} bytes)` }, 413)

  const origin = req.headers.get('origin')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  if (origin && host && new URL(origin).host !== host && !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(new URL(origin).host)) {
    return json({ error: 'Cross-origin requests are not allowed' }, 403)
  }
  const token = env('DEMO_ACCESS_TOKEN')
  if (token && req.headers.get('x-demo-token') !== token) return json({ error: 'Demo access token required', code: 'DEMO_TOKEN' }, 401)

  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim()
  if (limited(`${opts.route}:${ip}`, opts.perMinute, 60_000)) return json({ error: 'Too many requests — slow down a little', code: 'RATE_LIMIT' }, 429)
  return null
}

export async function readLimited(req: Request, maxBytes: number): Promise<ArrayBuffer | null> {
  const buf = await req.arrayBuffer()
  return buf.byteLength > maxBytes ? null : buf
}

export async function fetchWithTimeout(url: string, init: RequestInit, ms: number) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}
