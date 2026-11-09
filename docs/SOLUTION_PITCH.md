# BoliVerse: solution pitch

**Speak a world into existence.** BoliVerse is a voice-controlled, real-time 3D world studio. Users describe a world in Hindi, Marathi, English or Hinglish, then keep editing, breaking, rebuilding and filming it by voice.

| | |
|---|---|
| Live app | https://boliverse.vercel.app (studio: https://boliverse.vercel.app/#/studio) |
| Repository | https://github.com/sahilkarande0918-cmd/BoliVerse |
| Official 2–3 min demo | `deliverables/BoliVerse_Gnani_Official_Demo_1080p.mp4` (2:45, 1080p, Ultra graphics). See also its [script](../deliverables/BoliVerse_Gnani_Official_Demo_Script.md) and [verification](../deliverables/DEMO_VERIFICATION.md) |
| 60 s social film | [`public/demo/boliverse-demo.mp4`](../public/demo/boliverse-demo.mp4) |
| Challenge | Gnani AI · Great Indian AI Internship Challenge |

---

## 1. The problem

- **3D creation is locked behind expert tools.** Building even a simple scene (a river, a bridge, a temple) in Blender, Unity or Unreal takes hours of modelling, navigating menus, placing objects and learning the software. That shuts out students, teachers, storytellers, planners and small creators.
- **India speaks many languages, and code-mixes them.** Real users say *“Bridge thoda bada karo, aur sunset kar do”*, mixing Hindi and English in one breath. Most creative and voice tools expect clean English, so Indian users get poor recognition or have to translate their own thoughts.
- **Generative tools give pictures, not worlds.** Text-to-image and text-to-video models produce flat media you can't edit. You can't select the bridge in a generated video, make it bigger, break it, or ask what happens to the people who used it.

## 2. The solution

BoliVerse treats speech as a **spoken programming language for living 3D worlds**:

```
Voice ──► Gnani Prisma (speech → text, code-mix aware)
      ──► command compiler (local EN/HI/MR grammar · Groq fallback)
      ──► schema-validated operations (Zod)
      ──► persistent world state (undo / redo, save / load)
      ──► Three.js render · Rapier physics · route graph
      ──► cinematic camera · MP4 export · Gnani Timbre spoken replies
```

- **It edits a world, not a picture.** Every spoken sentence becomes typed operations on persistent entities with stable IDs (`bridge_1`, `temple_1`). “Make it bigger”, “same jagah”, “mansion ke andar” and “isko laal karo” all resolve to real objects already in the scene.
- **Consequences are real.** Breaking a bridge runs Rapier physics (debris floats or sinks by material), and the route graph marks the crossing as blocked. Rebuilding it opens the route again.
- **It is safe by design.** The language model is only a planner: every operation must pass a strict schema, and model output is never run as code, a URL or a shader. API keys stay server-side.
- **It runs on a free tier.** It's Vercel-hosted, and all 3D and physics run in the user's browser. There are no GPU servers and no paid infrastructure.

## 3. How we use Gnani AI

| Gnani API | Model and settings | Where in the code | What it does in BoliVerse |
|---|---|---|---|
| **Speech-to-text**: `POST /stt/v3` | **Prisma v3.0**, `language_code=indic-auto`, `format=codemix`, `keyterms` biasing (*tod do, pul, mandir, mansion…*) | `api/stt.ts` (server relay); `src/voice/` (mic → 16 kHz WAV) | Every spoken command. It auto-detects Hindi, Marathi or English and keeps code-mixed text (*“steel bridge वापस बनाओ और sunset कर दो”*) intact so the compiler sees what was actually said. |
| **Text-to-speech**: `POST /api/v1/tts/inference` | **Timbre v3.0** (MP3) | `api/tts.ts` | Spoken confirmations: the studio's “Timbre replies” toggle. Timbre also produced the clearly labelled synthetic voices in both demo films: narrator **Avinash** and builder test voice **Shivani**. |

**Measured, not claimed.** In the official demo run, nine builder utterances in Hindi, Marathi and English went through the app's own `/api/stt` relay to Prisma. All nine were transcribed correctly, with a round trip of **340–547 ms** (provider time 82–164 ms). Exact transcripts and timings are in `deliverables/DEMO_VERIFICATION.md`.

