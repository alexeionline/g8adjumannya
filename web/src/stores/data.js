import { defineStore } from 'pinia'
import { addPushups, deleteApproach as apiDeleteApproach, fetchHistory, fetchRecords, fetchStatus, updateApproach as apiUpdateApproach } from '../api'
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

let demoApproachId = 9000
/** Сегодня 09:00 + minutes минут (для демо-интервалов) */
function demoCreatedAt(minutes) {
  const d = new Date()
  d.setHours(9, minutes, 0, 0)
  return d.toISOString()
}

function buildDemoStatusRows() {
  demoApproachId = 9000
  const alexApproaches = [
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(0) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(5) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(12) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(22) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(35) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(50) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(68) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(88) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(108) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(128) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(148) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(170) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(195) },
    { id: ++demoApproachId, count: 8, created_at: demoCreatedAt(220) },
    { id: ++demoApproachId, count: 6, created_at: demoCreatedAt(248) },
  ]
  return [
    { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null, count: 118, approaches: alexApproaches },
    { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null, count: 90, approaches: [{ id: ++demoApproachId, count: 15, created_at: demoCreatedAt(5) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(20) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(35) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(95) }] },
    { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null, count: 100, approaches: [{ id: ++demoApproachId, count: 25, created_at: demoCreatedAt(0) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(30) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(60) }, { id: ++demoApproachId, count: 25, created_at: demoCreatedAt(90) }] },
    { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null, count: 30, approaches: [{ id: ++demoApproachId, count: 10, created_at: demoCreatedAt(0) }, { id: ++demoApproachId, count: 10, created_at: demoCreatedAt(15) }, { id: ++demoApproachId, count: 10, created_at: demoCreatedAt(30) }] },
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
        const rows = data.rows || []
        this.statusRows = rows.filter((r) => (r.count ?? r.total ?? 0) > 0)
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
            const nextId = Math.max(9000, ...this.statusRows.flatMap((r) => (r.approaches || []).map((a) => (a && typeof a === 'object' && 'id' in a ? a.id : 0)))) + 1
            statusRow.approaches.push({ id: nextId, count: delta, created_at: new Date().toISOString() })
          } else {
            const fallback = DEMO_USERS.find((row) => row.user_id === userId) || { user_id: userId }
            const nextId = Math.max(9000, ...this.statusRows.flatMap((r) => (r.approaches || []).map((a) => (a && typeof a === 'object' && 'id' in a ? a.id : 0)))) + 1
            this.statusRows.push({
              ...fallback,
              count: delta,
              approaches: [{ id: nextId, count: delta, created_at: new Date().toISOString() }],
            })
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
    async updateApproach(auth, approachId, userId, count, date) {
      this.error = ''
      try {
        if (DEMO_MODE) {
          const row = this.statusRows.find((r) => r.user_id === userId)
          if (row && Array.isArray(row.approaches)) {
            const approach = row.approaches.find((a) => a && typeof a === 'object' && a.id === approachId)
            if (approach) {
              approach.count = Math.max(1, Math.min(1000, Number(count) || 0))
              row.count = row.approaches.reduce((s, a) => s + (a && typeof a === 'object' && 'count' in a ? a.count : 0), 0)
            }
          }
          return
        }
        await apiUpdateApproach(auth, approachId, userId, count)
        await this.loadStatus(auth, date)
        if (userId) await this.loadHistory(auth, userId)
      } catch (error) {
        this.error = extractErrorMessage(error)
      }
    },
    async deleteApproach(auth, approachId, userId, date) {
      this.error = ''
      try {
        if (DEMO_MODE) {
          const row = this.statusRows.find((r) => r.user_id === userId)
          if (row && Array.isArray(row.approaches)) {
            row.approaches = row.approaches.filter((a) => !(a && typeof a === 'object' && a.id === approachId))
            row.count = row.approaches.reduce((s, a) => s + (a && typeof a === 'object' && 'count' in a ? a.count : 0), 0)
          }
          return
        }
        await apiDeleteApproach(auth, approachId, userId)
        await this.loadStatus(auth, date)
        if (userId) await this.loadHistory(auth, userId)
      } catch (error) {
        this.error = extractErrorMessage(error)
      }
    },
  },
})
