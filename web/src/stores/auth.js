import { defineStore } from 'pinia'

const STORAGE_KEY = 'g8a-web-auth'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    apiBase: import.meta.env.VITE_API_BASE || '',
    token: import.meta.env.VITE_API_TOKEN || '',
    chatId: import.meta.env.VITE_API_CHAT_ID || '',
    defaultUserId: import.meta.env.VITE_API_USER_ID || '',
  }),
  getters: {
    isReady(state) {
      return Boolean(state.apiBase && state.token && state.chatId)
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
        this.chatId = data.chatId || this.chatId
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
          chatId: this.chatId,
          defaultUserId: this.defaultUserId,
        })
      )
    },
    clear() {
      this.apiBase = ''
      this.token = ''
      this.chatId = ''
      this.defaultUserId = ''
      localStorage.removeItem(STORAGE_KEY)
    },
  },
})