The Gnani key lives only in server-side environment variables (Vercel + git-ignored `.env.local`). It never reaches the browser, the repository or the videos.

## 4. Major features

**Voice and language**
- Hindi, Marathi, English and Hinglish/Minglish, written in Devanagari or romanised, with automatic language detection.
- A local deterministic parser with no network round trip, so common commands apply in milliseconds. It handles:
  - clause splitting (*aur / and / आणि*)
  - places relative to other objects (*school ke paas, nadi ke paar, mandir ke peeche*)
  - pronouns and references (*isko, same jagah, woh wala nahi*)
  - corrections (*“50 nahi, paanch”*)
  - rebuilds (*wapas banao, परत बांधा*)
  - recolouring existing objects (*mandir ko laal karo*)
- Groq `openai/gpt-oss-20b` as a fallback planner for open-ended requests. It emits JSON only, and every operation is validated against the schema.

**A living 3D world**
- Rivers, roads, houses, temple, school, well, lamps, carts, rocks, wood, stone or steel bridges, and a luxury mansion with a pool and furnished interior.
- **Any other object you name** (*“put a wooden bench near the temple”*) is searched in Poly Haven's free (CC0) library of photoscanned 3D models. When no realistic model exists (cows, cars), BoliVerse says so instead of faking one.
- Rapier physics:
  - bridge fracture debris, with wood floating and stone sinking
  - building rubble
  - pushable rocks
- A route graph: break the bridge and the cart's route is blocked; rebuild it and the route reopens.
- Undo and redo, save to the browser (IndexedDB), JSON import and export, screenshots.

**Realistic rendering, Ultra by default**
- Photoscanned CC0 textures, HDRI skies with the sun aligned to the photo, and a mirror river with real reflections.
- God rays, 3D clouds, procedural trees and grass that move in the wind, and wet ground in rain.
- Sunrise, day, sunset and night; clear, rain, fog and storm.
- Four genuinely different quality tiers (Low, Medium, High, Ultra) with no silent downgrades.

**Film**
- Cinematic camera presets (*“cinematic camera se mandir dikhao, aath second ka video banao”*).
- Frame-exact **MP4 export in the browser** (WebCodecs + Mediabunny): the same live world, no server rendering.

**Studio UX**
- A warm, editorial interface: Voice Studio (mic, waveform, “Heard” transcript, language, latency breakdown), a framed 3D viewport, an Inspector (transform, material, physics, environment, quality), and Build / Simulate / Film modes.
- Responsive from phones (390 px) to desktops.

**Engineering quality**
- TypeScript throughout, with 89 automated tests: multilingual parser cases, 8 real Prisma transcripts, schema safety and physics scenarios.
- Key-safe relay: same-origin checks, payload limits and rate limiting.

## 5. Why it matters

- **Inclusive:** people create in the language they think in, including the code-mixed way India actually speaks.
- **Educational:** cause and effect is visible. Break a bridge and watch the route close, which is a natural fit for classrooms, civic planning and storytelling.
- **Practical:** it runs in a browser tab on free infrastructure, so anyone with a link and a microphone can use it.

## 6. Team and contributions

| Member | Contributions |
|---|---|
| **Sahil Karande** | Author of every commit in the repository (product concept, architecture, Gnani Prisma/Timbre integration and server relays, multilingual command compiler and tests, 3D world, physics and route graph, realism upgrade, studio and landing UI, MP4 export, deployment, demo films and documentation) |
| **Purvesh Mhatre** | *To be filled in by the team.* Named in the demo brief and on the official demo's end slate; the repository has no record of his contributions, so none are listed here |

> Before submitting, confirm the team list and eligibility details on the official form, and complete Purvesh's row (or remove it, together with the name on the demo film's end slate, if the entry is solo).

## 7. Honest limits

- **Human voice not yet tested.** The microphone → Prisma path for a human voice is implemented, but a recorded human session still has to be made. Both demo films use **synthetic** Gnani Timbre voices and say so on screen.
- **Not photorealism.** The rendering is real-time stylised realism; buildings are procedural shapes with real-world materials.
- **Limited model library.** Realistic animals and vehicles aren't available as free CC0 models, so those requests are refused rather than faked.
