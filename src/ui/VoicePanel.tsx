import { useState } from 'react'
import { type LogEntry, useStudio } from '../store'
import type { World } from '../engine/world'
import { toggleMic } from '../voice/controller'
import { Icon } from './Icon'
import { Waveform } from './Waveform'

export const DEMO_STEPS = [
  { label: 'Create', text: 'Ek beautiful Indian village banao, beech mein nadi ho, aur wooden bridge ho.' },
  { label: 'Edit', text: 'Bridge thoda bada karo, aur sunset kar do.' },
  { label: 'Destroy', text: 'Ab bridge tod do.' },
  { label: 'Rebuild', text: 'Ab stone bridge banao, same jagah.' },
  { label: 'Film', text: 'Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.' },
]

const LANGS: [string, string][] = [
  ['indic-auto', 'Auto'], ['hi-IN,en-IN', 'Hinglish'], ['hi-IN', 'Hindi'], ['mr-IN', 'Marathi'], ['mr-IN,en-IN', 'Minglish'], ['en-IN', 'English'],
]
const LANG_NAME: Record<string, string> = { 'hi-IN': 'Hindi', 'mr-IN': 'Marathi', 'en-IN': 'English', 'indic-auto': 'Auto' }

const PHASE: Record<string, string> = { idle: 'Ready', listening: 'Listening', transcribing: 'Transcribing · Gnani Prisma', interpreting: 'Understanding', applying: 'Building world', done: 'Done', error: 'Needs attention' }

/** Next sensible things to say, given the world as it is now. */
function suggest(w: World): string[] {
  const bridges = w.entities.filter((e) => e.type === 'bridge')
  if (!w.entities.length) return [DEMO_STEPS[0].text, 'एक गाँव बनाओ', 'Make a wooden bridge across the river']
  if (bridges.some((b) => b.state === 'destroyed') && !bridges.some((b) => b.state === 'intact')) return [DEMO_STEPS[3].text, 'Rebuild the bridge in steel', 'Undo']
  if (bridges.length >= 2) return [DEMO_STEPS[4].text, 'raat kar do aur barish karo', 'पाच झाडे लावा']
  if (bridges.length === 1) return [w.env.time === 'sunset' ? DEMO_STEPS[2].text : DEMO_STEPS[1].text, 'मंदिर के पास तीन घर बनाओ', 'Paint it red']
  return ['Make a wooden bridge across the river', 'barish karo', 'Orbit the village with the camera']
}

