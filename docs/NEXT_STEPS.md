# Next steps (prioritised)

Done on 9 Nov 2026 (the session after compaction):
- the "wapas banao" fix
- Ultra re-verified
- the demo film re-rendered with High graphics
- the realism docs written (REALISM_AUDIT, RENDERING_DECISIONS, ASSET_LICENSES)

The last user request ("continue … edit that video on dashboard to latest high graphics and make it again") is **complete**.

1. **Human checks (user):**
   - a human-voice mic test on https://boliverse.vercel.app/#/studio
   - check the Gnani Discord
   - a public LinkedIn/X post with the new `public/demo/boliverse-demo.mp4`, tagging Gnani with `#GnaniAI #GreatIndianAIInternshipChallenge`
   - the official form before **10 Nov 2026 11:59 PM IST**
   - rotate the API keys afterwards
2. Optional polish:
   - p95 frame spikes (first-use shader compiles) could be cut by calling `gl.compile(scene, camera)` after the village spawns.
   - Live Poly Haven prop loading ("ek kursi banao", "add a barrel near the temple") is still not visually verified in the browser.
3. The current film is the Ultra render. To re-render it again: in the studio tab (dev server), run `const m=await import('/src/dev/demoFilm.ts'); m.makeDemoFilm(s=>console.log(s), 'ultra')`. It takes about 8 minutes at Ultra and makes 14 Gnani calls. The encoder is now capped at 6 Mbps so the file stays under GitHub's 100 MB limit.
