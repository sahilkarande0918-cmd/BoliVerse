# Implementation status (9 Nov 2026, `main` @ `490925b`, working tree clean before these memory docs)

## Done and verified
- Gnani Prisma v3.0 STT via `/api/stt` (local + production; Hindi, Marathi, code-mixed transcripts confirmed). Timbre TTS works (`bitrate:"64k"`).
- Groq fallback planner live; Zod validation + safe optional-field repair.
- Local multilingual parser; **84/84 Vitest tests pass** (incl. 8 real Prisma transcripts, mansion, props, safety cases).
- Village / river / bridge / edit / destroy (Rapier debris, wood floats, stone sinks) / rebuild / traversal graph; building rubble for any destroyed structure.
- Luxury mansion with interior slots, decor, pool; scanned CC0 furniture with procedural fallback (code done; live load not visually verified).
- Undo/redo, IndexedDB save/load, JSON import/export, screenshot, frame-exact MP4 export (verified playable 1280×720).
- Warm editorial UI (studio + landing) verified at 1440×900, 1366×768, 390×844; Lenis smooth scroll on landing; perf fixes (no scroll re-measure, hero pauses offscreen, adaptive quality).
- Realism (High verified by screenshots in `docs/realism/hi-*.jpg`): CC0 PBR terrain/buildings/roads/rocks, Poly Haven HDRI skies with photographed clouds, sun aligned to sky, planar mirror river (Medium+), procedural broadleaf/palm/conifer trees with wind, dense grass + flowers + shrubs, framed windows, wet ground in rain.
- Deployed: https://boliverse.vercel.app (production alias updated at `490925b`).

## Partially done / unverified
- **Ultra preset**: earlier captures were blank grey; SSAO, SoftShadows and MSAA 8 were removed and deployed — **not re-verified**.
- God rays (GodRays + SUN_MESH) and 3D clouds: compiled and deployed; not confirmed visible in a captured frame after final tuning.
- Water reflector last tuning (distortion 0.07, mirror 0.85, blur 50/18) not re-captured on High.
- Open-vocabulary props (`library.ts`/`Props.tsx`): parser-tested; live Poly Haven load in browser not visually verified.
- Demo film `public/demo/boliverse-demo.mp4` (61.6 s, editorial overlays) was rendered **before** the realism upgrade — the user asked to re-render it with the latest High graphics.
- Docs not yet written for the realism work: `docs/REALISM_AUDIT.md`, `docs/RENDERING_DECISIONS.md`, `docs/ASSET_LICENSES.md` (CC0 manifest exists at `public/assets/pbr/manifest.json`; root `ASSETS_LICENSES.md` still describes the pre-PBR state and must be updated).

## Known bugs / gaps
- "wapas banao" / "stone bridge wapas banao" is parsed as **UNDO** (lexicon `V:undo` contains `wapas`). Fix: add 2-gram `wapas banao`/`वापस बनाओ` → concepts `AGAIN` + `V:create`.
- p95 frame spikes (~90–120 ms) at High/Ultra, likely first-use shader compiles.
- Hero/landing uses Medium-like settings without post-processing (intentional for scroll smoothness).
- Human-voice mic session not yet tested by the user.
- Realistic animals/vehicles: no CC0 realistic models — intentionally refused with a message.

## Pending tests
- Re-run `captureSet('ultra','ultra')` and `captureSet('hi','high')`; inspect sunset river (sun reflection), god rays, clouds, rain.
- Acceptance voice/text commands from the realism brief: "Ek realistic Indian village banao, beech mein nadi aur wooden bridge ho", "Sunset karo", "Bridge tod do", "Stone bridge wapas banao" (currently broken, see above), "Cinematic camera se village dikhao".
- Props: "ek kursi banao", "add a barrel near the temple", "cow banao" (should refuse).
- `npm run build`, `npm test`, production smoke test after each deploy.
