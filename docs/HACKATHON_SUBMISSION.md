# Hackathon submission: Gnani AI Great Indian AI Internship Challenge

**Deadline:** 10 November 2026, 11:59 PM IST (per gnani.ai/internship). Coding and deployment are **not** a submission: the participant must post publicly and complete the official form.

## Project

| Field | Value |
|---|---|
| Name | BoliVerse: speak a world into existence |
| Live demo | https://boliverse.vercel.app (studio: `/#/studio`) |
| Repository | https://github.com/sahilkarande0918-cmd/BoliVerse |
| Demo video (MP4, 1080p, ~64 s, with audio) | `public/demo/boliverse-demo.mp4` (also played on the landing page) |
| Team | Solo: Sahil Karande *(confirm eligibility details on the form)* |
| Suggested award categories | Mixed Vibes (code-mixed voice), Jugaad Genius (creative use), Solo Ninja, Demo Day Drop |

## One-paragraph description

BoliVerse is a stateful, multilingual spoken programming language for living 3D worlds. Users speak in Hindi, Marathi, Hinglish or English, and Gnani Prisma v3.0 transcribes the speech with code-mix output and keyterm biasing. A compiler turns each transcript into schema-validated operations on a persistent world. A deterministic Indic-aware parser handles everyday commands instantly, and Groq handles the rest. References like “it”, “same jagah” or “mansion ke andar” resolve against real entities. Rapier physics and a traversal graph show consequences: break the bridge and the cart can't cross; rebuild it in stone and the route reopens. Users can build and furnish a luxury mansion by voice, and export a real MP4 of a cinematic camera move through the live scene. Gnani Timbre can speak confirmations back.

## Exact Gnani usage (proven working with the project key)

| API | Model | Where | Evidence |
|---|---|---|---|
| Speech-to-text REST `POST /stt/v3` | `prisma-v3.0`, `language_code=indic-auto`, `format=codemix`, `keyterms` | `api/stt.ts` | Demo run log `public/demo/demo-run.json`: 7 utterances (hi-IN, mr-IN, en-IN, code-mixed), 180–750 ms round trip |
| Text-to-speech REST `POST /api/v1/tts/inference` | `timbre-v3.0`, voice `Shivani`, MP3 | `api/tts.ts` | “Timbre replies” toggle in the studio. It also generated the demo voices. |

The demo film's voices are **synthetic Gnani Timbre clips** fed through the real Prisma pipeline, and the video says so on screen. Before posting, record your own human-voice clip in the live studio (see the checklist).

## Third-party models / services disclosure

* Groq `openai/gpt-oss-20b`: fallback planner, emits JSON operations only.
* No other AI models. All 3D content is procedural; see `ASSETS_LICENSES.md`.

## Submission checklist (for the participant)

- [ ] Check the **official Gnani Discord** for announcements or rule changes (not verifiable from our side).
- [ ] Open https://boliverse.vercel.app/#/studio, allow the mic, and speak at least one Hindi and one Marathi command with your own voice. Confirm the “Heard” panel shows the Gnani Prisma transcript and latency.
- [ ] Optionally screen-record that human-voice session (OBS / Xbox Game Bar) and splice 5–10 s into the post. Keep the API key and browser devtools out of frame.
- [ ] Post the video publicly on **LinkedIn and/or X**, tag Gnani AI (LinkedIn: `Gnani.ai`, X: `GnaniAi`), name the Gnani models used (Prisma v3.0, Timbre v3.0), and include **#GnaniAI #GreatIndianAIInternshipChallenge**.
- [ ] Paste the public post link(s) here: LinkedIn: `________` · X: `________`
- [ ] Fill in the official submission form: demo video, written explanation (problem, users, models/APIs, your contribution), Gnani APIs used, and one post link per platform.
- [ ] Keep Gnani credits for judging. Each voice command costs one Prisma call; Timbre replies are off by default.
- [ ] Submit before **10 Nov 2026, 11:59 PM IST**.

## Suggested post text

> Built **BoliVerse**: speak in Hindi, Marathi or Hinglish and watch a living 3D world respond. “Ab bridge tod do” fractures the bridge into real physics debris and blocks the village route; “त्याच जागी दगडी पूल बांधा” rebuilds it. Speech by **Gnani Prisma v3.0** (code-mix, keyterms), voice replies by **Gnani Timbre**, physics by Rapier, all in the browser.
> Try it: https://boliverse.vercel.app · Code: https://github.com/sahilkarande0918-cmd/BoliVerse
> @Gnani.ai #GnaniAI #GreatIndianAIInternshipChallenge
