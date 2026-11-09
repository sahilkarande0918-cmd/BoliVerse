# Tech stack: accepted and rejected tools

Every tool was checked for licence, maintenance, browser support, performance cost and real benefit, and the build stays inside free tiers. Versions are pinned in `package.json`.

## Accepted

| Tool | Version | Licence | Why |
|---|---|---|---|
| React + Vite + TypeScript | 19.3 / 8.3 / 5.9 | MIT | Standard SPA toolchain, with Vercel zero-config builds. TS 5.9 was chosen over 7.0 for tooling stability. |
| three.js | 0.187 | MIT | WebGL renderer. |
| @react-three/fiber | 9.8 | MIT | Declarative scene graph. `advance()` with `frameloop='never'` gives frame-exact video export. |
| @react-three/drei | 10.7 | MIT | Sky, Stars, Environment + Lightformer (procedural env map, no HDR download), OrbitControls, Instances, Html. |
| @react-three/rapier (Rapier WASM) | 2.2 | MIT / Apache-2.0 | Real rigid-body physics: debris, rubble, push impulses, kinematic cart. |
| @react-three/postprocessing | 3.2 | MIT | Bloom, ACES tone mapping, vignette and grain on High/Medium. The stack is memoized, because re-creating it recompiles a merged shader (~1 s stall, measured). |
| Zustand | 5.1 | MIT | One store for world, history, voice state and recording. |
| Zod | 4.6 | MIT | Strict, allow-listed operation schema. `z.toJSONSchema` feeds Groq structured output. |
| Mediabunny | 1.65 | MPL-2.0 | MP4 (H.264) and WebM muxing over WebCodecs. AAC audio muxing for the demo film. |
| Tailwind CSS | 4.3 | MIT | Utility styling over a small token layer (`src/styles.css`). |
| Vitest | 5.1 | MIT | 79 unit and integration tests. |
| Ponytail (Claude Code plugin) | 4.9.0 | see repo | Mandatory engineering discipline: YAGNI, stdlib-first, smallest working diff. Installed at user scope; it was active for the whole build (session hook "PONYTAIL MODE ACTIVE — full"). |
| Gnani Prisma v3.0 (STT) | API | Gnani terms | Speech to text, with `indic-auto` detection, `codemix` output and `keyterms` biasing (verified to fix "tod do" → "तो दो"). |
| Gnani Timbre v3.0 (TTS) | API | Gnani terms | Optional spoken confirmations. Also produced the synthetic voices in the demo film. |
| Groq `openai/gpt-oss-20b` | API | Groq terms | Fallback planner for complex commands, using JSON-schema output that Zod re-validates. |
| Google Fonts: Geist, Geist Mono, Instrument Serif | – | OFL | Typography. |

## Rejected or deferred

| Tool | Decision | Reason |
|---|---|---|
| N8AO (ambient occlusion) | Rejected after testing | Crashed `EffectComposer` with three r187 (`setupRenderTarget … reading 'length'`). Shadows and an environment map carry the depth instead. |
| SSAO via NormalPass | Deferred | Extra full-screen pass on every frame. Not worth it while the target is 60 fps on laptops. |
| Framer Motion / Motion | Rejected (Ponytail) | Every transition needed (panel width, drawer translate, fades, mic ring) is plain CSS with `prefers-reduced-motion` respected. Zero JS cost. |
| Kenney / Quaternius / Poly Pizza GLB assets | Deferred | Downloading third-party packs needs per-pack licence verification and a download approval. All geometry and textures are procedural and self-made at runtime, so there is no licence risk and nothing to download. |
| Blender MCP | Not used | Live scene edits must never depend on Blender. No offline asset needed it in this timeframe. |
| HyperFrames | Not used | The demo film is rendered by the engine itself (`src/dev/demoFilm.ts`), which is more truthful than a separate compositor. |
| canvas-record | Not used | Mediabunny already covers MP4/WebM muxing over WebCodecs. MediaRecorder is the fallback. |
| cinematic-3d-website / cinematic-3d-production skills | Reviewed as references only | Ideas taken for hero composition and lighting restraint. No code copied. The paid “Cinematic 3D” skill was not purchased or used. |
| Gnani realtime WebSocket STT | Deferred | It needs a custom `x-api-key-id` header that browsers can't set, so it would need a long-lived proxy, which Vercel Functions are poorly suited to. It also returns only final segments (no partials). The REST relay (≤30 s per utterance) is used instead. |
| Supabase / Cloudflare / hosted DB | Excluded by requirement | Scenes persist locally in IndexedDB with JSON import and export. |
| Llama 3.x on Groq | Rejected | Shut down 2026-08-16 per Groq's deprecations page. A live `GET /models` confirmed `openai/gpt-oss-20b` is available. |
