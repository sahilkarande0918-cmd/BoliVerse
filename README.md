# BoliVerse: speak a world into existence

**Live:** https://boliverse.vercel.app · **Studio:** https://boliverse.vercel.app/#/studio · **Demo film:** [`public/demo/boliverse-demo.mp4`](public/demo/boliverse-demo.mp4)

BoliVerse is a multilingual voice-to-3D-world compiler. You speak in Hindi, Marathi, Hinglish or English, and **Gnani Prisma** transcribes it. A compiler turns the transcript into typed, validated operations on a persistent 3D world, and **Rapier** physics plus a causal traversal graph play out the consequences. You can then ask for a cinematic shot and download a real MP4 of the same live scene.

> “Ek beautiful Indian village banao, beech mein nadi ho, aur wooden bridge ho.” → “Bridge thoda bada karo, aur sunset kar do.” → “Ab bridge tod do.” → “त्याच जागी दगडी पूल बांधा.” → “Build a luxury mansion with a swimming pool.” → “Mansion ke andar sofa, kaleen aur jhoomar lagao.” → “Camera ko neeche se le jao, bridge ke upar fly karo, 10 second ka cinematic video banao.”

## What actually works (verified 9 Nov 2026)

| Capability | Status |
|---|---|
| Gnani Prisma v3.0 speech-to-text through a server relay (key never in browser) | ✅ Live. Hindi, Marathi and code-mixed transcripts, provider latency ~180–400 ms per utterance in our tests. |
| Gnani Timbre v3.0 spoken confirmations (toggle “Timbre replies”) | ✅ Live (MP3, `bitrate: "64k"`) |
| Local multilingual parser (no network) | ✅ 87 automated tests incl. real Prisma transcripts |
| Groq `openai/gpt-oss-20b` fallback planner (JSON schema → Zod) | ✅ Live. Only used when the local parser is unsure. |
| Persistent entity IDs, “it/isko/that/same jagah” resolution, corrections (“50 nahi, paanch”), undo/redo | ✅ |
| Spatial solvers: across river, near/behind/between, interior furniture slots, site clearing | ✅ |
| Rapier physics: bridge fracture debris (wood floats downstream, stone sinks), building rubble, pushable rocks | ✅ |
| Causal traversal graph: cart crosses → bridge destroyed → route blocked → rebuilt → route open | ✅ |
| Luxury mansion with pool and furnished interior (sofa, rug, chandelier, dining set, bed, plants) | ✅ |
| Cinematic camera presets plus frame-exact MP4 (H.264) export via WebCodecs + Mediabunny | ✅ Chromium. WebM fallback is labelled. Exports are silent. |
| Scene save/load (IndexedDB), JSON import/export, screenshot | ✅ |
| **Human microphone speech** | ⚠️ The mic → WAV → Prisma path is implemented, and Prisma itself is tested. A live human-voice session still needs to be run by the author (see `docs/RESULTS.md`). |

## Architecture

```
mic (AudioWorklet) ─► 16 kHz WAV ─► /api/stt (Vercel) ─► Gnani Prisma v3.0
                                                             │ transcript + language
                                    ┌────────────────────────┘
                                    ▼
             local multilingual parser ──(low confidence)──► /api/interpret ─► Groq gpt-oss-20b
                                    │                                             │ JSON
                                    └──────────► Zod allow-listed operations ◄────┘
                                                        │
                       resolve refs + spatial solvers + transaction (undo journal)
                                                        │
                world state (Zustand) ─► R3F scene ─► Rapier physics ─► traversal graph
                                                        │
                                   camera shots ─► frame-exact MP4 export (Mediabunny)
```

* `src/compiler/`: `schema.ts` (allow-listed ops), `lexicon.ts` + `localParser.ts` (EN/HI/MR), `apply.ts` (pure transactional reducer)
* `src/engine/`: `world.ts` (terrain/river maths), `spatial.ts` (placement solvers), `traversal.ts` (causal graph), `Entities.tsx` / `Mansion.tsx` (procedural models + physics), `Atmosphere.tsx`, `shots.ts`, `Scene3D.tsx`
* `src/voice/`: mic capture + WAV encoder, API client, mic controller
* `api/`: `stt.ts` (Prisma), `tts.ts` (Timbre), `interpret.ts` (Groq), `health.ts`. Shared guards in `_lib.ts`: size limits, same-origin check, per-instance rate limit, optional `DEMO_ACCESS_TOKEN`.

**Security:** the LLM is only a planner. Its output must parse against a strict Zod discriminated union with numeric bounds. No code, URLs or shaders are ever executed. Transcripts are treated as data, and prompt-injection text produces no operations (tested).

## Run locally

Requires Node ≥ 20 (tested on 24.13).

```bash
npm install
```

```bash
cp .env.example .env.local   # add GNANI_API_KEY and GROQ_API_KEY
```

```bash
npm run dev                  # http://localhost:5173 (API routes are served by the Vite dev server)
```

```bash
npm test && npm run typecheck && npm run build
```

## Deploy (Vercel, free tier)

```bash
vercel link
```

```bash
vercel env add GNANI_API_KEY production
```

```bash
vercel env add GROQ_API_KEY production
```

```bash
vercel deploy --prod
```

Notes on limits: each Prisma call is ≤30 s of audio and only one runs at a time per key. The function rate limit is per instance (documented ponytail trade-off). Add Vercel WAF rate limiting if traffic grows.

## Render quality

The Inspector has a **Low / Medium / High / Ultra** setting. Low: PBR materials, no reflections or grass. Medium: mirror river, grass. High: god rays, 3D clouds, colour grade, MSAA, 2048 shadows. Ultra: 2× pixel ratio, 4096 shadows, denser grass, sharper reflections. Captures and frame timings are in [docs/REALISM_AUDIT.md](docs/REALISM_AUDIT.md).

## Browser support

The studio works in any WebGL2 browser. MP4 export needs WebCodecs with H.264 (Chrome/Edge desktop); otherwise it falls back to labelled WebM. The microphone needs HTTPS and permission. Scenes stay in your browser (IndexedDB); voice audio is sent only to Gnani for transcription and is not stored by BoliVerse.

## Docs

[Tech stack](docs/TECH_STACK.md) · [Research and decisions](docs/RESEARCH_DECISIONS.md) · [Results and tests](docs/RESULTS.md) · [Demo script](docs/DEMO_SCRIPT.md) · [Hackathon submission](docs/HACKATHON_SUBMISSION.md) · [Assets and licences](docs/ASSET_LICENSES.md) · [Realism audit](docs/REALISM_AUDIT.md) · [Rendering decisions](docs/RENDERING_DECISIONS.md)

Built for the Gnani AI **Great Indian AI Internship Challenge**. #GnaniAI #GreatIndianAIInternshipChallenge
