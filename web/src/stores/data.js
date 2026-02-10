import { defineStore } from 'pinia'
import {
  addPushups,
  deleteApproach as apiDeleteApproach,
  fetchChats,
  fetchHistory,
  fetchRecords,
  fetchStatus,
  updateApproach as apiUpdateApproach,
} from '../api'
import { extractErrorMessage } from '../api/client'

const DEMO_MODE = import.meta.env.VITE_DEMO === '1'
const TARGET_STORAGE_KEY = 'g8a-target-per-day'

const DEMO_USERS = [
  { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null },
  { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null },
  { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null },
  { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null },
]

const DEMO_CHATS = [
  { id: '-10024588112', title: 'G8 Утренняя команда' },
  { id: '-10019877221', title: 'Вечерние бойцы' },
]

function formatDateKey(date) {
  return date.toISOString().slice(0, 10)
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value))
}

function clampTarget(value) {
  return Math.max(20, Math.min(500, Number(value) || 100))
}

function parseChat(raw, index = 0) {
  const id = raw?.chat_id ?? raw?.id ?? raw?.chatId ?? raw?.value
  if (id == null) {
    return null
  }
  const title = raw?.title ?? raw?.name ?? raw?.label ?? `Чат ${index + 1}`
  return {
    id: String(id),
    title: String(title),
  }
}

function normalizeChats(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.chats)
        ? payload.chats
        : []

  const parsed = candidates
    .map((item, index) => parseChat(item, index))
    .filter(Boolean)

  const uniqMap = new Map(parsed.map((item) => [item.id, item]))
  return Array.from(uniqMap.values())
}

function normalizeStatusRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      user_id: Number(row.user_id),
      username: row.username ?? row.display_name ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      count: Number(row.count ?? row.total ?? 0),
      approaches: Array.isArray(row.approaches) ? row.approaches : [],
    }))
    .filter((row) => Number(row.count || 0) > 0)
}

function normalizeRecordsRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      user_id: Number(row.user_id),
      username: row.username ?? row.display_name ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      max_add: Number(row.max_add ?? row.best_approach ?? 0),
      record_date: row.record_date ?? row.best_day_date ?? null,
    }))
    .sort((a, b) => Number(b.max_add || 0) - Number(a.max_add || 0))
}

function computeStreaks(days, target) {
  const threshold = clampTarget(target)
  const streakableDates = Object.keys(days || {})
    .filter((dateKey) => Number(days[dateKey] || 0) >= threshold)
    .sort()

  if (streakableDates.length === 0) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  let best = 0
  let run = 0
  let previous = null

  for (const dateKey of streakableDates) {
    const current = new Date(`${dateKey}T00:00:00`)
    if (Number.isNaN(current.getTime())) {
      continue
    }

    if (!previous) {
      run = 1
    } else {
      const diff = Math.round((current.getTime() - previous.getTime()) / 86_400_000)
      run = diff === 1 ? run + 1 : 1
    }

    best = Math.max(best, run)
    previous = current
  }

  let currentStreak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)

  while (true) {
    const key = formatDateKey(cursor)
    if (Number(days?.[key] || 0) >= threshold) {
      currentStreak += 1
      cursor.setDate(cursor.getDate() - 1)
      continue
    }
    break
  }

  return {
    currentStreak,
    bestStreak: best,
  }
}

function demoCreatedAt(minutes) {
  const d = new Date()
  d.setHours(9, minutes, 0, 0)
  return d.toISOString()
}

function buildDemoHistory(seed = 0) {
  const days = {}
  const today = new Date()
  const variants = [0, 36, 58, 72, 94, 105, 116, 45]

  for (let i = 0; i < 60; i += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const pick = variants[(i + seed) % variants.length]
    const value = i % 9 === 0 ? 0 : pick
    days[formatDateKey(date)] = value
  }

  return days
}

