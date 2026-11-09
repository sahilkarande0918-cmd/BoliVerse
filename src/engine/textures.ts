import * as THREE from 'three'
import { rng } from './world'

// Procedurally generated detail textures (self-made at runtime → no licensing, no downloads).
// They are mostly near-white so they modulate each material's colour rather than replace it.

function canvasTex(size: number, draw: (g: CanvasRenderingContext2D, r: () => number) => void, repeat: number) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  draw(g, rng(size * 7 + repeat))
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(repeat, repeat)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export const TEX = {
  grass: canvasTex(512, (g, r) => {
    g.fillStyle = '#e9ece0'
    g.fillRect(0, 0, 512, 512)
    for (let i = 0; i < 9000; i++) {
      const v = 150 + r() * 105
      g.fillStyle = `rgba(${v * 0.85},${v},${v * 0.7},${0.25 + r() * 0.35})`
      const x = r() * 512, y = r() * 512
      g.fillRect(x, y, 1 + r() * 2, 2 + r() * 5)
    }
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(120,110,80,${0.05 + r() * 0.08})`
      g.beginPath(); g.arc(r() * 512, r() * 512, 10 + r() * 40, 0, 7); g.fill()
    }
  }, 70),
  plaster: canvasTex(256, (g, r) => {
    g.fillStyle = '#f4f1ea'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(${90 + r() * 60},${80 + r() * 50},${60 + r() * 40},${0.03 + r() * 0.05})`
      g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 18, 0, 7); g.fill()
    }
    const grd = g.createLinearGradient(0, 200, 0, 256) // damp stain near the plinth
    grd.addColorStop(0, 'rgba(70,55,40,0)'); grd.addColorStop(1, 'rgba(70,55,40,0.22)')
    g.fillStyle = grd; g.fillRect(0, 200, 256, 56)
  }, 1),
  tiles: canvasTex(128, (g, r) => {
    g.fillStyle = '#e8e2dc'
    g.fillRect(0, 0, 128, 128)
    for (let y = 0; y < 128; y += 16) {
      for (let x = (y / 16) % 2 ? -8 : 0; x < 128; x += 16) {
        const v = 200 + r() * 55
        g.fillStyle = `rgb(${v},${v * 0.95},${v * 0.92})`
        g.fillRect(x + 1, y + 1, 14, 13)
        g.fillStyle = 'rgba(40,20,10,0.35)'
        g.fillRect(x + 1, y + 12, 14, 2)
      }
    }
  }, 3),
  wood: canvasTex(256, (g, r) => {
    g.fillStyle = '#efe6dc'
    g.fillRect(0, 0, 256, 256)
    for (let i = 0; i < 90; i++) {
      g.strokeStyle = `rgba(80,50,30,${0.06 + r() * 0.12})`
      g.lineWidth = 0.5 + r() * 1.5
      const y = r() * 256
      g.beginPath(); g.moveTo(0, y)
      for (let x = 0; x <= 256; x += 32) g.lineTo(x, y + Math.sin(x * 0.05 + i) * 2)
      g.stroke()
    }
  }, 1),
  stone: canvasTex(256, (g, r) => {
    g.fillStyle = '#e6e3de'
    g.fillRect(0, 0, 256, 256)
    for (let y = 0; y < 256; y += 32) {
      for (let x = (y / 32) % 2 ? -24 : 0; x < 256; x += 48) {
        const v = 190 + r() * 60
        g.fillStyle = `rgb(${v},${v * 0.98},${v * 0.95})`
        g.fillRect(x + 2, y + 2, 44, 28)
      }
    }
  }, 2),
}
