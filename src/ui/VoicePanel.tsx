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
  ['indic-auto', 'Auto-detect'], ['hi-IN,en-IN', 'Hinglish'], ['hi-IN', 'Hindi'], ['mr-IN', 'Marathi'], ['mr-IN,en-IN', 'Minglish'], ['en-IN', 'English'],
]
const LANG_NAME: Record<string, string> = { 'hi-IN': 'Hindi', 'mr-IN': 'Marathi', 'en-IN': 'English', 'indic-auto': 'Auto' }

const PHASE: Record<string, string> = { idle: 'Ready', listening: 'Listening', transcribing: 'Transcribing with Gnani Prisma', interpreting: 'Understanding', applying: 'Building', done: 'Done', error: 'Needs attention' }

export const MANSION_STEPS = [
  'Ek luxury mansion banao, swimming pool ke saath',
  'Mansion ke andar sofa, kaleen aur jhoomar lagao',
  'Dining table aur bed bhi lagao, aur raat kar do',
  'Mansion ke andar camera le jao, 12 second ka video banao',
]

/** Next sensible things to say, given the world as it is now. */
function suggest(w: World): string[] {
  const bridges = w.entities.filter((e) => e.type === 'bridge')
  const mansion = w.entities.some((e) => e.type === 'mansion')
  if (mansion) {
    const furnished = w.entities.filter((e) => ['sofa', 'bed', 'table', 'chandelier', 'rug', 'plant'].includes(e.type)).length
    return furnished < 3 ? [MANSION_STEPS[1], MANSION_STEPS[2], 'Make a cinematic shot of the mansion'] : [MANSION_STEPS[3], 'बंगले में पौधे लगाओ', 'Make a cinematic shot of the mansion']
  }
  if (!w.entities.length) return [DEMO_STEPS[0].text, 'एक गाँव बनाओ', 'Make a wooden bridge across the river']
  if (bridges.some((b) => b.state === 'destroyed') && !bridges.some((b) => b.state === 'intact')) return [DEMO_STEPS[3].text, 'Rebuild the bridge in steel', 'Undo']
  if (bridges.length >= 2) return [DEMO_STEPS[4].text, MANSION_STEPS[0], 'raat kar do aur barish karo']
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
      <div className="flex h-14 shrink-0 items-center gap-3 px-6">
        <span className="text-[15px] font-medium tracking-[-0.005em]">Voice Studio</span>
        <select value={language} onChange={(e) => set({ language: e.target.value })} className="field bare ml-auto !h-7 !w-auto !text-[12.5px] text-[var(--muted)]" aria-label="Speech language">
          {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {onClose && <button className="tool -mr-2 lg:hidden" onClick={onClose} aria-label="Close Voice Studio"><Icon name="x" /></button>}
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        {/* ---- the microphone ---- */}
        <div className="px-6 pb-6 pt-2">
          <div className="flex items-center gap-5">
            <button onClick={() => void toggleMic()} disabled={busy} aria-pressed={listening} aria-label={listening ? 'Stop and transcribe' : 'Start speaking'}
              className={`relative grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full transition-all duration-500 disabled:opacity-50 ${listening ? 'bg-[var(--ink)] text-[#f4efe9]' : 'text-[var(--ink)] ring-1 ring-[var(--ink)]/70 hover:bg-[var(--ink)] hover:text-[#f4efe9]'}`}>
              {listening && <span className="breathe absolute -inset-3 rounded-full bg-[var(--ink)]/25" />}
              <Icon name={listening ? 'stop' : 'mic'} size={22} />
            </button>
            <div className="min-w-0 flex-1" aria-live="polite">
              <p className={`eyebrow ${phase === 'error' ? '!text-[var(--bad)]' : ''}`}>{PHASE[phase]}</p>
              <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-[var(--text)]/80">{message}</p>
            </div>
          </div>
          <div className="mt-6"><Waveform phase={phase} /></div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-[var(--faint)]">
            <span className={`h-1.5 w-1.5 rounded-full ${health?.gnani ? 'bg-[var(--ok)]' : 'bg-[var(--bad)]'}`} />
            Gnani Prisma {health?.sttModel?.replace('prisma-', '') ?? ''}
            <span className="opacity-40">/</span><span className="kbd">Space</span> to talk
            <span className="opacity-40">/</span>{sttCalls} call{sttCalls === 1 ? '' : 's'}
          </p>
        </div>

        {/* ---- what was heard and what it did ---- */}
        {last && (
          <div className="section">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">{last.source === 'voice' ? 'Heard' : 'Command'}</span>
              {last.source === 'voice' && <span className="text-[12px] text-[var(--muted)]">{LANG_NAME[last.language ?? ''] ?? last.language}</span>}
              <span className="ml-auto text-[11.5px] text-[var(--faint)]">{last.planner === 'groq' ? 'Groq planner' : last.planner === 'local' ? 'Local parser' : ''}</span>
            </div>
            <p className="mt-3 text-[21px] font-light leading-[1.3] tracking-[-0.005em] text-[var(--text)]">{last.transcript}</p>
            {!!last.ops.length && <p className="mt-3 font-mono text-[10.5px] leading-relaxed tracking-[0.02em] text-[var(--muted)]">{last.ops.map((o) => o.action).join('  ·  ')}</p>}
            {(last.errors[0] || last.notes[0]) && <p className={`mt-2 text-[12px] ${last.errors[0] ? 'text-[var(--bad)]' : 'text-[var(--muted)]'}`}>{last.errors[0] ?? last.notes[0]}</p>}
            <dl className="tnum mt-5 grid grid-cols-4 divide-x divide-[var(--line)] border-y border-[var(--line)]">
              {([['Total', last.t.total], ['Speech', last.t.stt], ['Plan', last.t.parse], ['Apply', last.t.apply]] as const).map(([k, v], i) => (
                <div key={k} className={`py-3 ${i ? 'pl-3' : 'pr-3'}`}>
                  <dd className={`text-[14px] ${i === 0 ? 'font-medium' : 'text-[var(--text)]/80'}`}>{ms(v)}</dd>
                  <dt className="mt-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--faint)]">{k}</dt>
                </div>
              ))}
            </dl>
            <p className="mt-2.5 text-[11px] leading-snug text-[var(--faint)]">First frame after the edit: {ms(last.t.frame)}. Total runs from end of speech to world applied; GPU render is measured separately.{last.provider ? ` ${last.provider}.` : ''}</p>
          </div>
        )}

        {/* ---- suggestions ---- */}
        <div className="section">
          <p className="eyebrow mb-3">Try saying</p>
          <ul className="divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {suggest(world).map((s) => (
              <li key={s}>
                <button onClick={() => submit(s, 'chip')} disabled={busy} className="group flex w-full items-center gap-3 py-3 text-left text-[13.5px] text-[var(--text)]/85 transition hover:text-[var(--text)] disabled:opacity-50">
                  <span className="flex-1">{s}</span>
                  <Icon name="arrow" size={14} className="shrink-0 -translate-x-1 text-[var(--faint)] transition group-hover:translate-x-0 group-hover:text-[var(--ink)]" />
                </button>
              </li>
            ))}
          </ul>
          <button className="link-quiet mt-4 text-[12.5px] !text-[var(--muted)]" onClick={() => setScript(!script)} aria-expanded={script}>{script ? 'Hide' : 'Show'} the five-step demo</button>
          {script && (
            <ol className="mt-3 space-y-1">
              {DEMO_STEPS.map((s, i) => (
                <li key={s.label}>
                  <button onClick={() => submit(s.text, 'chip')} disabled={busy} className="flex w-full gap-3 rounded-[2px] py-2 text-left transition hover:bg-[rgba(58,52,48,0.04)] disabled:opacity-50">
                    <span className="tnum w-5 shrink-0 text-[12px] text-[var(--faint)]">0{i + 1}</span>
                    <span className="text-[12.5px] leading-snug text-[var(--muted)]"><span className="text-[var(--text)]">{s.label}</span>, {s.text}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        {/* ---- history ---- */}
        <div className="section">
          <div className="mb-3 flex items-center">
            <p className="eyebrow">History</p>
            <label className="ml-auto flex items-center gap-2 text-[11.5px] text-[var(--muted)]" title={health?.gnani ? 'Speak short confirmations with Gnani Timbre' : 'Timbre unavailable'}>
              <input type="checkbox" checked={speakReplies} disabled={!health?.gnani} onChange={(e) => set({ speakReplies: e.target.checked })} className="accent-[var(--ink)]" />Timbre replies
            </label>
          </div>
          {!log.length && <p className="text-[12.5px] text-[var(--faint)]">Every command, what it compiled to, and what changed.</p>}
          <ul>
            {[...log].reverse().map((l) => (
              <li key={l.id} className="grid grid-cols-[6px_1fr_auto] items-baseline gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
                <span className={`h-1.5 w-1.5 -translate-y-px rounded-full ${l.status === 'error' ? 'bg-[var(--bad)]' : l.status === 'ok' ? 'bg-[var(--ok)]' : 'bg-[var(--faint)]'}`} />
                <span className="min-w-0">
                  <span className="block truncate text-[13px] text-[var(--text)]/90">{l.transcript}</span>
                  <span className="block truncate font-mono text-[10px] text-[var(--faint)]">{l.source === 'voice' ? 'voice · ' : ''}{l.ops.map((o) => o.action).join(' · ') || l.errors[0]}</span>
                </span>
                <span className="tnum text-[11px] text-[var(--faint)]">{l.t.total !== undefined ? ms(l.t.total) : ''}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <form className="flex shrink-0 items-center gap-2 border-t border-[var(--line)] px-6 py-4" onSubmit={(e) => { e.preventDefault(); submit(text); setText('') }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a command, e.g. “nadi ke upar pul banao”" className="h-9 min-w-0 flex-1 border-b border-[var(--line-2)] bg-transparent text-[13.5px] placeholder:text-[var(--faint)] focus:border-[var(--ink)] focus:outline-none" aria-label="Text command" />
        <button className="tool !h-9 !w-9 !p-0" disabled={busy || !text.trim()} aria-label="Run command"><Icon name="arrow" /></button>
      </form>
    </div>
  )
}
