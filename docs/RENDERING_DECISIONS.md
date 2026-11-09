# Rendering decisions

Goal: a world that looks natural, like a shader pack (golden hour, mirror water, god rays, clouds, lush vegetation, wet rain), while staying **live, editable, physics-driven 3D** in a free-tier browser app. There are no GPU servers, and no pre-rendered footage is passed off as live.

## Adopted

| Technique | Where | Why |
|---|---|---|
| CC0 PBR textures (Poly Haven, 1k diff/nor/arm) with metre-scaled UVs (`uvBox`) | `pbr.ts`, `Entities.tsx`, `Terrain.tsx` | Real albedo, normal and roughness data does the most for realism at the lowest cost. Metre UVs keep brick, tile and plank sizes consistent. |
| Blended terrain shader (grass/ground/mud + wetness) via `onBeforeCompile` | `Terrain.tsx` | One draw call; rain darkens the ground and lowers its roughness. |
| Poly Haven HDRI lighting + photographed sky backdrop, with the sun aligned to the photo's sun | `Atmosphere.tsx` | Real skies and image-based lighting; the shadows match the visible sun. |
| drei `MeshReflectorMaterial` planar mirror river (Medium+) with flowing normals | `Terrain.tsx` | Real reflections of the bridge, trees and sky. Grass is on render layer 1, so the reflection camera skips it (big frame-time saving). |
| postprocessing `GodRays` from an emissive sun mesh, plus Bloom, colour grade, ACES tone map, vignette and grain | `Scene3D.tsx` | The look of a shader pack, done as post effects. |
| drei `Clouds` with a project-made sprite (High+) | `Atmosphere.tsx` | Volumetric-looking clouds that move. |
| Procedural instanced trees (bark tubes + alpha leaf cards, crown normals, wind vertex shader); dense grass clumps and flowers; shrubs | `Trees.tsx`, `Terrain.tsx` | Organic silhouettes at an instanced cost. No downloads, and every tree is still editable by voice. |
| CC0 scanned-model library (Poly Haven, CORS `*`, 12 MB cap), with a procedural fallback | `library.ts`, `Props.tsx`, `Mansion.tsx` | "Anything the user asks for" gets a real scanned model when one exists. When none exists (animals, cars), it is refused honestly. |
| Quality tiers Low / Medium / High / Ultra | `store.ts`, `Scene3D.tsx`, `Atmosphere.tsx` | Each tier really is different (DPR, shadow map, grass count, reflector resolution, god-ray samples, clouds, MSAA). Adaptive quality is disabled while recording. |

## Rejected (and why)

| Option | Reason |
|---|---|
| N8AO, postprocessing SSAO | Incompatible with three r187 in this stack: blank or crashing frames. |
| `SoftShadows` (PCSS) + MSAA 8 on Ultra | Produced blank grey frames; removed. Ultra was re-verified on 9 Nov 2026 after this. |
| threejs-worldgen | WebGPU-first; it would replace the editable entity world. |
| realism-effects (SSGI/TRAA) | Work in progress and incompatible with our three version. |
| three-gpu-pathtracer | Too slow to stay interactive; not usable for live editing. |
| Zephyr / other shader packs | Not evaluated in code; out of time. |
| Pre-rendered or AI-generated video | It would fake live behaviour, which our honesty rule forbids. |
