import type { Operation } from '../compiler/schema'

export interface Health { gnani: boolean; groq: boolean; demoTokenRequired: boolean; sttModel: string; ttsModel: string; groqModel: string }

const token = () => { try { return localStorage.getItem('boliverse.demoToken') ?? '' } catch { return '' } }
const headers = (h: Record<string, string> = {}) => (token() ? { ...h, 'x-demo-token': token() } : h)

export class ApiError extends Error { constructor(msg: string, public code?: string, public status?: number) { super(msg) } }

async function call<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: headers(init.headers as Record<string, string>) })
  if (!res.ok) {
    const b = await res.json().catch(() => ({}))
    throw new ApiError(b.error ?? `Request failed (${res.status})`, b.code, res.status)
  }
  return (res.headers.get('content-type')?.includes('json') ? res.json() : res.blob()) as Promise<T>
}

export async function getHealth(): Promise<Health | null> {
  try {
    const r = await fetch('/api/health')
    return r.ok ? r.json() : null
  } catch { return null }
}

export const transcribe = (wav: Blob, lang: string) =>
  call<{ transcript: string; language: string; model: string; providerLatencyMs: number; relayMs: number }>(`/api/stt?lang=${encodeURIComponent(lang)}`, { method: 'POST', body: wav, headers: { 'content-type': 'audio/wav' } })

export const interpretRemote = (text: string, scene: unknown, signal?: AbortSignal) =>
  call<{ operations: Operation[]; rejected: string[]; model: string; ms: number }>('/api/interpret', { method: 'POST', body: JSON.stringify({ text, scene }), headers: { 'content-type': 'application/json' }, signal })

export const speak = (text: string, language: string) =>
  call<Blob>('/api/tts', { method: 'POST', body: JSON.stringify({ text, language }), headers: { 'content-type': 'application/json' } })