function buildMorningStatusRows() {
  return [
    {
      ...DEMO_USERS[0],
      count: 104,
      approaches: [
        { id: 11001, count: 12, created_at: demoCreatedAt(0) },
        { id: 11002, count: 12, created_at: demoCreatedAt(10) },
        { id: 11003, count: 12, created_at: demoCreatedAt(22) },
        { id: 11004, count: 12, created_at: demoCreatedAt(36) },
        { id: 11005, count: 12, created_at: demoCreatedAt(52) },
        { id: 11006, count: 12, created_at: demoCreatedAt(70) },
        { id: 11007, count: 12, created_at: demoCreatedAt(93) },
        { id: 11008, count: 12, created_at: demoCreatedAt(118) },
        { id: 11009, count: 8, created_at: demoCreatedAt(150) },
      ],
    },
    {
      ...DEMO_USERS[1],
      count: 84,
      approaches: [
        { id: 12001, count: 20, created_at: demoCreatedAt(5) },
        { id: 12002, count: 22, created_at: demoCreatedAt(23) },
        { id: 12003, count: 20, created_at: demoCreatedAt(52) },
        { id: 12004, count: 22, created_at: demoCreatedAt(88) },
      ],
    },
    {
      ...DEMO_USERS[2],
      count: 118,
      approaches: [
        { id: 13001, count: 30, created_at: demoCreatedAt(0) },
        { id: 13002, count: 30, created_at: demoCreatedAt(29) },
        { id: 13003, count: 28, created_at: demoCreatedAt(62) },
        { id: 13004, count: 30, created_at: demoCreatedAt(98) },
      ],
    },
    {
      ...DEMO_USERS[3],
      count: 64,
      approaches: [
        { id: 14001, count: 18, created_at: demoCreatedAt(0) },
        { id: 14002, count: 18, created_at: demoCreatedAt(18) },
        { id: 14003, count: 14, created_at: demoCreatedAt(36) },
        { id: 14004, count: 14, created_at: demoCreatedAt(54) },
      ],
    },
  ]
}

function buildEveningStatusRows() {
  return [
    {
      ...DEMO_USERS[0],
      count: 78,
      approaches: [
        { id: 21001, count: 20, created_at: demoCreatedAt(10) },
        { id: 21002, count: 18, created_at: demoCreatedAt(36) },
        { id: 21003, count: 20, created_at: demoCreatedAt(74) },
        { id: 21004, count: 20, created_at: demoCreatedAt(115) },
      ],
    },
    {
      ...DEMO_USERS[1],
      count: 112,
      approaches: [
        { id: 22001, count: 24, created_at: demoCreatedAt(8) },
        { id: 22002, count: 24, created_at: demoCreatedAt(32) },
        { id: 22003, count: 24, created_at: demoCreatedAt(60) },
        { id: 22004, count: 20, created_at: demoCreatedAt(94) },
        { id: 22005, count: 20, created_at: demoCreatedAt(132) },
      ],
    },
    {
      ...DEMO_USERS[2],
      count: 67,
      approaches: [
        { id: 23001, count: 17, created_at: demoCreatedAt(12) },
        { id: 23002, count: 16, created_at: demoCreatedAt(35) },
        { id: 23003, count: 17, created_at: demoCreatedAt(68) },
        { id: 23004, count: 17, created_at: demoCreatedAt(112) },
      ],
    },
    {
      ...DEMO_USERS[3],
      count: 126,
      approaches: [
        { id: 24001, count: 30, created_at: demoCreatedAt(0) },
        { id: 24002, count: 32, created_at: demoCreatedAt(30) },
        { id: 24003, count: 34, created_at: demoCreatedAt(70) },
        { id: 24004, count: 30, created_at: demoCreatedAt(110) },
      ],
    },
  ]
}

function buildRecordsFromStatus(statusRows) {
  const todayKey = formatDateKey(new Date())
  return statusRows
    .map((row) => ({
      user_id: row.user_id,
      username: row.username,
      first_name: row.first_name,
      last_name: row.last_name,
      max_add: Math.max(...(row.approaches || []).map((entry) => Number(entry.count || 0)), 0),
      record_date: todayKey,
    }))
    .sort((a, b) => b.max_add - a.max_add)
}

function buildDemoByChat() {
  const morningStatus = buildMorningStatusRows()
  const eveningStatus = buildEveningStatusRows()

  return {
    [DEMO_CHATS[0].id]: {
      statusRows: morningStatus,
      recordsRows: buildRecordsFromStatus(morningStatus),
      historyDays: buildDemoHistory(1),
    },
    [DEMO_CHATS[1].id]: {
      statusRows: eveningStatus,
      recordsRows: buildRecordsFromStatus(eveningStatus),
      historyDays: buildDemoHistory(4),
    },
  }
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
    chats: [],
    selectedChatId: '',
    targetPerDay: 100,
    currentStreak: 0,
    bestStreak: 0,
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
      const result = computeStreaks(this.historyDays, this.targetPerDay)
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
        this.recalculateStreaks()
        return
      }
      this.statusRows = deepClone(pack.statusRows).sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      this.recordsRows = deepClone(pack.recordsRows).sort((a, b) => Number(b.max_add || 0) - Number(a.max_add || 0))
      this.historyDays = { ...pack.historyDays }
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
      await Promise.all([this.loadStatus(auth), this.loadRecords(auth), this.loadHistory(auth, userId)])
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
        if (userId) await this.loadHistory(auth, userId)
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
        if (userId) await this.loadHistory(auth, userId)
      } catch (error) {
        this.error = extractErrorMessage(error)
      }
    },
  },
})