const ms = (v?: number) => (v === undefined ? '—' : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${Math.round(v)} ms`)

export function VoicePanel({ onClose }: { onClose?: () => void }) {
  const phase = useStudio((s) => s.phase)
  const message = useStudio((s) => s.message)
  const language = useStudio((s) => s.language)
  const set = useStudio((s) => s.set)
  const run = useStudio((s) => s.run)
  const log = useStudio((s) => s.log)
  const world = useStudio((s) => s.world)
  const health = useStudio((s) => s.health)
  const speakReplies = useStudio((s) => s.speakReplies)
  const sttCalls = useStudio((s) => s.sttCalls)
  const [text, setText] = useState('')
  const [script, setScript] = useState(false)
  const busy = phase === 'transcribing' || phase === 'interpreting' || phase === 'applying'
  const submit = (t: string, source: 'text' | 'chip' = 'text') => { if (t.trim() && !busy) void run(t.trim(), source) }
  const last: LogEntry | undefined = log.at(-1)
  const listening = phase === 'listening'

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-[var(--line)] px-4">
        <span className="text-[12px] font-semibold">Voice Studio</span>
        <select value={language} onChange={(e) => set({ language: e.target.value })} className="field ml-auto !h-6 !w-auto !text-[11px]" aria-label="Speech language">
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {onClose && <button className="tool lg:hidden" onClick={onClose} aria-label="Close Voice Studio"><Icon name="x" /></button>}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {/* ---- signature mic ---- */}
        <div className="section !pb-4 !pt-5">
          <div className="flex items-center gap-4">
            <button onClick={() => void toggleMic()} disabled={busy} aria-pressed={listening} aria-label={listening ? 'Stop and transcribe' : 'Start speaking'}
              className={`relative grid h-[60px] w-[60px] shrink-0 place-items-center rounded-full transition-all duration-300 disabled:opacity-60 ${listening ? 'bg-[#2a1d14] text-[var(--accent-2)] ring-1 ring-[var(--accent)]' : 'bg-[var(--accent)] text-[#18120a] hover:bg-[var(--accent-2)]'}`}>
              {listening && <span className="absolute -inset-1.5 animate-ping rounded-full ring-1 ring-[var(--accent)]/50 [animation-duration:1.6s]" />}
              <Icon name={listening ? 'stop' : 'mic'} size={22} />
            </button>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className={`text-[12px] font-medium ${phase === 'error' ? 'text-[var(--bad)]' : busy || listening ? 'text-[var(--accent-2)]' : 'text-[var(--text)]'}`}>{PHASE[phase]}</p>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-[var(--muted)]">{message}</p>
            </div>
          </div>
          <div className="relative mt-4 overflow-hidden">
            <Waveform phase={phase} />
          </div>
          <p className="mt-2 flex items-center gap-2 text-[10.5px] text-[var(--faint)]">
            <span className={`h-1.5 w-1.5 rounded-full ${health?.gnani ? 'bg-[var(--ok)]' : 'bg-[var(--bad)]'}`} />
            Gnani Prisma {health?.sttModel?.replace('prisma-', '') ?? ''} · <span className="kbd">Space</span> to talk · {sttCalls} call{sttCalls === 1 ? '' : 's'}
          </p>
        </div>

        {/* ---- live result ---- */}
        {last && (
          <div className="section">
            <div className="flex items-center gap-2">
              <span className="eyebrow">{last.source === 'voice' ? 'Heard' : 'Command'}</span>
              {last.source === 'voice' && <span className="rounded bg-[var(--accent)]/12 px-1.5 py-px text-[10px] font-medium text-[var(--accent-2)]">{LANG_NAME[last.language ?? ''] ?? last.language}</span>}
              <span className="ml-auto text-[10px] text-[var(--faint)]">{last.planner === 'groq' ? 'Groq planner' : last.planner === 'local' ? 'Local parser' : ''}</span>
            </div>
            <p className="mt-2 text-[16px] leading-snug text-[var(--text)]">{last.transcript}</p>
            {!!last.ops.length && (
              <p className="mt-2 font-mono text-[10.5px] leading-relaxed text-[var(--accent-2)]/85">{last.ops.map((o) => o.action).join('  →  ')}</p>
            )}
            {(last.errors[0] || last.notes[0]) && <p className={`mt-1.5 text-[11px] ${last.errors[0] ? 'text-[var(--bad)]' : 'text-[var(--muted)]'}`}>{last.errors[0] ?? last.notes[0]}</p>}
            <dl className="tnum mt-3 grid grid-cols-4 gap-px overflow-hidden rounded-md bg-[var(--line)] text-center">
              {([['Voice→world', last.t.total], ['Speech', last.t.stt], ['Plan', last.t.parse], ['Apply', last.t.apply]] as const).map(([k, v], i) => (
                <div key={k} className="bg-[var(--panel)] px-1 py-2">
                  <dd className={`text-[12px] ${i === 0 ? 'font-semibold text-[var(--text)]' : 'text-[var(--text)]/85'}`}>{ms(v)}</dd>
                  <dt className="mt-0.5 text-[9.5px] uppercase tracking-wider text-[var(--faint)]">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-1.5 text-[10px] text-[var(--faint)]">Render, first frame after the edit: {ms(last.t.frame)} (GPU time, separate from command latency){last.provider ? ` · ${last.provider}` : ''}</p>
          </div>
        )}

        {/* ---- suggestions ---- */}
        <div className="section">
          <p className="eyebrow mb-2">Try saying</p>
          <ul className="-mx-2">
            {suggest(world).map((s) => (
              <li key={s}>
                <button onClick={() => submit(s, 'chip')} disabled={busy} className="group flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-[var(--text)]/90 transition hover:bg-white/[0.04] disabled:opacity-50">
                  <Icon name="chev" size={12} className="mt-1 shrink-0 text-[var(--faint)] transition group-hover:text-[var(--accent)]" />
                  <span>{s}</span>
                </button>
              </li>
            ))}
          </ul>
          <button className="mt-2 flex items-center gap-1.5 text-[11px] text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setScript(!script)} aria-expanded={script}>
            <Icon name="chev" size={11} className={`transition ${script ? 'rotate-90' : ''}`} />Demo script · 5 steps
          </button>
          {script && (
            <ol className="mt-2 space-y-px">
              {DEMO_STEPS.map((s, i) => (
                <li key={s.label}>
                  <button onClick={() => submit(s.text, 'chip')} disabled={busy} className="flex w-full gap-3 rounded-md px-2 py-1.5 text-left hover:bg-white/[0.04] disabled:opacity-50">
                    <span className="tnum w-3 shrink-0 font-mono text-[11px] text-[var(--accent)]">{i + 1}</span>
                    <span className="text-[11.5px] leading-snug text-[var(--muted)]"><b className="font-medium text-[var(--text)]">{s.label}.</b> {s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ---- history ---- */}
        <div className="section">
          <div className="mb-2 flex items-center">
            <p className="eyebrow">History</p>
            <label className="ml-auto flex items-center gap-1.5 text-[10.5px] text-[var(--muted)]" title={health?.gnani ? 'Speak short confirmations with Gnani Timbre' : 'Timbre unavailable'}>
              <input type="checkbox" checked={speakReplies} disabled={!health?.gnani} onChange={(e) => set({ speakReplies: e.target.checked })} className="accent-[var(--accent)]" />Timbre replies
            </label>
          </div>
          {!log.length && <p className="text-[11.5px] text-[var(--faint)]">Every command, what it compiled to, and what changed.</p>}
          <ul className="space-y-px">
            {[...log].reverse().map((l) => (
              <li key={l.id} className="grid grid-cols-[8px_1fr_auto] items-baseline gap-2 rounded-md px-1 py-1.5 hover:bg-white/[0.03]">
                <span className={`mt-1 h-1.5 w-1.5 rounded-full ${l.status === 'error' ? 'bg-[var(--bad)]' : l.status === 'pending' ? 'bg-[var(--accent)]' : l.status === 'partial' ? 'bg-[var(--accent)]' : 'bg-[var(--ok)]'}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[12px] text-[var(--text)]/90">{l.transcript}</span>
                  <span className="block truncate font-mono text-[10px] text-[var(--faint)]">{l.source === 'voice' ? '🎙 ' : ''}{l.ops.map((o) => o.action).join(' · ') || l.errors[0]}</span>
                </span>
                <span className="tnum text-[10px] text-[var(--faint)]">{l.t.total !== undefined ? ms(l.t.total) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form className="flex shrink-0 gap-2 border-t border-[var(--line)] p-3" onSubmit={(e) => { e.preventDefault(); submit(text); setText('') }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a command — “nadi ke upar pul banao”" className="field !h-8 flex-1" aria-label="Text command" />
        <button className="tool !h-8 !w-8 !p-0" disabled={busy || !text.trim()} aria-label="Run command"><Icon name="send" /></button>
      </form>
    </div>
  )
}
