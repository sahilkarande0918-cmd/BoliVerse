# Results: measured, not estimated

Machine: Windows 11 desktop, Chromium (Claude desktop browser pane), date 9 Nov 2026. "Not measured" means exactly that.

## Automated tests: `npm test`

**81 / 81 passing** (Vitest, 2 files):
- `tests/parser.test.ts`: 63 text-command cases across English, Hindi (Devanagari), Marathi, Hinglish, Minglish and code-mixed text. Includes **8 real Gnani Prisma v3.0 transcripts** of Timbre-generated audio, labelled `prisma-*`. These are TTS-derived, not human speech. Also covers corrections, pronouns, the camera grammar, the weather-verb safety rule and prompt-injection text.
- `tests/world.test.ts`: the signature demo end to end (transcript → ops → world → traversal graph), determinism, spatial placement, mansion furnishing, Zod rejection and repair of malformed LLM output.

Type check and production build pass (`npm run typecheck`, `npm run build`).

## Gnani Prisma: live calls (demo run, `public/demo/demo-run.json`)

| Utterance (spoken by Timbre, synthetic) | Detected | Round trip via relay | Provider-reported | Parsed by |
|---|---|---|---|---|
| एक सुंदर भारतीय गाँव बनाओ, बीच में नदी हो… | hi-IN | 393 ms | 181 ms | local |
| Bridge thoda bada karo, aur sunset kar do | hi-IN | 216 ms | 113 ms | local |
| Ab bridge tod do | en-IN | 187 ms | 104 ms | local |
| त्याच जागी दगडी पूल बांधा (heard: “क्या त्यागी दगड़ी पुल बांधा?”) | hi-IN | 208 ms | 107 ms | local |
| Build a luxury mansion with a swimming pool | en-IN | 206 ms | 107 ms | local |
| Mansion ke andar sofa, kaleen aur jhoomar lagao | hi-IN | 241 ms | 145 ms | local |
| Dining table aur bed bhi lagao, aur raat kar do | hi-IN | 213 ms | 128 ms | local |

**Speech round trip: median 213 ms, max 393 ms (n = 7).** Measured from the local dev relay to `api.vachana.ai`. Production adds the Vercel function hop, which is not separately measured.

**Command interpretation on these 7 real transcripts: 7/7 produced the intended world change.** One transcript had a real misrecognition (“त्याच जागी” → “क्या त्यागी”). The edit still succeeded because the bridge solver re-uses the free original crossing.

Across all runs: 21 Prisma calls over 3 renders. Observed misrecognitions: “tod do” → “तो दो” (fixed with `keyterms`), “mansion” → “manson/मंशन”, “kaleen” → “calen/canteen” (mansion vocabulary added to keyterms; afterwards transcribed exactly).

## Planning and apply latency

- Local parser + transaction (text path): **1–5 ms** per command, measured in the studio “Plan” and “Apply” cells.
- Voice → world (end of speech → world state applied) ≈ STT round trip + ~2 ms: **~190–400 ms** in the runs above.
- Groq `openai/gpt-oss-20b` (fallback only): **703 ms** for one live call. Not enough calls for a median.
- Render cost, measured separately: the first frame after an edit is 20–270 ms. Building the whole 97-entity village is the high end; small edits are 20–100 ms. A first-time shader compile (new light or material type) can add about 1 s once.

## Rendering

- Studio at 1440×900, High quality (shadows 2048, bloom, ACES, 9k grass tufts): **100–144 fps** in the FPS readout on this machine. Mobile was not measured on a physical device.
- Post-realism frame timings (High 8.7 ms median, Ultra captures) and before/after images: `docs/REALISM_AUDIT.md`.
- Responsive layout verified by screenshot at 1440×900, 1366×768 and 390×844, with no horizontal overflow (`scrollWidth == innerWidth`).

## Video export

- In-app: a 10 s bridge flythrough at **1280×720 MP4 H.264 took ~6 s to render, 10.5 MB**. Verified playable: `<video>` metadata 1280×720, duration 10.0 s, and non-black frame content at 5 s.
- Demo film (re-rendered 9 Nov 2026 with the realism upgrade, High quality): **1920×1080, 62.1 s, H.264 + AAC, 55.9 MB** (x264 CRF 21 re-encode of the 114 MB in-browser encode), rendered by the engine itself (`src/dev/demoFilm.ts`). All 7 synthetic Timbre utterances were transcribed live by Prisma (STT round trip 288–853 ms) and planned by the local parser. Prisma misheard the Marathi rebuild line "त्याच जागी दगडी पूल बांधा" as "कैद से आगे दगड़ी पुल बांधा"; the stone bridge was still built. Full log: `public/demo/demo-run.json`.
- Browsers tested for export: Chromium only. Firefox and Safari export are not tested.

## Not done or not verified

- **A human-voice microphone session has not been recorded.** The mic → AudioWorklet → WAV → `/api/stt` path is implemented and the same Prisma endpoint is proven, but a person must speak to verify end-to-end accuracy (see HACKATHON_SUBMISSION.md).
- p95 latencies: sample too small.
- WebGL AO (N8AO) was dropped because it is incompatible with three r187.
