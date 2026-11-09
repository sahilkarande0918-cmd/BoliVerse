# BoliVerse — Claude handoff (as of 9 Nov 2026; see git log for the latest commit)

Read this, then `IMPLEMENTATION_STATUS.md` and `NEXT_STEPS.md`. Product/tech docs: `README.md`, `docs/TECH_STACK.md`, `docs/RESEARCH_DECISIONS.md`, `docs/RESULTS.md`, `docs/DEMO_SCRIPT.md`, `docs/HACKATHON_SUBMISSION.md`, `docs/ASSET_LICENSES.md, docs/REALISM_AUDIT.md, docs/RENDERING_DECISIONS.md`.

## 1. Product
**BoliVerse — "Speak a world into existence."** A stateful multilingual *spoken programming language for living 3D worlds*. The user speaks (EN/HI/MR/Hinglish/Minglish) → **Gnani Prisma** transcribes → a compiler turns the transcript into Zod-validated operations → persistent world state mutates (with undo) → React Three Fiber renders, **Rapier** simulates, a traversal graph shows consequences → cinematic camera shots export to real MP4.

Built for the **Gnani AI Great Indian AI Internship Challenge**: must use ≥1 Gnani API; post a public LinkedIn/X video tagging Gnani with `#GnaniAI #GreatIndianAIInternshipChallenge`; then submit the official form. **Deadline 10 Nov 2026, 11:59 PM IST.** Deploying is *not* submitting. The Discord announcements have **not** been checked (requires the user's login).

Signature demo (all working): village + river + wooden bridge → "bridge thoda bada karo, aur sunset kar do" → "ab bridge tod do" (Rapier debris, cart route blocked) → "त्याच जागी दगडी पूल बांधा" (stone rebuild, route reopens) → luxury mansion + furnishing → cinematic flythrough MP4.

## 2. User preferences & hard rules (from the master prompt + later messages)
- No Claude/Anthropic co-author or contributor attribution, ever. Commit as the user's configured Git identity.
- Vercel only; free tiers only; **no Supabase/Cloudflare/paid infra**; local-first saves (IndexedDB + JSON).
- **Ponytail mandatory** (installed plugin `ponytail@ponytail` v4.9.0, user scope; session hook "PONYTAIL MODE ACTIVE — full").
- Honesty: label synthetic voices; never claim photorealism/benchmarks that aren't measured; never replace the live editor with video/images.
- UI direction: warm editorial, inspired by **maia.dk** (user rejected both the first dark UI and the black/orange "cinematic" UI as generic/AI-looking). Palette tokens in `src/styles.css` (`--bg #e7e0d8`, `--panel #f2ede7`, `--ink #34302d`, `--muted #776d66`…), font **Jost** + Geist Mono, underline text tabs, charcoal block buttons, arch motif (landing hero arch frames the live 3D render).
- 3D direction: user wants Minecraft-shader-pack-like beauty (golden hour, mirror water, god rays, clouds, lush vegetation, wet rain) but with realistic geometry, and wants *anything* the user asks for to be realistic (→ CC0 scanned-model library; honest refusal when no realistic model exists, e.g. cows/cars).
- User provided Gnani + Groq keys in chat (now in `.env.local` + Vercel). **Recommend rotating after the hackathon.**

## 3. Architecture
```
mic (AudioWorklet, src/voice/audio.ts) → 16 kHz WAV → /api/stt → Gnani Prisma v3.0 (api.vachana.ai/stt/v3)
   → transcript → src/compiler/localParser.ts (EN/HI/MR lexicon, zero network)
        └─ low confidence → /api/interpret → Groq openai/gpt-oss-20b (json_schema) → validatePlan (Zod)
   → src/store.ts run(): ops applied in order (UNDO/REDO inline) via src/compiler/apply.ts (pure reducer)
   → effects (camera / film / save / force) → src/engine/Scene3D.tsx (R3F Canvas)
```
- **Schema** `src/compiler/schema.ts`: object types `house tree bridge river road rock temple well school lamp cart mansion sofa bed table chandelier plant rug prop`; actions CREATE_SCENE, CREATE_OBJECT, BATCH_CREATE, MODIFY_OBJECT, TRANSFORM_OBJECT (move/rotate/`to`), DUPLICATE, DELETE, DESTROY_STRUCTURE, REPAIR_STRUCTURE, APPLY_FORCE, SET_WEATHER/LIGHTING/TIME_OF_DAY, SET_CAMERA, CREATE_CAMERA_PATH (presets incl. bridge_flythrough, under_bridge, mansion_reveal, interior…), PLAY_CAMERA_PATH, START/STOP_RECORDING, UNDO/REDO, SAVE/LOAD, CLARIFY_INTENT. `prop` carries `asset` (search words). `validatePlan` drops only invalid *optional* fields, never invents.
- **Parser** (`lexicon.ts` + `localParser.ts`): clause splitting (aur/and/,/आणि), postposition/genitive role detection ("school ke paas"), verb inheritance, corrections ("50 nahi, paanch" → UNDO + corrected op), retarget ("woh wala nahi, school ke piche wala"), camera grammar, weather-verb safety ("पाऊस पाडा" never destroys), object-only + verb-only fragment merge ("A bridge, Tod do."), mansion-as-container locatives, open-vocabulary props (unknown noun + create verb → `prop`).
- **World** (`src/engine/world.ts`): terrain height fn, curved river `riverX(z)`, seeded rng, entities with stable ids (`house_3`), `recent` list for pronoun resolution. **Spatial** (`spatial.ts`): across-river bridge solver, near/behind/between, interior furniture slots, mansion site search (+ clears trees in 22 m). **Traversal** (`traversal.ts`): BFS bank/bridge graph → cart route.
- **Rendering**: `Scene3D.tsx` (WorldView memo, PerformanceMonitor adaptive quality — disabled while recording, CameraDirector, FilmRecorder, Effects), `Entities.tsx` (houses w/ framed windows, temple, school, well, lamps, bridges wood/stone/steel, debris/buoyancy, rocks, roads, cart, Pop spawn anim — staggered only for new batches), `Mansion.tsx` (glass pavilion, interior, decor, pool, Rubble for any destroyed building, furniture via scanned CC0 models w/ procedural fallback), `Trees.tsx` (procedural broadleaf / palm / conifer: bark tubes + alpha leaf cards, instanced, wind; Shrubs), `Terrain.tsx` (blended PBR terrain shader, wetness, river water: PBR on Low / drei MeshReflectorMaterial mirror on Medium+, grass clumps + flowers on render layer 1 so the reflection camera skips them), `Atmosphere.tsx` (Poly Haven HDRI env + photographed backdrop per time of day, sun aligned to photo sun, SUN_MESH for god rays, drei Clouds w/ self-made sprite on High/Ultra, rain, night Sky+Stars), `pbr.ts` (cached PBR materials, `uvBox` metre UVs), `library.ts` + `Props.tsx` (Poly Haven model search/loader; CORS `*`; 12 MB cap; NOT_AVAILABLE list for animals/vehicles).
- **Quality tiers** (`Quality = ultra|high|medium|low`): DPR max 2/1.75/1.5/1; shadows 4096/2048/1024/off; grass 28k/15k/8k/0; reflector 2048/1024/512/none; god rays samples 90/60/32/off; clouds High+; MSAA 4 on High+ (Ultra MSAA 8 + SoftShadows + SSAO were removed — they blanked the frame; Ultra re-verified after); colour grade High+.
- **Video** (`src/video/exporter.ts` + FilmRecorder): Mediabunny MP4 H.264 via WebCodecs, frame-exact (`frameloop='never'` + `advance(t)`), WebM/MediaRecorder fallbacks; `poseAt(..., controls)` must update OrbitControls target or `controls.update()` re-aims the camera.
- **Dev-only tools**: `src/dev/demoFilm.ts` (`await import('/src/dev/demoFilm.ts')` in the studio tab → `makeDemoFilm()`: Timbre voices → real Prisma → live engine render with editorial overlays + AAC audio → `public/demo/boliverse-demo.mp4`, `poster.jpg`, `demo-run.json`); `src/dev/realismShots.ts` (`captureSet(tag, quality)` → `docs/realism/<tag>-*.jpg` + perf json). Both save via Vite dev middleware `/__save` (dev server only). Requires `window.__r3f` (set in FilmRecorder in DEV) and a **visible** browser pane. Yield between `advance()` calls (Rapier re-entrancy error otherwise).
- **API** (`api/*.ts`, Vercel `export default { fetch }`, `.js` import specifiers): `_lib.ts` guard (size limits, same-origin check, per-instance rate limit, optional `DEMO_ACCESS_TOKEN`), `stt.ts` (Prisma v3.0, `indic-auto`, `format=codemix`, `keyterms` list incl. "tod do", mansion words), `tts.ts` (Timbre v3.0 voice Shivani MP3, `bitrate:"64k"` string), `interpret.ts` (Groq, reasoning_effort low, strict:false schema), `health.ts`.
- **UI**: `src/ui/` Landing (Lenis smooth scroll, arch hero), Studio (header tabs, docked panels/drawers, framed viewport, bottom bar, film Timeline), VoicePanel (outline mic, waveform, transcript, latency row), Inspector (transforms, material, physics, environment, Ultra option), FilmBar (Timeline).

## 4. Verified facts (keep)
- Gnani: `POST https://api.vachana.ai/stt/v3` header `X-API-Key-ID`; WAV/MP3 ≤30 s (not WebM); realtime WS needs header → not browser-usable; TTS `POST /api/v1/tts/inference`. Measured Prisma round trip median ~213 ms (n=7).
- Groq: Llama 3.x IDs retired 2026-08-16; `openai/gpt-oss-20b` live; ~700 ms per call.
- N8AO and postprocessing SSAO are incompatible with three r187 in this stack (blank/crashing frames).
- EffectComposer must be memoized (re-creation recompiles ~1 s).
- R3F Canvas: `resize={{ scroll:false }}` (scroll re-measure caused landing lag); root grid needs `grid-cols-[minmax(0,1fr)]`.
- Perf (1280×720, this machine): before realism 1.9 ms/370 draws/71k tris (Medium); High after fixes 8.7 ms median, 1.46M tris; Ultra 19.8 ms visible pane (63.7 ms when captured at DPR 2 in a hidden pane), 2.58M tris; Ultra renders correctly.

## 5. Environment variable NAMES (values never in git)
`GNANI_API_KEY`, `GNANI_API_BASE_URL`, `GNANI_STT_MODEL` (prisma-v3.0), `GNANI_TTS_MODEL` (timbre-v3.0), `GNANI_TTS_VOICE` (Shivani), `GROQ_API_KEY`, `GROQ_MODEL` (openai/gpt-oss-20b), optional `DEMO_ACCESS_TOKEN`. Vercel project `boliverse` (account `sahilkarande0918-9163`) has the production values; `.vercel/` and `.env.local` are git-ignored.

## 6. Other Project Context
- **Reel-Studio** — https://github.com/sahilkarande0918-cmd/Reel-Studio. Referenced in the BoliVerse master prompt only as the user's earlier video code "for inspiration". It was **not** opened or modified in this session; no further details are known.
- No other projects were worked on in this conversation. (Many MCP connectors exist in the environment, unrelated to BoliVerse.)
