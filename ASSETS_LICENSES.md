# Assets and licences

BoliVerse ships **no third-party 3D models, textures, HDRIs, music or footage.**

| Asset | Source | Licence |
|---|---|---|
| All 3D geometry (terrain, river, houses, temple, school, well, bridges, mansion, furniture, trees, grass, cart) | Procedural code in `src/engine/*` | Project's own |
| Detail textures (grass, plaster, tiles, wood, stone) | Generated at runtime on `<canvas>` (`src/engine/textures.ts`) | Project's own |
| Environment lighting | drei `<Environment>` with procedural `<Lightformer>` cards (no HDR file) | Project's own |
| Demo film voices | Generated with Gnani Timbre v3.0 through the project's API key | Gnani API terms |
| Demo film / poster (`public/demo/`) | Rendered by the BoliVerse engine itself | Project's own |
| Fonts: Geist, Geist Mono, Instrument Serif | Google Fonts | SIL Open Font License 1.1 |

Third-party code libraries and their licences are listed in `docs/TECH_STACK.md`.
