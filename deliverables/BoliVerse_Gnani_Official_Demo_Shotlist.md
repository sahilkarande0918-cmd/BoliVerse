# Shot list (actual sources)

All app footage is the real BoliVerse studio (local dev server, same code as https://boliverse.vercel.app at commit time), Ultra quality, 1920×1080, captured by `scripts/capture.mjs` in Microsoft Edge (Playwright).

| Film time | Shot | Source |
|---|---|---|
| 00:00.0–00:06.9 | Four 0.95 s cuts from later in the build (dawn stone bridge, red temple in rain, broken bridge, steel bridge at sunset), cropped to the 3D viewport; then the BoliVerse arch mark | `raw/studio` frames (frame-exact capture), app logo SVG from `src/ui/Icon.tsx` |
| 00:06.9–00:20.5 | Landing page, hero then one slow scroll | `raw/landing`: real-time CDP screencast of `/#/` |
| 00:20.5–02:15.1 | Studio: empty scene, panel tour, 8 voice commands, select/undo/redo, Simulate tab, Film tab | `raw/studio`: 3438 frame-exact 30 fps screenshots of the full UI |
| 02:15.1–02:18.7 | In-app MP4 export in progress | `raw/export`: real-time screencast, 22.5 s shown in 3.6 s (labelled) |
| 02:18.7–02:23.0 | “Video ready” state + the exported file playing picture-in-picture | screencast after ready + `raw/inapp-export.mp4` (1280×720, 8.0 s, silent, made by the app) |
| 02:23.0–02:36.8 | Pipeline diagram | HyperFrames graphic (labelled “Diagram, not app footage”) |
| 02:36.8–02:45.1 | End slate: URL, repo, credits | HyperFrames graphic |

## Builder commands

| Said at | Command (Prisma transcript) | Applied at | Operations the app produced |
|---|---|---|---|
| 00:31.8 | एक नदी बनाओ और बीस पेड़ लगाओ। | 00:35.4 | CREATE_OBJECT, BATCH_CREATE |
| 00:48.2 | नदी के पास एक मंदिर बनाओ और मंदिर के पास पाँच lamp लगाओ। | 00:53.0 | CREATE_OBJECT, BATCH_CREATE |
| 01:02.6 | नदीवर दगडी पूल बांधा आणि सूर्योदय करा. | 01:06.7 | CREATE_OBJECT, SET_TIME_OF_DAY |
| 01:14.9 | Put a wooden bench near the temple. | 01:18.4 | CREATE_OBJECT |
| 01:26.5 | मंदिर को लाल करो। | 01:28.7 | MODIFY_OBJECT |
| 01:35.4 | बारिश शुरू करो। | 01:37.4 | SET_WEATHER |
| 01:46.1 | अब bridge तोड़ दो। | 01:48.7 | DESTROY_STRUCTURE |
| 01:58.7 | steel bridge वापस बनाओ और sunset कर दो। | 02:02.4 | REPAIR_STRUCTURE, SET_TIME_OF_DAY |
| 02:10.5 | cinematic camera से मंदिर दिखाओ। आठ second का video बनाओ। | 02:15.1 (export screencast) | CREATE_CAMERA_PATH, START_RECORDING |

## Real UI clicks (Playwright mouse on the actual controls)

- 01:29.6 — click on the temple in the viewport (selects it; Inspector shows it)
- 01:31.3 — Undo button
- 01:32.7 — Redo button
- 01:44.9 — “simulate” tab
- 02:09.4 — “film” tab
