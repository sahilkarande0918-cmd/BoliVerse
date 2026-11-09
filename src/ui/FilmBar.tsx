import { useState } from 'react'
import type { CameraPreset } from '../compiler/schema'
import { useStudio } from '../store'
import { Icon } from './Icon'

const PRESETS: [CameraPreset, string][] = [
  ['establishing', 'Establishing village'], ['river_reveal', 'River reveal'], ['bridge_flythrough', 'Bridge flythrough'],
  ['under_bridge', 'Under the bridge'], ['destruction', 'Destruction close-up'], ['sunset_panorama', 'Sunset panorama'], ['orbit', 'Orbit'],
]

export function FilmBar() {
  const { shot, recording, run, set } = useStudio()
  const [preset, setPreset] = useState<CameraPreset>(shot?.preset ?? 'bridge_flythrough')
  const [dur, setDur] = useState(shot?.durationSec ?? 10)
  const [aspect, setAspect] = useState<'16:9' | '9:16'>(shot?.aspect ?? '16:9')
  const busy = recording.state === 'recording'
  const go = (record: boolean) => void run(`${record ? 'record' : 'preview'} ${preset} ${dur}s ${aspect}`, 'text', {}, [
    { action: 'CREATE_CAMERA_PATH', preset, durationSec: dur },
    record ? { action: 'START_RECORDING', durationSec: dur, aspect } : { action: 'PLAY_CAMERA_PATH' },
  ])

  return (
    <div className="flex flex-col gap-3 p-4 text-xs lg:flex-row lg:items-center lg:gap-5 lg:px-5 lg:py-3">
      <div className="flex items-center gap-2"><Icon name="film" className="text-[var(--gold)]" /><span className="label">Film</span></div>
      <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1 lg:pb-0">
        {PRESETS.map(([k, l]) => (
          <button key={k} onClick={() => setPreset(k)} className={`chip shrink-0 ${preset === k ? '!border-[var(--gold)] !text-[var(--gold)]' : ''}`}>{l}</button>
        ))}
      </div>
      <label className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-[var(--muted)]">Duration</span>
        <input type="range" min={4} max={20} value={dur} onChange={(e) => setDur(+e.target.value)} className="w-24 accent-[var(--gold)]" aria-label="Shot duration seconds" />
        <span className="tnum w-7">{dur}s</span>
      </label>
      <div className="flex rounded-full border border-[var(--line-2)] p-0.5">
        {(['16:9', '9:16'] as const).map((a) => <button key={a} onClick={() => setAspect(a)} className={`h-6 rounded-full px-2.5 ${aspect === a ? 'bg-white/10 text-[var(--text)]' : 'text-[var(--muted)]'}`}>{a}</button>)}
      </div>
      <div className="flex gap-2">
        <button className="btn" onClick={() => go(false)} disabled={busy}><Icon name="play" size={14} />Preview</button>
        <button className="btn btn-gold" onClick={() => go(true)} disabled={busy}><Icon name="rec" size={14} />Record 720p</button>
      </div>
      <div className="min-w-0 lg:ml-auto">
        {recording.state === 'ready' && recording.url && (
          <a className="btn" href={recording.url} download={recording.fileName}>
            <Icon name="down" size={14} />Download {recording.format} · {((recording.sizeBytes ?? 0) / 1e6).toFixed(1)} MB · {recording.durationSec}s · silent
          </a>
        )}
        {recording.state === 'error' && <span className="text-[#f0a594]">{recording.message}</span>}
        {recording.state === 'idle' && recording.message && <span className="text-[var(--muted)]">{recording.message}</span>}
        {recording.state === 'idle' && !recording.message && <span className="text-[var(--muted)]">Exports render the live scene frame by frame. MP4 (H.264) where WebCodecs supports it, otherwise labelled WebM.</span>}
      </div>
      <button className="btn btn-ghost h-7 px-2 lg:hidden" onClick={() => set({ mode: 'build' })}>Close</button>
    </div>
  )
}
