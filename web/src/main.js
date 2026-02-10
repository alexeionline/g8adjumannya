import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'

function initTelegramWebApp() {
  if (typeof window === 'undefined') return
  const webApp = window.Telegram?.WebApp
  if (!webApp) return

  try {
    if (typeof webApp.ready === 'function') webApp.ready()
    if (typeof webApp.expand === 'function') webApp.expand()
    if (typeof webApp.requestFullscreen === 'function') {
      Promise.resolve(webApp.requestFullscreen()).catch(() => {})
    }
  } catch {
    // noop
  }
}

initTelegramWebApp()

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
