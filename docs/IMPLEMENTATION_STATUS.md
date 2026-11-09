# Implementation status (9 Nov 2026, after the post-compaction session)

## Done and verified
- Gnani Prisma v3.0 STT via `/api/stt` (local + production; Hindi, Marathi, code-mixed transcripts confirmed). Timbre TTS works (`bitrate:"64k"`).
- Groq fallback planner live; Zod validation + safe optional-field repair.
- Local multilingual parser; **89/89 Vitest tests pass** (incl. 8 real Prisma transcripts, mansion, props, safety cases).
- Village / river / bridge / edit / destroy (Rapier debris, wood floats, stone sinks) / rebuild / traversal graph; building rubble for any destroyed structure.
- Luxury mansion with interior slots, decor, pool; scanned CC0 furniture with procedural fallback (code done; live load not visually verified).
- Undo/redo, IndexedDB save/load, JSON import/export, screenshot, frame-exact MP4 export (verified playable 1280×720).
- Warm editorial UI (studio + landing) verified at 1440×900, 1366×768, 390×844; Lenis smooth scroll on landing; perf fixes (no scroll re-measure, hero pauses offscreen, adaptive quality).
- Realism (High verified by screenshots in `docs/realism/hi-*.jpg`): CC0 PBR terrain/buildings/roads/rocks, Poly Haven HDRI skies with photographed clouds, sun aligned to sky, planar mirror river (Medium+), procedural broadleaf/palm/conifer trees with wind, dense grass + flowers + shrubs, framed windows, wet ground in rain.
- Deployed: https://boliverse.vercel.app (production alias updated at `490925b`).

## Partially done / unverified
- **Ultra preset**: re-verified 9 Nov 2026. Day, sunset, sunrise, rain and night captures render correctly (`docs/realism/ultra-*.jpg`).
- Sun glare on the river at sunset and the clouds are visible in the Ultra captures and the new film. The god-ray shafts are subtle.
- Water reflector: verified in the Ultra captures (bridge and tree reflections).
- Open-vocabulary props: verified live in the official demo ("Put a wooden bench near the temple" → scanned Painted Wooden Bench with textures). Fixed 9 Nov: texture URLs were not mapped (all scanned models loaded untextured) and the material word now joins the search.
- Demo film **re-rendered at Ultra quality** (62.2 s, 1080p, 47.1 MB, all 7 lines transcribed live by Prisma).
- Realism docs written: `docs/REALISM_AUDIT.md`, `docs/RENDERING_DECISIONS.md`, `docs/ASSET_LICENSES.md` (the root ASSETS_LICENSES.md was removed).

## Known bugs / gaps
- FIXED: "Temple ko laal karo" / "make the temple red" now recolours the existing object (colour/material word after the noun = edit).
- FIXED: "wapas banao" / "वापस बनाओ" / "परत बांधा" now means rebuild (REPAIR_STRUCTURE); "wapas karo" is still UNDO.
- p95 frame spikes (~90–120 ms) at High/Ultra, likely first-use shader compiles.
- Hero/landing uses Medium-like settings without post-processing (intentional for scroll smoothness).
- Human-voice mic session not yet tested by the user.
- Realistic animals/vehicles: no CC0 realistic models — intentionally refused with a message.

## Pending tests
- Re-run `captureSet('ultra','ultra')` and `captureSet('hi','high')`; inspect sunset river (sun reflection), god rays, clouds, rain.
- Acceptance voice/text commands from the realism brief: "Ek realistic Indian village banao, beech mein nadi aur wooden bridge ho", "Sunset karo", "Bridge tod do", "Stone bridge wapas banao" (parser-tested), "Cinematic camera se village dikhao".
- Props: "ek kursi banao", "add a barrel near the temple", "cow banao" (should refuse).
- `npm run build`, `npm test`, production smoke test after each deploy.
