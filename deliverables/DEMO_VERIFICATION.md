# Demo verification

Final file: `deliverables/BoliVerse_Gnani_Official_Demo_1080p.mp4` — 1920×1080, 30/1 fps, h264 + aac, 165.20 s, 267.3 MB, integrated loudness -16.01 LUFS, true peak -1.49 dBTP (measured with ffmpeg `loudnorm`; the mix was measured, not listened to by a person).

Captured 2026-11-09T16:11:44.699Z at quality **ultra**.

## What is real

| Film time | Feature shown | Evidence |
|---|---|---|
| 00:06.9 | Landing page | real-time screencast of the running site code |
| 00:20.5 | Studio layout: Voice Studio, viewport, Inspector, Build/Simulate/Film | frame-exact capture of the real UI |
| 00:31.8 | “एक नदी बनाओ और बीस पेड़ लगाओ।” (Hindi) → CREATE_OBJECT, BATCH_CREATE | Timbre test clip `raw/voice/b01.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:43:02.877Z, 456 ms round trip (provider 142 ms). The app then ran that transcript through its real parser and world. |
| 00:48.2 | “नदी के पास एक मंदिर बनाओ और मंदिर के पास पाँच lamp लगाओ।” (Hindi) → CREATE_OBJECT, BATCH_CREATE | Timbre test clip `raw/voice/b02.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:41:50.106Z, 485 ms round trip (provider 164 ms). The app then ran that transcript through its real parser and world. |
| 01:02.6 | “नदीवर दगडी पूल बांधा आणि सूर्योदय करा.” (Marathi) → CREATE_OBJECT, SET_TIME_OF_DAY | Timbre test clip `raw/voice/b03.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:41:58.018Z, 430 ms round trip (provider 121 ms). The app then ran that transcript through its real parser and world. |
| 01:14.9 | “Put a wooden bench near the temple.” (English) → CREATE_OBJECT | Timbre test clip `raw/voice/b04.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:05.349Z, 356 ms round trip (provider 99 ms). The app then ran that transcript through its real parser and world. |
| 01:26.5 | “मंदिर को लाल करो।” (Hindi) → MODIFY_OBJECT | Timbre test clip `raw/voice/b05.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:12.293Z, 386 ms round trip (provider 85 ms). The app then ran that transcript through its real parser and world. |
| 01:35.4 | “बारिश शुरू करो।” (Hindi) → SET_WEATHER | Timbre test clip `raw/voice/b06.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:19.033Z, 340 ms round trip (provider 82 ms). The app then ran that transcript through its real parser and world. |
| 01:46.1 | “अब bridge तोड़ दो।” (Hindi) → DESTROY_STRUCTURE | Timbre test clip `raw/voice/b07.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:25.917Z, 359 ms round trip (provider 83 ms). The app then ran that transcript through its real parser and world. |
| 01:58.7 | “steel bridge वापस बनाओ और sunset कर दो।” (Hindi) → REPAIR_STRUCTURE, SET_TIME_OF_DAY | Timbre test clip `raw/voice/b08.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:33.381Z, 395 ms round trip (provider 114 ms). The app then ran that transcript through its real parser and world. |
| 02:10.5 | “cinematic camera से मंदिर दिखाओ। आठ second का video बनाओ।” (Hindi) → CREATE_CAMERA_PATH, START_RECORDING | Timbre test clip `raw/voice/b09.wav` → BoliVerse `/api/stt` → Gnani Prisma prisma-v3.0 at 2026-11-09T15:42:40.744Z, 547 ms round trip (provider 136 ms). The app then ran that transcript through its real parser and world. |
| 01:29.6, 01:31.3, 01:32.7, 01:44.9, 02:09.4 | Select (Inspector), Undo, Redo, Simulate tab, Film tab | real Playwright mouse clicks on the live controls |
| 02:15.1 | In-app MP4 export | real export; file saved as `raw/inapp-export.mp4` and shown picture-in-picture |

## What is staged, edited or illustrative (disclosed)

- **Voices are synthetic.** Narrator and builder are both Gnani Timbre v3.0 (Avinash and Shivani). No human microphone session appears in this film; the mic → Prisma path for a human voice is implemented but must be verified by the team in person.
- **Transcription happened just before capture**, not during it: each builder clip was sent to Prisma (real call, timings logged in `raw/voice/manifest.json`), and during the frame-exact capture the studio was driven through its normal voice states (Listening → Transcribing → Heard) with that clip's own samples feeding the waveform. The wait between “Transcribing” and the result is time-cut to 0.6 s; the real measured latency is what the UI shows.
- **Frame-exact capture.** The studio was rendered at exactly 30 fps of simulated time (frameloop paused, advanced per frame), so the 3D runs smoothly even though Ultra renders slower than real time on this laptop. The FPS readout was hidden because in this mode it would show the video rate, not a measurement.
- **Camera moves between commands** were made by the capture script through the same OrbitControls a user drags; positions come from the live entities.
- **Export sped up:** the in-app export took 22.5 s in real time and is shown in 3.6 s (labelled on screen).
- **Diagram and title/end cards** are HyperFrames graphics, labelled “Diagram, not app footage”.
- **Captions** are the script text, timed to the narrator audio with Parakeet word timestamps; builder captions show Prisma's transcript plus an English meaning.
- **No music bed** (no licensed or locally generated music source was available); a few Pixabay-licensed UI sounds from the HyperFrames library mark cuts, clicks and the bridge break.

## Bugs fixed while filming (in the app, tested)

- “Temple ko laal karo” / “make the temple red” created a new red temple instead of recolouring the existing one (parser) — fixed, tests added.
- Scanned Poly Haven models loaded without textures (texture URLs not mapped) — fixed in `src/engine/library.ts`.
- “Wooden bench” matched a metal bench vice; the material word is now part of the model search.
