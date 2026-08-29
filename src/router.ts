import { useEffect, useState } from 'react'

export type Route = 'dashboard' | 'transactions' | 'budgets' | 'settings'

const ROUTES: readonly Route[] = ['transactions', 'budgets', 'settings']

function parse(hash: string): Route {
  return ROUTES.find((r) => hash.startsWith(`#/${r}`)) ?? 'dashboard'
}

/** Tiny hash router: works on GitHub Pages with no server rewrites and
 *  keeps back/forward (and the Android back button in an installed PWA) working. */
export function useHashRoute(): [Route, (r: Route) => void] {
  const [route, setRoute] = useState<Route>(() => parse(location.hash))

  useEffect(() => {
    const onChange = () => setRoute(parse(location.hash))
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])

  const navigate = (r: Route) => {
    location.hash = r === 'dashboard' ? '/' : `/${r}`
  }

  return [route, navigate]
}
