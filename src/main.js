import App from './App.svelte'
import './app.css'
import 'flowbite/dist/flowbite.min.js'

if (typeof window !== 'undefined') {
  const mode = localStorage.getItem('prescribe-theme-mode') || 'light'
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  const shouldUseDark = mode === 'dark' || (mode === 'system' && prefersDark)
  document.documentElement.classList.toggle('dark', shouldUseDark)
}

const app = new App({
  target: document.getElementById('app'),
})

export default app
