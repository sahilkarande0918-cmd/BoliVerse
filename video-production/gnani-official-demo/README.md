# Official 2–3 minute demo — production pipeline

This folder produces `deliverables/BoliVerse_Gnani_Official_Demo_1080p.mp4` from the **real app**. Raw captures and big media are git-ignored.

Everything below needs the dev server running: `npm run dev` on :5173, with `GNANI_API_KEY` in `.env.local`. Run the steps in order from this folder:

| Step | Command | What it does |
|---|---|---|
| 1 | edit `scripts/lines.mjs` | Every spoken line. The narrator is Gnani Timbre voice **Avinash**; the builder is Timbre voice **Shivani**. Both are synthetic and labelled as such. |
| 2 | `node scripts/voices.mjs` | Generates each line with Timbre. Each builder clip is then sent through the app's own `/api/stt` relay to **Gnani Prisma**; transcripts and latencies go to `raw/voice/manifest.json`. It makes about 32 Gnani calls. |
| 3 | `npx hyperframes transcribe raw/voice/nXX.mp3` (Parakeet), moved to `raw/words/` | Word timings for the narrator subtitles. |
| 4 | `node scripts/capture.mjs studio` | Drives the real studio in Edge at **Ultra** and saves frame-exact 30 fps screenshots of the whole UI (about 25 min). Then it screencasts the real in-app MP4 export and saves the exported file. |
| 5 | `node scripts/capture.mjs landing` | Real-time screencast of the landing page. |
| 6 | `node scripts/make-media.mjs` | Builds the frames into the clips in `film/assets/media/`. |
| 7 | `node scripts/build-film.mjs` | Writes the HyperFrames project (`film/index.html`, `film/compositions/*`) and the SRT, all from `scripts/schedule.mjs`, the one timing source. |
| 8 | `cd film && npx hyperframes check && npx hyperframes render --quality delivery --video-frame-format png -o renders/boliverse-official-demo.mp4` | Checks and renders the film. |
| 9 | `node scripts/master.mjs film/renders/boliverse-official-demo.mp4` | Loudness −16 LUFS / −1.5 dBTP, a probe, and the thumbnail. |
| 10 | `node scripts/write-docs.mjs` | Script, shot list and verification docs in `deliverables/`. |

## How the voice steps are shown honestly
- The UI goes through its normal states (Listening → Transcribing with Gnani Prisma → Heard).
- The waveform is fed by the builder clip's own samples.
- The transcript, language and latency shown are Prisma's real result for that exact clip, from a call made just before the capture. `deliverables/DEMO_VERIFICATION.md` lists everything that is staged or edited.
