# Research and decisions (verified 9 Nov 2026)

## Gnani: verified against docs.gnani.ai and live calls with the project key

| Item | Verified fact | How we use it |
|---|---|---|
| STT REST | `POST https://api.vachana.ai/stt/v3`, multipart `audio_file`, header `X-API-Key-ID`, ≤30 s audio, WAV/MP3/OGG/FLAC/AAC/M4A (not WebM) | `api/stt.ts` relays 16 kHz mono WAV encoded in the browser (`src/voice/audio.ts`) |
| Model / language | `model=prisma-v3.0`, `language_code=indic-auto` (or `hi-IN`, `mr-IN`, `en-IN`, comma-joined hints), `format=codemix` | Auto by default. The user can force Hindi / Marathi / Hinglish / English. |
| Keyterms | `keyterms` comma-separated string | Live test: "Ab bridge tod do" went from "अब bridge **तो दो**" to "अब bridge **tod do**" |
| Realtime WS | `wss://api.vachana.ai/stt/v3/stream`. Auth is via header only; browsers can't set it. Final segments only, no partials. | Not used (see TECH_STACK.md). |
| TTS | `POST /api/v1/tts/inference`, `model: timbre-v3.0`, `voice: Shivani`, `audio_config.container: mp3`. **`bitrate` must be a string such as `"64k"`.** The docs example's numeric bitrate and WAV/48 kHz/Devanagari combination returned 500 "No audio generated" in our tests. | `api/tts.ts`, used for optional spoken replies and the demo voices |
| Limits | "Only 1 active request at a time" (429). 402 means insufficient credit. | The UI shows clear messages for `RATE_LIMIT`, `NO_CREDIT` and `NO_KEY`. The demo director spaces its calls 400 ms apart. |
| Challenge | Brief is open. At least one Gnani API must be used. Deadline 10 Nov 2026, 11:59 PM IST. Public LinkedIn/X video tagging Gnani with `#GnaniAI #GreatIndianAIInternshipChallenge`. | See HACKATHON_SUBMISSION.md |
| Discord announcements | **Not verified.** It needs the participant's own Discord login. | Checklist item for the submitter |

## Groq

- A live `GET /openai/v1/models` with the project key listed `openai/gpt-oss-20b`, `openai/gpt-oss-120b`, `qwen/qwen3.8-27b` and others.
- The deprecations page shows `llama-3.1-8b-instant` and `llama-3.3-70b-versatile` shut down on 2026-08-16, so they are not used.
- We use `openai/gpt-oss-20b` with `response_format: json_schema` (best-effort mode, `reasoning_effort: low`). The output is always re-validated with Zod, and invalid optional fields are dropped, never invented.
- First live call: 703 ms.

## Vercel

- `api/*.ts` with `export default { fetch(request) }` is supported (official docs). ESM `.js` import specifiers resolve at runtime (verified on the deployed `/api/health`).
- Keys are stored as Production environment variables via `vercel env add` and never prefixed with `VITE_`.

## Assumptions

- Judges test on desktop Chrome or Edge. WebCodecs is needed for frame-exact MP4. Other browsers fall back to MediaRecorder WebM, labelled as such.
- Starred-repository inspection was skipped. It isn't needed for the product, and we didn't infer anything from it.
