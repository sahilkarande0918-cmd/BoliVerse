// Every spoken line in the official demo. Narrator = Gnani Timbre "Avinash" (synthetic, en-IN).
// Builder = Gnani Timbre "Shivani" (synthetic test voice), and every builder clip is sent through
// the app's real /api/stt relay to Gnani Prisma; the film shows Prisma's transcript, not this text.
export const NARRATOR = 'Avinash'
export const BUILDER = 'Shivani'

export const LINES = [
  { id: 'n01', who: 'n', text: 'What if building a 3D world were as easy as describing it? Meet BoliVerse.' },
  { id: 'n02', who: 'n', text: 'BoliVerse is a voice controlled 3D studio. Instead of modelling every object by hand, you describe a world in Hindi, Marathi, English or Hinglish, and keep editing it as you speak.' },
  { id: 'n03', who: 'n', text: 'Speak on the left. Your world appears in the centre. The Inspector on the right shows every object and the environment. Let\'s build something new, from an empty scene.' },
  { id: 'b01', who: 'b', lang: 'hi-IN', text: 'एक नदी बनाओ, और बीस पेड़ लगाओ।' },
  { id: 'n04', who: 'n', text: 'Gnani Prisma turns the speech into text. BoliVerse compiles it into structured commands, a river and twenty trees, and builds a real, editable scene.' },
  { id: 'b02', who: 'b', lang: 'hi-IN', text: 'नदी के पास एक मंदिर बनाओ, और मंदिर के पास पाँच lamp लगाओ।' },
  { id: 'n05', who: 'n', text: 'Places are understood relative to what already exists. The temple sits beside the river, and the lamps gather around it.' },
  { id: 'b03', who: 'b', lang: 'mr-IN', text: 'नदीवर दगडी पूल बांधा आणि सूर्योदय करा.' },
  { id: 'n06', who: 'n', text: 'That was Marathi. A stone bridge spans the river, and the sky turns to sunrise.' },
  { id: 'b04', who: 'b', lang: 'en-IN', text: 'Put a wooden bench near the temple.' },
  { id: 'n07', who: 'n', text: 'Anything outside the core vocabulary is searched in a free library of scanned 3D models.' },
  { id: 'b05', who: 'b', lang: 'hi-IN', text: 'मंदिर को लाल करो।' },
  { id: 'n08', who: 'n', text: 'Edits change the same object, and every step can be undone or redone.' },
  { id: 'b06', who: 'b', lang: 'hi-IN', text: 'बारिश शुरू करो।' },
  { id: 'n09', who: 'n', text: 'Weather and time of day change the light, the sky, and even the wet ground.' },
  { id: 'b07', who: 'b', lang: 'hi-IN', text: 'अब bridge तोड़ दो।' },
  { id: 'n10', who: 'n', text: 'In Simulate mode, Rapier physics breaks the bridge into real debris, and the route system marks the crossing as blocked.' },
  { id: 'b08', who: 'b', lang: 'hi-IN', text: 'Steel bridge वापस बनाओ, और sunset कर दो।' },
  { id: 'n11', who: 'n', text: 'One sentence rebuilds it in steel, in the same place, and the route opens again.' },
  { id: 'b09', who: 'b', lang: 'hi-IN', text: 'Cinematic camera से मंदिर दिखाओ, आठ second का video बनाओ।' },
  { id: 'n12', who: 'n', text: 'Film mode moves a camera through the same live world, and exports an MP4, right in the browser.' },
  { id: 'n13', who: 'n', text: 'Under the hood: Gnani Prisma for speech, a multilingual command compiler with Groq as a fallback, validated commands, Three.js, Rapier physics, and Gnani Timbre for spoken replies.' },
  { id: 'n14', who: 'n', text: 'BoliVerse. Your words, your world.' },
]
