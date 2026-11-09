import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev-only: serve api/*.ts (Vercel `export default { fetch }` handlers) from the Vite dev server,
// so `npm run dev` behaves like the deployed app without needing `vercel dev`.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      Object.assign(process.env, loadEnv('development', process.cwd(), ''))
      // dev-only: lets the demo director save its rendered film into public/demo/
      server.middlewares.use('/__save', async (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? ''
        if (req.method !== 'POST' || !/^(boliverse-demo\.mp4|poster\.jpg|demo-run\.json)$/.test(name)) { res.statusCode = 400; return res.end('bad') }
        const chunks: Buffer[] = []
        for await (const c of req) chunks.push(c as Buffer)
        const { mkdirSync, writeFileSync } = await import('node:fs')
        mkdirSync('public/demo', { recursive: true })
        writeFileSync(`public/demo/${name}`, Buffer.concat(chunks))
        res.end('saved')
      })
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.match(/^\/api\/([a-z-]+)/)
        if (!m) return next()
        try {
          const mod = await server.ssrLoadModule(`/api/${m[1]}.ts`)
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const body = chunks.length ? Buffer.concat(chunks) : undefined
          const request = new Request(`http://localhost${req.url}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })
          const response: Response = await mod.default.fetch(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          if ((e as Error).message?.includes('Failed to load')) return next()
          res.statusCode = 500
          res.end(JSON.stringify({ error: String(e) }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), devApi()],
  build: { chunkSizeWarningLimit: 4000 },
  test: { include: ['tests/**/*.test.ts'] },
} as never)
