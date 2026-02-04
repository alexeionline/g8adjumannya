import { defineStore } from 'pinia'
import { addPushups, fetchHistory, fetchRecords, fetchStatus } from '../api'
import { extractErrorMessage } from '../api/client'

const DEMO_MODE = import.meta.env.VITE_DEMO === '1'
const DEMO_USERS = [
  { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null },
  { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null },
  { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null },
  { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null },
]

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function buildDemoHistory() {
  const days = {}
  const today = new Date()
  for (let i = 0; i < 45; i += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const cycle = i % 6
    const count = cycle === 0 ? 0 : cycle === 1 ? 40 : cycle === 2 ? 70 : cycle === 3 ? 100 : 20
    days[formatDateKey(date)] = count
  }
  return days
}

function buildDemoStatusRows() {
  return [
    { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null, count: 110, approaches: [20, 30, 30, 30] },
    { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null, count: 90, approaches: [15, 25, 25, 25] },
    { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null, count: 100, approaches: [25, 25, 25, 25] },
    { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null, count: 30, approaches: [10, 10, 10] },
  ]
}

function buildDemoRecordsRows() {
  const todayKey = formatDateKey(new Date())
  return [
    { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null, max_add: 120, record_date: todayKey },
    { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null, max_add: 90, record_date: todayKey },
    { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null, max_add: 75, record_date: todayKey },
    { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null, max_add: 60, record_date: todayKey },
  ]
}

export const useDataStore = defineStore('data', {
  state: () => ({
    loading: false,
    error: '',
    statusRows: [],
    recordsRows: [],
    historyDays: {},
    demoReady: false,
    demoUserId: DEMO_USERS[0].user_id,
  }),
  actions: {
    ensureDemoData() {
      if (!DEMO_MODE || this.demoReady) {
        return;
      }
      this.statusRows = buildDemoStatusRows();
      this.recordsRows = buildDemoRecordsRows();
      this.historyDays = buildDemoHistory();
      this.demoReady = true;
    },
    async loadAll(auth, userId) {
      await Promise.all([this.loadStatus(auth), this.loadRecords(auth), this.loadHistory(auth, userId)])
    },
    async loadStatus(auth, date) {
      this.loading = true
      this.error = ''
      try {
        if (DEMO_MODE) {
          this.ensureDemoData()
          this.statusRows = this.statusRows.slice().sort((a, b) => b.count - a.count)
          return
        }
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
        if (DEMO_MODE) {
          this.ensureDemoData()
          this.recordsRows = this.recordsRows.slice().sort((a, b) => b.max_add - a.max_add)
          return
        }
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
        if (DEMO_MODE) {
          this.ensureDemoData()
          return
        }
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
        if (DEMO_MODE) {
          this.ensureDemoData()
          const todayKey = formatDateKey(new Date())
          const currentTotal = Number(this.historyDays[todayKey] || 0)
          const nextTotal = currentTotal + delta
          this.historyDays = { ...this.historyDays, [todayKey]: nextTotal }

          const statusRow = this.statusRows.find((row) => row.user_id === userId);
          if (statusRow) {
            statusRow.count = Number(statusRow.count || 0) + delta
            if (!Array.isArray(statusRow.approaches)) statusRow.approaches = []
            statusRow.approaches.push(delta)
          } else {
            const fallback = DEMO_USERS.find((row) => row.user_id === userId) || { user_id: userId }
            this.statusRows.push({ ...fallback, count: delta, approaches: [delta] })
          }
          this.statusRows = this.statusRows.slice().sort((a, b) => b.count - a.count)

          const recordRow = this.recordsRows.find((row) => row.user_id === userId);
          if (recordRow) {
            if (delta > Number(recordRow.max_add || 0)) {
              recordRow.max_add = delta
              recordRow.record_date = todayKey
            }
          } else {
            const fallback = DEMO_USERS.find((row) => row.user_id === userId) || { user_id: userId }
            this.recordsRows.push({ ...fallback, max_add: delta, record_date: todayKey })
          }
          this.recordsRows = this.recordsRows.slice().sort((a, b) => b.max_add - a.max_add)
          return
        }
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
