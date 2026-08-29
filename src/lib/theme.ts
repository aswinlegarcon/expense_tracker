export type Theme = 'system' | 'light' | 'dark'

const KEY = 'et-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

export function getTheme(): Theme {
  const t = localStorage.getItem(KEY)
  return t === 'light' || t === 'dark' ? t : 'system'
}

export function applyTheme(theme: Theme = getTheme()) {
  const dark = theme === 'dark' || (theme === 'system' && media.matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  applyTheme(theme)
}

export function initTheme() {
  applyTheme()
  media.addEventListener('change', () => {
    if (getTheme() === 'system') applyTheme()
  })
}
