import { useState } from 'react'
import type { CameraPreset } from '../compiler/schema'
import { useStudio } from '../store'
import { Icon } from './Icon'

const SHOTS: [CameraPreset, string, string][] = [
  ['establishing', 'Establishing', 'A high arc that settles into the village'],
  ['river_reveal', 'River reveal', 'Skims the water, rises to the village'],
  ['bridge_flythrough', 'Bridge flythrough', 'Low over the river, up and over the bridge'],
  ['under_bridge', 'Under the bridge', 'Passes beneath the deck'],
  ['destruction', 'Destruction', 'A slow push-in on the crossing'],
  ['sunset_panorama', 'Panorama', 'A wide lateral pan from the west bank'],
  ['orbit', 'Orbit', 'A full circle around the subject'],
  ['mansion_reveal', 'Mansion reveal', 'A sweeping arc onto the glass façade'],
  ['interior', 'Interior walkthrough', 'An eye-level glide through the rooms'],
]

// Film mode: a shot list, a single-clip timeline, and capture/export.
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
    <div className="grid grid-cols-1 gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_300px] lg:p-6">
      <div className="min-w-0">
        <div className="flex items-baseline gap-4">
          <span className="eyebrow">Shot</span>
          <span className="text-[15px]">{meta[1]}</span>
          <span className="truncate text-[12.5px] text-[var(--muted)] max-sm:hidden">{meta[2]}</span>
        </div>
        <div className="scroll-thin mt-2 overflow-x-auto">
          <div className="tabs sm min-w-max">
            {SHOTS.map(([k, l]) => <button key={k} aria-selected={preset === k} onClick={() => setPreset(k)}>{l}</button>)}
          </div>
        </div>
        <div className="mt-4">
          <div className="tnum flex justify-between font-mono text-[10px] text-[var(--faint)]">
            {Array.from({ length: 6 }, (_, i) => <span key={i}>{(i * 20) / 5}s</span>)}
          </div>
          <div className="relative mt-1.5 h-9 border-y border-[var(--line)]">
            <div className="absolute inset-y-1.5 left-0 flex items-center rounded-[2px] bg-[var(--sand)] px-3 text-[11.5px] text-[var(--text)] transition-[width] duration-300" style={{ width: `${(dur / 20) * 100}%` }}>
              <span className="truncate">{meta[1]} · {dur}s</span>
            </div>
            {busy && <div className="absolute inset-y-0 w-px bg-[var(--ink)]" style={{ left: `${recording.progress * (dur / 20) * 100}%` }} />}
          </div>
          <input type="range" min={4} max={20} value={dur} onChange={(e) => setDur(+e.target.value)} className="mt-3 w-full accent-[var(--ink)]" aria-label="Shot duration in seconds" />
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:border-l lg:border-[var(--line)] lg:pl-6">
        <div className="flex items-center gap-4">
          <span className="eyebrow">Aspect</span>
          <div className="tabs sm">{(['16:9', '9:16'] as const).map((a) => <button key={a} aria-selected={aspect === a} onClick={() => setAspect(a)}>{a}</button>)}</div>
          <span className="ml-auto text-[11.5px] text-[var(--faint)]">720p · 30 fps</span>
        </div>
        <div className="flex gap-2">
          <button className="btn-line flex-1" onClick={() => go(false)} disabled={busy}><Icon name="play" size={12} />Preview</button>
          <button className="btn-ink flex-1 !h-[34px]" onClick={() => go(true)} disabled={busy}>{busy ? `${Math.round(recording.progress * 100)}%` : 'Record'}</button>
        </div>
        <div className="min-h-[34px] text-[12px]">
          {recording.state === 'ready' && recording.url ? (
            <a className="link-quiet inline-flex items-center gap-2" href={recording.url} download={recording.fileName}>
              <Icon name="down" size={13} />Download {recording.format}, {((recording.sizeBytes ?? 0) / 1e6).toFixed(1)} MB, {recording.durationSec}s, no audio
            </a>
          ) : recording.state === 'error' ? <span className="text-[var(--bad)]">{recording.message}</span>
            : <span className="leading-snug text-[var(--faint)]">Renders this live world frame by frame. MP4 (H.264) where WebCodecs supports it, otherwise labelled WebM.</span>}
        </div>
      </div>
    </div>
  )
}
