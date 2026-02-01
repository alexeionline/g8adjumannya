import { defineStore } from 'pinia'
import { addPushups, fetchHistory, fetchRecords, fetchStatus } from '../api'
import { extractErrorMessage } from '../api/client'

export const useDataStore = defineStore('data', {
  state: () => ({
    loading: false,
    error: '',
    statusRows: [],
    recordsRows: [],
    historyDays: {},
  }),
  actions: {
    async loadAll(auth, userId) {
      await Promise.all([this.loadStatus(auth), this.loadRecords(auth), this.loadHistory(auth, userId)])
    },
    async loadStatus(auth, date) {
      this.loading = true
      this.error = ''
      try {
        const data = await fetchStatus(auth, date)
        this.statusRows = data.rows || []
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async loadRecords(auth) {
      this.loading = true
      this.error = ''
      try {
        const data = await fetchRecords(auth)
        this.recordsRows = data.rows || []
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async loadHistory(auth, userId) {
      if (!userId) {
        this.historyDays = {}
        return
      }
      this.loading = true
      this.error = ''
      try {
        const data = await fetchHistory(auth, userId)
        this.historyDays = data.days || {}
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async addCount(auth, userId, delta) {
      if (!userId || !Number.isFinite(delta)) {
        this.error = 'Введите количество повторений'
        return
      }
      this.loading = true
      this.error = ''
      try {
        await addPushups(auth, userId, delta)
        await Promise.all([
          this.loadStatus(auth),
          this.loadRecords(auth),
          this.loadHistory(auth, userId),
        ])
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
  },
})
