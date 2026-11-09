import { useEffect, useRef } from 'react'
import type { Phase } from '../store'
import { wave, waveHead } from '../voice/controller'

// Audio-reactive waveform: live mic samples while listening, a calm line otherwise.
export function Waveform({ phase }: { phase: Phase }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    const g = c.getContext('2d')!
    let raf = 0
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const draw = (t: number) => {
      const dpr = devicePixelRatio || 1
      const w = c.clientWidth, h = c.clientHeight
      if (c.width !== w * dpr) { c.width = w * dpr; c.height = h * dpr }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const bars = Math.floor(w / 5)
      const head = waveHead()
      const seg = Math.floor(wave.length / bars)
      for (let i = 0; i < bars; i++) {
        let amp: number
        if (phase === 'listening') {
          let s = 0
          for (let j = 0; j < seg; j++) { const v = wave[(head + i * seg + j) % wave.length]; s += v * v }
          amp = Math.min(1, Math.sqrt(s / seg) * 7)
        } else if (phase === 'transcribing' || phase === 'interpreting' || phase === 'applying') {
          amp = reduced ? 0.15 : 0.12 + 0.18 * Math.max(0, Math.sin(i * 0.35 - t / 160))
        } else amp = 0.04
        const bh = Math.max(1.5, amp * h * 0.9)
        g.fillStyle = phase === 'error' ? 'rgba(166,90,72,0.55)' : phase === 'listening' ? `rgba(52,48,45,${0.35 + amp * 0.65})` : 'rgba(58,52,48,0.22)'
        g.fillRect(i * 5, (h - bh) / 2, 1.5, bh)
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [phase])
  return <canvas ref={ref} className="h-10 w-full" aria-hidden="true" />
}
