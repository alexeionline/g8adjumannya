import { defineStore } from 'pinia'

const STORAGE_KEY = 'g8a-web-auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    apiBase: import.meta.env.VITE_API_BASE || '',
    token: import.meta.env.VITE_API_TOKEN || '',
    defaultUserId: import.meta.env.VITE_API_USER_ID || '',
  }),
  getters: {
    isReady(state) {
      return Boolean(state.apiBase && state.token)
    },
  },
  actions: {
    load() {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      try {
        const data = JSON.parse(raw)
        this.apiBase = data.apiBase || this.apiBase
        this.token = data.token || this.token
        this.defaultUserId = data.defaultUserId || this.defaultUserId
      } catch {
        // ignore
      }
    },
    save() {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          apiBase: this.apiBase,
          token: this.token,
          defaultUserId: this.defaultUserId,
        })
      )
    },
    clear() {
      this.apiBase = ''
      this.token = ''
      this.defaultUserId = ''
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
