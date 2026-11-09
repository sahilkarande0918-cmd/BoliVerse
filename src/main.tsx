import { StrictMode, Suspense, lazy, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { Landing } from './ui/Landing'

const Studio = lazy(() => import('./ui/Studio'))

function App() {
  const [route, setRoute] = useState(location.hash)
  useEffect(() => {
    const on = () => { setRoute(location.hash); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  if (route.startsWith('#/studio')) {
    return (
      <Suspense fallback={<div className="grid h-full place-items-center text-sm text-[var(--muted)]">Loading studio…</div>}>
        <Studio />
      </Suspense>
    )
  }
  return <Landing />
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
