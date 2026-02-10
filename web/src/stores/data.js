import { defineStore } from 'pinia'
import {
  addPushups,
  deleteApproach as apiDeleteApproach,
  fetchApproaches,
  fetchChats,
  fetchHistory,
  fetchRecords,
  fetchStatus,
  updateApproach as apiUpdateApproach,
} from '../api'
import { extractErrorMessage } from '../api/client'
import {
  buildApproachesDaysFromHistory,
  buildTimeOfDayPushups,
  clampTarget,
  cloneValue,
  computeStreaks,
  formatDateKey,
  normalizeApiDateKey,
  normalizeChats,
  normalizeRecordsRows,
  normalizeStatusRows,
} from './data.utils'
import { buildDemoByChat, buildRecordsFromStatus, DEMO_CHATS, DEMO_USERS } from './data.demo'

const DEMO_MODE = import.meta.env.VITE_DEMO === '1'
const TARGET_STORAGE_KEY = 'g8a-target-per-day'

export const useDataStore = defineStore('data', {
  state: () => ({
    loading: false,
    error: '',
    statusRows: [],
    recordsRows: [],
    historyDays: {},
    historyApproachesDays: {},
    timeOfDayPushups: { morning: 0, day: 0, evening: 0, total: 0 },
    demoReady: false,
    demoUserId: DEMO_USERS[0].user_id,
    chats: [],
    selectedChatId: '',
    targetPerDay: 100,
    currentStreak: 0,
    bestStreak: 0,
    currentDateKey: '',
    demoByChat: {},
  }),
  actions: {
    initializeFromStorage() {
      if (typeof window === 'undefined') return
      const savedTarget = window.localStorage.getItem(TARGET_STORAGE_KEY)
      if (savedTarget != null) {
        this.targetPerDay = clampTarget(savedTarget)
      }
    },
    persistTarget() {
      if (typeof window === 'undefined') return
      window.localStorage.setItem(TARGET_STORAGE_KEY, String(clampTarget(this.targetPerDay)))
    },
    setTargetPerDay(value) {
      this.targetPerDay = clampTarget(value)
      this.persistTarget()
      this.recalculateStreaks()
    },
    recalculateStreaks() {
      const result = computeStreaks(this.historyDays, this.targetPerDay, this.currentDateKey)
      this.currentStreak = result.currentStreak
      this.bestStreak = result.bestStreak
    },
    getActiveDemoPack() {
      if (!this.selectedChatId || !this.demoByChat[this.selectedChatId]) {
        return null
      }
      return this.demoByChat[this.selectedChatId]
    },
    syncFromDemoPack() {
      const pack = this.getActiveDemoPack()
      if (!pack) {
        this.statusRows = []
        this.recordsRows = []
        this.historyDays = {}
        this.historyApproachesDays = {}
        this.timeOfDayPushups = { morning: 0, day: 0, evening: 0, total: 0 }
        this.currentDateKey = formatDateKey(new Date())
        this.recalculateStreaks()
        return
      }
      this.statusRows = cloneValue(pack.statusRows).sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      this.recordsRows = cloneValue(pack.recordsRows).sort((a, b) => Number(b.max_add || 0) - Number(a.max_add || 0))
      this.historyDays = { ...pack.historyDays }
      this.currentDateKey = formatDateKey(new Date())
      this.historyApproachesDays = buildApproachesDaysFromHistory(pack.historyDays)
      const myRow = pack.statusRows.find((row) => Number(row.user_id) === Number(this.demoUserId))
      if (myRow) {
        this.historyApproachesDays[this.currentDateKey] = Array.isArray(myRow.approaches) ? myRow.approaches.length : 0
        this.timeOfDayPushups = buildTimeOfDayPushups(myRow.approaches || [])
      } else {
        this.timeOfDayPushups = { morning: 0, day: 0, evening: 0, total: 0 }
      }
      this.recalculateStreaks()
    },
    ensureDemoData() {
      if (!DEMO_MODE || this.demoReady) {
        return
      }
      this.demoByChat = buildDemoByChat()
      this.chats = DEMO_CHATS
      if (!this.selectedChatId || !this.demoByChat[this.selectedChatId]) {
        this.selectedChatId = DEMO_CHATS[0].id
      }
      this.demoReady = true
      this.syncFromDemoPack()
    },
    async loadAll(auth, userId) {
      this.initializeFromStorage()
      await this.loadChats(auth)
      await Promise.all([
        this.loadStatus(auth),
        this.loadRecords(auth),
        this.loadHistory(auth, userId),
        this.loadHistoryApproaches(auth, userId),
      ])
    },
    async loadChats(auth) {
      try {
        if (DEMO_MODE) {
          this.ensureDemoData()
          return
        }
        const payload = await fetchChats(auth)
        const normalized = normalizeChats(payload)
        if (normalized.length > 0) {
          this.chats = normalized
          if (auth.selectedChatId && normalized.some((chat) => chat.id === auth.selectedChatId)) {
            this.selectedChatId = auth.selectedChatId
          } else if (this.selectedChatId && normalized.some((chat) => chat.id === this.selectedChatId)) {
            // keep current
          } else {
            this.selectedChatId = normalized[0].id
          }
          auth.selectedChatId = this.selectedChatId
          auth.save()
        } else {
          this.chats = []
          this.selectedChatId = ''
        }
      } catch {
        this.chats = this.selectedChatId
          ? [{ id: this.selectedChatId, title: 'Текущий чат' }]
          : []
      }
    },
    setSelectedChat(auth, chatId) {
      this.selectedChatId = chatId ? String(chatId) : ''
      if (auth) {
        auth.selectedChatId = this.selectedChatId
        auth.save()
      }
      if (DEMO_MODE) {
        this.syncFromDemoPack()
      }
    },
    async loadStatus(auth, date) {
      this.loading = true
      this.error = ''
      try {
        if (DEMO_MODE) {
          this.ensureDemoData()
          this.syncFromDemoPack()
          return
        }
        auth.selectedChatId = this.selectedChatId || auth.selectedChatId || ''
        const data = await fetchStatus(auth, date)
        this.statusRows = normalizeStatusRows(data.rows)
        if (typeof data?.date === 'string' && data.date) {
          this.currentDateKey = data.date
        }
        this.recalculateStreaks()
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
          this.syncFromDemoPack()
          return
        }
        auth.selectedChatId = this.selectedChatId || auth.selectedChatId || ''
        const data = await fetchRecords(auth)
        this.recordsRows = normalizeRecordsRows(data.rows)
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async loadHistory(auth, userId) {
      if (!userId) {
        this.historyDays = {}
        this.historyApproachesDays = {}
        this.recalculateStreaks()
        return
      }
      this.loading = true
      this.error = ''
      try {
        if (DEMO_MODE) {
          this.ensureDemoData()
          this.syncFromDemoPack()
          return
        }
        const data = await fetchHistory(auth, userId)
        this.historyDays = data.days || {}
        this.recalculateStreaks()
      } catch (error) {
        this.error = extractErrorMessage(error)
      } finally {
        this.loading = false
      }
    },
    async loadHistoryApproaches(auth, userId) {
      if (!userId) {
        this.historyApproachesDays = {}
        this.timeOfDayPushups = { morning: 0, day: 0, evening: 0, total: 0 }
        return
      }
      if (DEMO_MODE) {
        this.ensureDemoData()
        this.syncFromDemoPack()
        return
      }
      if (String(userId) !== String(auth?.defaultUserId || '')) {
        this.historyApproachesDays = {}
        this.timeOfDayPushups = { morning: 0, day: 0, evening: 0, total: 0 }
        return
      }
      try {
        const end = this.currentDateKey || formatDateKey(new Date())
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - 365)
        const start = formatDateKey(startDate)
        const rows = await fetchApproaches(auth, start, end, userId)
        const map = {}
        ;(rows || []).forEach((entry) => {
          if (entry?.migrated) return
          const key = normalizeApiDateKey(entry?.date)
          if (!key) return
          map[key] = Number(map[key] || 0) + 1
        })
        this.historyApproachesDays = map
        this.timeOfDayPushups = buildTimeOfDayPushups(rows)
      } catch {
        // v1 API may not have /approaches; keep map empty without surfacing an error.
        this.historyApproachesDays = {}
        this.timeOfDayPushups = { morning: 0, day: 0, evening: 0, total: 0 }
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
          const pack = this.getActiveDemoPack()
          if (!pack) return

          const todayKey = formatDateKey(new Date())
          const currentTotal = Number(pack.historyDays[todayKey] || 0)
          const nextTotal = currentTotal + delta
          pack.historyDays[todayKey] = nextTotal

          const statusRow = pack.statusRows.find((row) => row.user_id === userId)
          const allIds = pack.statusRows.flatMap((row) => (row.approaches || []).map((entry) => Number(entry.id || 0)))
          const nextId = Math.max(9000, ...allIds, 0) + 1

          if (statusRow) {
            statusRow.count = Number(statusRow.count || 0) + delta
            if (!Array.isArray(statusRow.approaches)) statusRow.approaches = []
            statusRow.approaches.push({ id: nextId, count: delta, created_at: new Date().toISOString() })
          } else {
            const fallback = DEMO_USERS.find((row) => row.user_id === userId) || { user_id: userId }
            pack.statusRows.push({
              ...fallback,
              count: delta,
              approaches: [{ id: nextId, count: delta, created_at: new Date().toISOString() }],
            })
          }

          pack.statusRows = pack.statusRows
            .map((row) => ({
              ...row,
              count: Number(row.count || 0),
            }))
            .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))

          pack.recordsRows = buildRecordsFromStatus(pack.statusRows)
          this.syncFromDemoPack()
          return
        }

        await addPushups(auth, userId, delta)
        await Promise.all([
          this.loadStatus(auth),
          this.loadRecords(auth),
          this.loadHistory(auth, userId),
          this.loadHistoryApproaches(auth, userId),
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
          const pack = this.getActiveDemoPack()
          if (!pack) return
          const row = pack.statusRows.find((entry) => entry.user_id === userId)
          if (row && Array.isArray(row.approaches)) {
            const approach = row.approaches.find((entry) => Number(entry.id) === Number(approachId))
            if (approach) {
              approach.count = Math.max(1, Math.min(1000, Number(count) || 0))
              row.count = row.approaches.reduce((sum, entry) => sum + Number(entry.count || 0), 0)
            }
          }
          pack.recordsRows = buildRecordsFromStatus(pack.statusRows)
          this.syncFromDemoPack()
          return
        }
        await apiUpdateApproach(auth, approachId, userId, count)
        await this.loadStatus(auth, date)
        if (userId) {
          await Promise.all([
            this.loadHistory(auth, userId),
            this.loadHistoryApproaches(auth, userId),
          ])
        }
      } catch (error) {
        this.error = extractErrorMessage(error)
      }
    },
    async deleteApproach(auth, approachId, userId, date) {
      this.error = ''
      try {
        if (DEMO_MODE) {
          const pack = this.getActiveDemoPack()
          if (!pack) return
          const row = pack.statusRows.find((entry) => entry.user_id === userId)
          if (row && Array.isArray(row.approaches)) {
            row.approaches = row.approaches.filter((entry) => Number(entry.id) !== Number(approachId))
            row.count = row.approaches.reduce((sum, entry) => sum + Number(entry.count || 0), 0)
          }
          pack.recordsRows = buildRecordsFromStatus(pack.statusRows)
          this.syncFromDemoPack()
          return
        }
        await apiDeleteApproach(auth, approachId, userId)
        await this.loadStatus(auth, date)
        if (userId) {
          await Promise.all([
            this.loadHistory(auth, userId),
            this.loadHistoryApproaches(auth, userId),
          ])
        }
      } catch (error) {
        this.error = extractErrorMessage(error)
      }
    },
  },
})
