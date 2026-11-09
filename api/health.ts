import { env, json } from './_lib.js'

export default {
  fetch() {
    return json({
      gnani: !!env('GNANI_API_KEY'),
      groq: !!env('GROQ_API_KEY'),
      demoTokenRequired: !!env('DEMO_ACCESS_TOKEN'),
      sttModel: env('GNANI_STT_MODEL') ?? 'prisma-v3.0',
      ttsModel: env('GNANI_TTS_MODEL') ?? 'timbre-v3.0',
      groqModel: env('GROQ_MODEL') ?? 'openai/gpt-oss-20b',
    })
  },
}
