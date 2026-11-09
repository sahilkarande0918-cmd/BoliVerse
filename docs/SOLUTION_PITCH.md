# BoliVerse — Solution Pitch

**Speak a world into existence.** Live: [boliverse.vercel.app](https://boliverse.vercel.app) · Code: [github.com/sahilkarande0918-cmd/BoliVerse](https://github.com/sahilkarande0918-cmd/BoliVerse)

**Problem and users.** Building a 3D scene takes hours in Blender, Unity or Unreal, which shuts out students, teachers, storytellers, planners and small creators. Voice and creative tools expect clean English, while Indians naturally mix Hindi, Marathi and English. AI generators only give flat media that cannot be edited or simulated.

**Solution.** BoliVerse is a browser-based 3D studio where you build and keep editing a living world by speaking Hindi, Marathi, English or Hinglish. Each sentence becomes validated operations on persistent objects: *“Bridge thoda bada karo, aur sunset kar do.”*

**How we use Gnani AI.**
- **Prisma v3.0 (speech-to-text)** transcribes every voice command through our server-side relay (`indic-auto` language detection, `codemix` output, keyterm biasing). In testing, nine Timbre-generated Hindi, Marathi and English commands were all transcribed correctly in 340–547 ms. A recorded session with a human speaker is still pending.
- **Timbre v3.0 (text-to-speech)** speaks optional confirmations. It also voiced our demo videos, which are labelled as synthetic.

**Core features.**
- **Multilingual voice commands:** code-mixed speech, references (*isko, same jagah*), corrections, undo and redo.
- **Interactive 3D worlds:** rivers, temples, houses and bridges, plus free scanned 3D models found from your words, with realistic materials, skies and weather.
- **Bridge physics:** *“Ab bridge tod do”* shatters the bridge with Rapier physics and blocks the route; rebuilding it reopens the route.
- **Mansion creation:** a luxury mansion with a pool, furnished by voice.
- **Cinematic export:** camera presets and frame-exact MP4 export, in the browser.

**Architecture.** Mic → Gnani Prisma → multilingual parser (Groq fallback) → Zod-validated operations → persistent world → Three.js + Rapier physics → MP4 export. Hosted on Vercel, no GPU servers, 89 automated tests.

**Real-world value.** People create in the language they think in, and cause and effect is visible, which suits classrooms, civic planning and storytelling. Anyone with a browser can use it free.

**Team.** **Sahil Karande:** concept, architecture, Gnani integration, compiler, 3D engine, physics, UI, export and deployment. **Purvesh Mhatre:** researched and suggested useful open-source repos and tools.
