# Next steps (prioritised)

Done on 9 Nov 2026:
- the "wapas banao" fix
- Ultra verified; Ultra is now the default everywhere
- the 60 s social film re-rendered at Ultra (`public/demo/boliverse-demo.mp4`)
- the realism docs
- the **official 2–3 min demo** (see below)

## Official demo (for the submission form)
- **File:** `deliverables/BoliVerse_Gnani_Official_Demo_1080p.mp4`. It is git-ignored; upload it to YouTube as **Unlisted**.
- **Docs:** script, shot list, SRT, thumbnail and `DEMO_VERIFICATION.md` are in `deliverables/`.
- **What it builds:** a new world rather than the village or mansion: a river, 20 trees, a temple with 5 lamps, a Marathi stone bridge at sunrise, a scanned Poly Haven bench, a red temple with undo/redo, rain, then Simulate (bridge broken, route blocked), a steel rebuild at sunset, and a Film-mode camera with a real in-app MP4 export.
- **Pipeline:** `video-production/gnani-official-demo/scripts/` (lines → voices → schedule → capture → make-media → build-film → render → master → write-docs). It is documented in `video-production/gnani-official-demo/README.md`.
  - Raw frames and media are git-ignored and local only.
  - The pipeline needs `npm run dev` running.
  - Capture uses a headed Edge window. Don't cover it; occlusion flags are set anyway.

## Still to do (user)
1. **Human checks:**
   - a human-voice mic test on https://boliverse.vercel.app/#/studio; the official demo uses synthetic Timbre voices and says so
   - check the Gnani Discord
   - team confirmed: Sahil Karande (build) and Purvesh Mhatre (researched and suggested useful repos and tools); mark it as a team entry on the form, not solo
2. **Submission:**
   - upload the official demo as Unlisted YouTube and post the 60 s film publicly with `#GnaniAI #GreatIndianAIInternshipChallenge`
   - submit the official form before **10 Nov 2026 11:59 PM IST**
   - rotate the API keys afterwards

## Optional polish
- **p95 frame spikes:** caused by first-use shader compiles; `gl.compile(scene, camera)` after spawns would help.
- **Music bed:** the official demo has none (no licensed or local source); add one in the HyperFrames project (`film/index.html`) if wanted.
- **Re-render the 60 s film:** run `const m=await import('/src/dev/demoFilm.ts'); m.makeDemoFilm(s=>console.log(s))` (Ultra by default, about 8 min, 14 Gnani calls).
