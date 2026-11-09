import { useState } from 'react'
import type { CameraPreset } from '../compiler/schema'
import { useStudio } from '../store'
import { Icon } from './Icon'

const SHOTS: [CameraPreset, string, string][] = [
  ['establishing', 'Establishing', 'High arc descending into the village'],
  ['river_reveal', 'River reveal', 'Skims the water, rises to the village'],
  ['bridge_flythrough', 'Bridge flythrough', 'Low over the river, up and over the bridge'],
  ['under_bridge', 'Under the bridge', 'Passes beneath the deck'],
  ['destruction', 'Destruction', 'Slow push-in on the crossing'],
  ['sunset_panorama', 'Panorama', 'Wide lateral pan from the west bank'],
  ['orbit', 'Orbit', '360° around the subject'],
  ['mansion_reveal', 'Mansion reveal', 'Sweeping arc onto the glass façade'],
  ['interior', 'Interior walkthrough', 'Eye-level glide through the furnished rooms'],
]

// Film mode: a shot track over a time ruler, plus capture/export.
export function Timeline() {
  const shot = useStudio((s) => s.shot)
  const recording = useStudio((s) => s.recording)
  const run = useStudio((s) => s.run)
  const [preset, setPreset] = useState<CameraPreset>(shot?.preset ?? 'bridge_flythrough')
  const [dur, setDur] = useState(shot?.durationSec ?? 10)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>(shot?.aspect ?? '16:9')
  const busy = recording.state === 'recording'
  const go = (record: boolean) => void run(`${record ? 'record' : 'preview'} ${preset} ${dur}s ${aspect}`, 'text', {}, [
    { action: 'CREATE_CAMERA_PATH', preset, durationSec: dur },
    record ? { action: 'START_RECORDING', durationSec: dur, aspect } : { action: 'PLAY_CAMERA_PATH' },
  ])
  const meta = SHOTS.find((s) => s[0] === preset)!

  return (
    <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_280px] lg:px-5">
      <div className="min-w-0">
        <div className="mb-2 flex items-baseline gap-3">
          <span className="eyebrow">Shot</span>
          <span className="text-[13px] font-medium">{meta[1]}</span>
          <span className="truncate text-[11px] text-[var(--muted)]">{meta[2]}</span>
        </div>
        <div className="scroll-thin flex gap-1 overflow-x-auto pb-1">
          {SHOTS.map(([k, l]) => (
            <button key={k} onClick={() => setPreset(k)} className={`h-7 shrink-0 rounded-md px-2.5 text-[11.5px] transition ${preset === k ? 'bg-[var(--accent)]/15 text-[var(--accent-2)] ring-1 ring-[var(--accent)]/50' : 'text-[var(--muted)] ring-1 ring-[var(--line)] hover:text-[var(--text)]'}`}>{l}</button>
          ))}
        </div>
        {/* ruler + clip */}
        <div className="mt-3">
          <div className="tnum flex justify-between font-mono text-[9.5px] text-[var(--faint)]">
            {Array.from({ length: 6 }, (_, i) => <span key={i}>{Math.round((i * 20) / 5)}s</span>)}
          </div>
          <div className="relative mt-1 h-8 rounded-md bg-[var(--raised)] ring-1 ring-[var(--line)]">
            <div className="absolute inset-y-1 left-1 flex items-center rounded-[4px] bg-[var(--accent)]/20 px-2 text-[10.5px] text-[var(--accent-2)] ring-1 ring-[var(--accent)]/40 transition-[width] duration-200" style={{ width: `calc(${(dur / 20) * 100}% - 8px)` }}>
              <span className="truncate">{meta[1]} · {dur}s</span>
            </div>
            {busy && <div className="absolute inset-y-0 w-px bg-[var(--text)]" style={{ left: `${recording.progress * (dur / 20) * 100}%` }} />}
          </div>
          <input type="range" min={4} max={20} value={dur} onChange={(e) => setDur(+e.target.value)} className="mt-2 w-full accent-[var(--accent)]" aria-label="Shot duration in seconds" />
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:border-l lg:border-[var(--line)] lg:pl-5">
        <div className="flex items-center gap-2">
          <span className="eyebrow w-14">Aspect</span>
          <div className="seg">{(['16:9', '9:16'] as const).map((a) => <button key={a} aria-selected={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div>
          <span className="ml-auto text-[10.5px] text-[var(--faint)]">720p · 30 fps</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-line flex-1" onClick={() => go(false)} disabled={busy}><Icon name="play" size={12} />Preview</button>
          <button className="btn-primary flex-1" onClick={() => go(true)} disabled={busy}><Icon name="rec" size={12} />{busy ? `${Math.round(recording.progress * 100)}%` : 'Record'}</button>
        </div>
        <div className="min-h-[30px] text-[11px]">
          {recording.state === 'ready' && recording.url ? (
            <a className="btn-line w-full !justify-start" href={recording.url} download={recording.fileName}>
              <Icon name="down" size={13} /><span className="truncate">{recording.format} · {((recording.sizeBytes ?? 0) / 1e6).toFixed(1)} MB · {recording.durationSec}s · no audio</span>
            </a>
          ) : recording.state === 'error' ? <span className="text-[var(--bad)]">{recording.message}</span>
            : <span className="text-[var(--faint)]">Renders this live world frame by frame. MP4 (H.264) via WebCodecs where supported, otherwise labelled WebM.</span>}
        </div>
      </div>
    </div>
  )
}
