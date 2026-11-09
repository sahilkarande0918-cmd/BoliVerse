# BoliVerse — instructions for Claude Code

**Start every session by reading:** `docs/CLAUDE_HANDOFF.md` → `docs/IMPLEMENTATION_STATUS.md` → `docs/NEXT_STEPS.md`.

BoliVerse is a multilingual (English / Hindi / Marathi / Hinglish) voice-controlled, real-time 3D world editor for the Gnani AI Great Indian AI Internship Challenge (deadline 10 Nov 2026, 11:59 PM IST). Live: https://boliverse.vercel.app · Repo: https://github.com/sahilkarande0918-cmd/BoliVerse (branch `main`).

## Non-negotiable rules
- **Git:** commit as the configured user (`sahilkarande0918-cmd <sahilkarande0918@gmail.com>`). **Never** add Claude/Anthropic/AI co-author trailers, contributors or credits. Never force-push.
- **Secrets:** keys live only in git-ignored `.env.local` and Vercel production env vars. Never print, commit, log, or prefix them with `VITE_`.
- **Infra:** Vercel only. No Supabase, Cloudflare, hosted DB, paid APIs or GPU backends. 3D + physics run in the browser.
- **Honesty:** never fake live behaviour (no pre-recorded footage passed off as live, no invented benchmarks, no "photorealistic" claims the screenshots don't support). Label synthetic voices (Gnani Timbre) as synthetic.
- **Ponytail** (Claude Code plugin, user scope, v4.9.0) is mandatory: smallest working diff, stdlib/native first, no speculative abstractions, `ponytail:` comments on deliberate shortcuts.
- **LLM safety:** Groq is a planner only. All ops must pass the Zod schema in `src/compiler/schema.ts`. Never execute model output as code/URLs/shaders.
- **Design:** warm editorial "maia.dk" look (beige/ivory/taupe/charcoal, Jost, thin dividers, underline tabs, charcoal block buttons, arch motif). **Do not** revert to the old dark/orange UI.
- **Quality:** everything builds at **Ultra** by default (store default, demo film, captures). No automatic downgrade; only the Inspector can lower it manually.
- **3D realism direction:** CC0 PBR (Poly Haven), HDRI skies, mirror water, god rays, procedural trees/grass, CC0 scanned-model library. The live world must stay real, editable, physics-driven 3D.

## Commands
```bash
npm run dev        # Vite on :5173; also serves api/*.ts locally (reads .env.local)
npm test           # Vitest (89 tests)
npm run typecheck  # tsc --noEmit
npm run build      # tsc + vite build
vercel deploy --prod --yes
```
Browser verification needs the Claude Browser pane **visible** (a hidden pane gives the canvas zero size → nothing renders).

## Where things are
`src/compiler/` (schema, lexicon, localParser, apply) · `src/engine/` (world, spatial, traversal, Scene3D, Entities, Mansion, Trees, Terrain, Atmosphere, pbr, library, Props, shots) · `src/voice/` · `src/video/` · `src/ui/` · `src/dev/` (dev-only demo film + realism capture harness) · `api/` (stt, tts, interpret, health) · `public/assets/pbr/` (CC0 textures + HDRIs, manifest.json) · `docs/`.
