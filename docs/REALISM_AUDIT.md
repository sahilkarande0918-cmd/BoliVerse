# Realism audit (before → after)

All captures come from the same seeded scene ("Ek beautiful Indian village banao, beech mein nadi ho, aur wooden bridge ho."), rendered frame-exact by `src/dev/realismShots.ts` (`captureSet(tag, quality)`). The images are in `docs/realism/`.

| View | Before (pre-realism, Medium) | After: High | After: Ultra |
|---|---|---|---|
| Overview | `before-overview.jpg` | `hi-day-overview.jpg` | `ultra-day-overview.jpg` |
| River | `before-river.jpg` | `hi-day-river.jpg` | `ultra-day-river.jpg` |
| House | `before-house.jpg` | `hi-day-house.jpg` | `ultra-day-house.jpg` |
| Bridge | `before-bridge.jpg` | `hi-day-bridge.jpg` | `ultra-day-bridge.jpg` |
| Sunset | `before-sunset.jpg` | `hi-sunset-overview.jpg`, `hi-sunset-river.jpg` | `ultra-sunset-overview.jpg`, `ultra-sunset-river.jpg` |
| Sunrise | n/a | `hi-sunrise-*.jpg` | `ultra-sunrise-*.jpg` |
| Rain | n/a | `hi-rain-*.jpg` | `ultra-rain-*.jpg` |
| Night | n/a | `hi-night-overview.jpg` | `ultra-night-overview.jpg` |

## What changed (visible in the captures)
- **Before:** flat-shaded canvas textures, procedural light cards instead of a sky, a matte blue river, lollipop trees and no grass.
- **After:**
  - photographed HDRI sky with real clouds
  - PBR plaster, clay tile, plank, stone and terrain
  - a mirror river reflecting the bridge, trees and sky; at sunset the sun's glare sits on the water
  - palms, broadleaf and conifer trees moving in the wind
  - dense grass with flowers
  - rain darkens the sky and wets the ground

## Measured cost (1280×720 target, this dev laptop)
| Tier | Median ms/frame | p95 ms | Draw calls | Triangles |
|---|---|---|---|---|
| Before (Medium) | 1.9 | 2.5 | 370 | 71k |
| High | 8.7 | 98.8 | 1,183 | 1.46M |
| Ultra | 63.7* | 223.2* | 1,183 | 2.58M |

\*The 9 Nov 2026 Ultra run rendered at device-pixel-ratio 2 (the saved frames are 2560×1440, four times the pixels), in a hidden browser pane (background-throttled). An earlier, visible-pane Ultra run measured 19.8 ms median. The p95 spikes on High and Ultra are first-use shader compiles.

## Honest status
- This is stylised-realistic real-time 3D, **not photorealism**. The buildings are still simple procedural boxes with PBR materials, and the leaf cards read as foliage only at mid distance.
- No CC0 realistic animal or vehicle models are available, so "cow banao" and "car banao" are refused with a message rather than rendered as cartoons.
