import { useState } from 'react'
import { useStudio } from '../store'
import { toggleMic } from '../voice/controller'
import { Icon } from './Icon'

export const DEMO_STEPS = [
  { label: 'Create', text: 'Ek beautiful Indian village banao, beech mein nadi ho, aur wooden bridge ho.' },
  { label: 'Edit', text: 'Bridge thoda bada karo, aur sunset kar do.' },
  { label: 'Destroy', text: 'Ab bridge tod do.' },
  { label: 'Rebuild', text: 'Ab stone bridge banao, same jagah.' },
  { label: 'Film', text: 'Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.' },
]
const MORE = ['पाच झाडे लावा', 'मंदिर के पास तीन घर बनाओ', 'barish karo', 'raat kar do', 'Paint it red', 'Push the rocks', 'Undo']

const LANGS: [string, string][] = [
  ['indic-auto', 'Auto-detect'], ['hi-IN,en-IN', 'Hinglish'], ['hi-IN', 'Hindi'], ['mr-IN', 'Marathi'], ['mr-IN,en-IN', 'Marathi + English'], ['en-IN', 'English (India)'],
]

const PHASE_LABEL: Record<string, string> = { idle: 'Ready', listening: 'Listening', transcribing: 'Transcribing', interpreting: 'Understanding', applying: 'Building', done: 'Done', error: 'Attention' }

export function VoicePanel() {
  const { phase, message, level, language, set, run, log, health, speakReplies, sttCalls } = useStudio()
  const [text, setText] = useState('')
  const busy = phase === 'transcribing' || phase === 'interpreting' || phase === 'applying'
  const submit = (t: string, source: 'text' | 'chip' = 'text') => { if (t.trim() && !busy) void run(t.trim(), source) }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="space-y-4 border-b border-[var(--line)] p-4">
        <div className="flex items-center gap-4">
          <button onClick={() => void toggleMic()} disabled={busy}
            className={`relative grid h-16 w-16 shrink-0 place-items-center rounded-full transition ${phase === 'listening' ? 'bg-[var(--bad)] text-white' : 'bg-[var(--gold)] text-[#17120a] hover:bg-[var(--gold-2)]'} disabled:opacity-50`}
            aria-label={phase === 'listening' ? 'Stop listening' : 'Start speaking'} aria-pressed={phase === 'listening'}>
            {phase === 'listening' && <span className="mic-ring absolute inset-0 rounded-full border-2 border-[var(--bad)]" />}
            <span className="absolute inset-[-6px] rounded-full border border-[var(--gold)]/40 transition-transform" style={{ transform: `scale(${1 + level * 0.35})`, opacity: phase === 'listening' ? 1 : 0 }} />
            <Icon name={phase === 'listening' ? 'stop' : 'mic'} size={24} />
          </button>
          <div className="min-w-0 flex-1" aria-live="polite">
            <div className="flex items-center gap-2">
              <span className={`h-1.5 w-1.5 rounded-full ${phase === 'error' ? 'bg-[var(--bad)]' : busy || phase === 'listening' ? 'bg-[var(--gold)] animate-pulse' : 'bg-[var(--ok)]'}`} />
              <span className="label">{PHASE_LABEL[phase]}</span>
            </div>
            <p className={`mt-1 text-[13px] leading-snug ${phase === 'error' ? 'text-[#f0a594]' : 'text-[var(--text)]'}`}>{message}</p>
            {busy && <div className="shimmer mt-2 h-0.5 rounded" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={language} onChange={(e) => set({ language: e.target.value })} className="h-8 min-w-0 flex-1 rounded-lg border border-[var(--line-2)] bg-[var(--panel-2)] px-2 text-xs" aria-label="Speech language">
            {LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className={`flex items-center gap-1.5 text-[11px] ${health?.gnani ? 'text-[var(--muted)]' : 'text-[var(--muted)] opacity-50'}`} title={health?.gnani ? 'Short spoken confirmations via Gnani Timbre' : 'Timbre unavailable on this deployment'}>
            <input type="checkbox" checked={speakReplies} disabled={!health?.gnani} onChange={(e) => set({ speakReplies: e.target.checked })} className="accent-[var(--gold)]" />
            Timbre replies
          </label>
        </div>
        <p className="text-[10.5px] leading-relaxed text-[var(--muted)]">
          Speech → <b className="font-medium text-[var(--text)]">Gnani Prisma</b> ({health?.sttModel ?? '…'}) · Space toggles the mic · {sttCalls} Prisma call{sttCalls === 1 ? '' : 's'} this session
        </p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(text); setText('') }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type: “nadi ke upar pul banao”" className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--line-2)] bg-[var(--panel-2)] px-3 text-sm placeholder:text-[var(--muted)]/70" aria-label="Text command" />
          <button className="btn h-9 w-9 p-0" disabled={busy || !text.trim()} aria-label="Run command"><Icon name="send" /></button>
        </form>
      </div>

      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-2 border-b border-[var(--line)] p-4">
          <p className="label">Signature demo</p>
          <ol className="space-y-1.5">
            {DEMO_STEPS.map((s, i) => (
              <li key={s.label}>
                <button className="chip w-full gap-2" onClick={() => submit(s.text, 'chip')} disabled={busy}>
                  <span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/5 text-[10px] text-[var(--gold)]">{i + 1}</span>
                  <span className="min-w-0"><b className="font-medium">{s.label}</b> <span className="text-[var(--muted)]">— {s.text}</span></span>
                </button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-1.5 pt-1">{MORE.map((m) => <button key={m} className="chip" onClick={() => submit(m, 'chip')} disabled={busy}>{m}</button>)}</div>
        </div>
        <div className="p-4">
          <p className="label mb-2">History</p>
          {!log.length && <p className="text-xs text-[var(--muted)]">Every utterance, the operations it compiled to, and what changed will appear here.</p>}
          <ul className="space-y-2">
            {[...log].reverse().map((l) => (
              <li key={l.id} className="rounded-xl border border-[var(--line)] bg-white/[0.02] p-2.5 text-xs">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-[var(--muted)]">
                  <span className={`rounded px-1.5 py-px ${l.source === 'voice' ? 'bg-[var(--gold)]/15 text-[var(--gold)]' : 'bg-white/5'}`}>{l.source === 'voice' ? `voice · ${l.language ?? ''}` : l.source}</span>
                  <span className="rounded bg-white/5 px-1.5 py-px">{l.planner}</span>
                  <span className={`ml-auto ${l.status === 'error' ? 'text-[var(--bad)]' : l.status === 'partial' ? 'text-[var(--gold)]' : 'text-[var(--ok)]'}`}>{l.status}</span>
                  {l.t.total !== undefined && <span className="tnum">{Math.round(l.t.total)} ms</span>}
                </div>
                <p className="text-[var(--text)]">{l.transcript}</p>
                {!!l.ops.length && <p className="mt-1 font-mono text-[10px] text-[var(--gold-2)]/90">{l.ops.map((o) => o.action).join(' → ')}</p>}
                {(l.errors[0] || l.notes[0]) && <p className={`mt-1 text-[10.5px] ${l.errors[0] ? 'text-[#f0a594]' : 'text-[var(--muted)]'}`}>{l.errors[0] ?? l.notes[0]}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
