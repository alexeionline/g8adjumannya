<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AddBlock from './components/AddBlock.vue'
import TodayResults from './components/TodayResults.vue'
import Leaderboard from './components/Leaderboard.vue'
import CalendarView from './components/CalendarView.vue'
import LevelsBadges from './components/LevelsBadges.vue'
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card'
import { Alert, AlertDescription, AlertTitle } from './components/ui/alert'
import { useAuthStore } from './stores/auth'
import { useDataStore } from './stores/data'

const auth = useAuthStore()
const data = useDataStore()
const isDemo = import.meta.env.VITE_DEMO === '1'

const monthCursor = ref(new Date())
const historyUserId = ref('')
const addCountInput = ref('')

function getLocalDateKey() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`
}

onMounted(async () => {
  if (isDemo) {
    historyUserId.value = String(data.demoUserId || '')
    await data.loadAll(auth, historyUserId.value)
    return
  }

  auth.load()
  data.initializeFromStorage()

  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const tokenV2 = params.get('v2_token')
  const userId = params.get('user_id')
  const apiBase = params.get('api_base')
  const apiBaseV2 = params.get('api_base_v2')
  const chatId = params.get('chat_id')

  // Prefer v2 credentials when provided; keep v1 fallback for backward compatibility.
  if (tokenV2) {
    auth.token = tokenV2
    auth.apiBase = apiBaseV2 || `${window.location.origin}/api/v2`
  } else {
    if (apiBase) {
      auth.apiBase = apiBase
    }
    if (token) {
      auth.token = token
    }
  }
  if (userId) {
    auth.defaultUserId = userId
  }
  if (chatId) {
    auth.selectedChatId = chatId
    data.selectedChatId = chatId
  }

  if (token || tokenV2 || userId || apiBase || apiBaseV2 || chatId) {
    auth.save()
    window.history.replaceState({}, document.title, window.location.pathname)
  }

  if (!auth.apiBase) {
    auth.apiBase = window.location.origin
    auth.save()
  }

  historyUserId.value = auth.defaultUserId || ''
  if (auth.selectedChatId) {
    data.selectedChatId = auth.selectedChatId
  }

  if (auth.isReady) {
    await data.loadAll(auth, historyUserId.value || auth.defaultUserId)
  }
})

const todayDateKey = computed(() => data.currentDateKey || getLocalDateKey())

const selectedChatLabel = computed(() => {
  const hit = data.chats.find((chat) => chat.id === data.selectedChatId)
  return hit?.title || 'Текущий чат'
})

const todayTotal = computed(() => Number(data.historyDays?.[todayDateKey.value] || 0))
const todayProgress = computed(() => {
  const goal = Math.max(1, Number(data.targetPerDay || 100))
  return Math.max(0, Math.min(100, Math.round((todayTotal.value / goal) * 100)))
})
const targetDelta = computed(() => Math.max(0, Number(data.targetPerDay || 100) - todayTotal.value))

const todayResults = computed(() =>
  (data.statusRows || []).map((row) => {
    const raw = Array.isArray(row.approaches) ? row.approaches : []
    const approaches = raw.map((a) =>
      typeof a === 'object' && a != null && 'id' in a
        ? { id: a.id, count: Number(a.count) || 0, created_at: a.created_at ?? null }
        : { id: null, count: Number(a) || 0, created_at: null }
    )

    return {
      key: row.user_id,
      label: row.username || row.first_name || row.user_id,
      value: Number(row.count || 0),
      approaches: approaches.length > 0 ? approaches : (row.count > 0 ? [{ id: null, count: row.count, created_at: null }] : []),
    }
  })
)

const myRank = computed(() => {
  const me = String(historyUserId.value || auth.defaultUserId || '')
  if (!me) return null
  const index = todayResults.value.findIndex((item) => String(item.key) === me)
  return index >= 0 ? index + 1 : null
})

const myBestRank = computed(() => {
  const me = String(historyUserId.value || auth.defaultUserId || '')
  if (!me) return null
  const index = leaderboard.value.findIndex((item) => String(item.key) === me)
  return index >= 0 ? index + 1 : null
})

const myBestApproach = computed(() => {
  const me = String(historyUserId.value || auth.defaultUserId || '')
  if (!me) return 0

  const bestFromRecords = leaderboard.value.find((item) => String(item.key) === me)?.value ?? 0
  const myTodayRow = todayResults.value.find((item) => String(item.key) === me)
  const bestFromTodayApproaches = Math.max(
    0,
    ...(myTodayRow?.approaches || []).map((entry) => Number(entry.count || 0))
  )

  return Math.max(Number(bestFromRecords || 0), Number(bestFromTodayApproaches || 0))
})

const editableUserId = computed(() => {
  if (isDemo) {
    return String(historyUserId.value || data.demoUserId || '')
  }
  return String(auth.defaultUserId || historyUserId.value || '')
})

async function refreshToday() {
  await data.loadStatus(auth, data.currentDateKey || undefined)
}

async function handleUpdateApproach(approachId, userId, count) {
  if (String(userId ?? '') !== editableUserId.value) {
    data.error = 'Можно редактировать только свои подходы'
    return
  }
  await data.updateApproach(auth, approachId, userId, count, data.currentDateKey || undefined)
}

async function handleDeleteApproach(approachId, userId) {
  if (String(userId ?? '') !== editableUserId.value) {
    data.error = 'Можно удалять только свои подходы'
    return
  }
  await data.deleteApproach(auth, approachId, userId, data.currentDateKey || undefined)
}

const leaderboard = computed(() =>
  (data.recordsRows || []).map((row, index) => ({
    key: row.user_id,
    label: row.username || row.first_name || row.user_id,
    value: row.max_add,
    date: formatDate(row.record_date),
    rank: index + 1,
  }))
)

const monthLabel = computed(() => {
  const monthName = monthCursor.value.toLocaleString('ru-RU', { month: 'long' })
  return monthName.charAt(0).toUpperCase() + monthName.slice(1)
})

const calendarDays = computed(() => {
  const year = monthCursor.value.getFullYear()
  const month = monthCursor.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const daysInMonth = lastDay.getDate()
  const weekdayIndex = (firstDay.getDay() + 6) % 7
  const result = []

  for (let i = 0; i < weekdayIndex; i += 1) {
    result.push({ key: `empty-${i}`, value: '', tone: 'empty', count: null })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const count = Number(data.historyDays?.[dateKey] || 0)
    const tone = count >= 100 ? 'high' : count > 0 ? 'mid' : 'empty'
    result.push({ key: dateKey, value: day, tone, count })
  }

  return result
})

const participationDays = computed(() =>
  Object.values(data.historyDays || {}).filter((count) => Number(count) > 0).length
)
const totalPushups = computed(() =>
  Object.values(data.historyDays || {}).reduce((sum, count) => sum + Number(count || 0), 0)
)
const averagePushups = computed(() => {
  if (!participationDays.value) {
    return '0'
  }
  return (totalPushups.value / participationDays.value).toFixed(1)
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const parsed = new Date(dateStr)
  if (Number.isNaN(parsed.getTime())) return dateStr
  const day = String(parsed.getDate()).padStart(2, '0')
  const month = String(parsed.getMonth() + 1).padStart(2, '0')
  const year = parsed.getFullYear()
  return `${day}.${month}.${year}`
}

async function submitAdd() {
  const delta = Number(addCountInput.value)
  if (!Number.isFinite(delta)) {
    data.error = 'Введите количество повторений'
    return
  }
  if (!historyUserId.value) {
    data.error = 'Укажи user_id в настройках'
    return
  }
  await data.addCount(auth, Number(historyUserId.value), delta)
  addCountInput.value = ''
}

function moveMonth(direction) {
  const next = new Date(monthCursor.value)
  next.setMonth(next.getMonth() + direction)
  monthCursor.value = next
}

async function onChangeChat(event) {
  const chatId = event?.target?.value || ''
  data.setSelectedChat(auth, chatId)
  await Promise.all([data.loadStatus(auth), data.loadRecords(auth)])
}

</script>

<template>
  <div class="app-shell">
    <div class="app-phone">
      <AppHeader
        title="G8 Adjumannya"
        subtitle="Трекер челленджа"
      />

      <Alert v-if="!auth.isReady && !isDemo" variant="default">
        <AlertTitle>Нет доступа</AlertTitle>
        <AlertDescription>
          Открой WebApp через команду /web в нужном чате.
        </AlertDescription>
      </Alert>

      <Alert v-if="data.error" variant="destructive">
        <AlertTitle>Ошибка</AlertTitle>
        <AlertDescription>{{ data.error }}</AlertDescription>
      </Alert>

      <Card class="hero-card">
        <CardHeader class="hero-top">
          <div>
            <p class="hero-kicker">Главный экран</p>
            <CardTitle class="hero-title">Панель контроля за сегодня</CardTitle>
          </div>
        </CardHeader>
        <CardContent class="hero-content">
          <div class="hero-progress-row">
            <div class="hero-progress-text">
              <p class="hero-progress-label">Прогресс</p>
              <p class="hero-progress-value">{{ todayTotal }} / {{ data.targetPerDay }}</p>
            </div>
            <div class="hero-progress-track" aria-hidden="true">
              <span class="hero-progress-fill" :style="{ width: `${todayProgress}%` }" />
            </div>
            <p class="hero-progress-footnote">
              <span v-if="targetDelta > 0">До цели осталось {{ targetDelta }}</span>
              <span v-else>Цель выполнена. Продолжай в том же темпе.</span>
            </p>
          </div>

          <div class="hero-metrics">
            <div class="metric-pill">
              <span class="metric-label">Текущая серия</span>
              <span class="metric-value">{{ data.currentStreak }} д</span>
            </div>
            <div class="metric-pill">
              <span class="metric-label">Лучшая серия</span>
              <span class="metric-value">{{ data.bestStreak }} д</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <AddBlock
        :user-input="addCountInput"
        :target-value="data.targetPerDay"
        :current-total="todayTotal"
        @update:userInput="addCountInput = $event"
        :on-submit="submitAdd"
      />

      <Card class="chat-context-card">
        <CardHeader class="chat-context-header">
          <div>
            <CardTitle>Контекст чата</CardTitle>
            <p class="chat-context-sub">{{ selectedChatLabel }}</p>
          </div>
          <div class="chat-switch">
            <label class="chat-label" for="chat-select">Чат</label>
            <select
              id="chat-select"
              class="chat-select"
              :value="data.selectedChatId"
              @change="onChangeChat"
            >
              <option
                v-for="chat in data.chats"
                :key="chat.id"
                :value="chat.id"
              >
                {{ chat.title }}
              </option>
              <option v-if="!data.chats.length" value="">Текущий чат</option>
            </select>
          </div>
        </CardHeader>
        <CardContent class="chat-context-metrics">
          <div class="context-pill">
            <span class="context-label">Моё место сегодня</span>
            <span class="context-value">{{ myRank ? `#${myRank}` : '—' }}</span>
          </div>
          <div class="context-pill">
            <span class="context-label">Моё место в рекордах</span>
            <span class="context-value">{{ myBestRank ? `#${myBestRank}` : '—' }}</span>
          </div>
        </CardContent>
      </Card>

      <TodayResults
        :items="todayResults"
        :goal="data.targetPerDay"
        :editable-user-id="editableUserId"
        :on-refresh="refreshToday"
        :on-update-approach="handleUpdateApproach"
        :on-delete-approach="handleDeleteApproach"
      />

      <Leaderboard
        :items="leaderboard"
      />

      <Card class="stats-card">
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
        </CardHeader>
        <CardContent class="stats-grid">
          <article class="stat-item">
            <p class="stat-key">Дней активности</p>
            <p class="stat-value">{{ participationDays }}</p>
          </article>
          <article class="stat-item">
            <p class="stat-key">Всего повторений</p>
            <p class="stat-value">{{ totalPushups }}</p>
          </article>
          <article class="stat-item">
            <p class="stat-key">Среднее</p>
            <p class="stat-value">{{ averagePushups }}</p>
          </article>
          <article class="stat-item">
            <p class="stat-key">Цель</p>
            <p class="stat-value">{{ data.targetPerDay }}</p>
          </article>
        </CardContent>
      </Card>

      <CalendarView
        :month-label="monthLabel"
        :days="calendarDays"
        :today-key="todayDateKey"
        :on-prev="() => moveMonth(-1)"
        :on-next="() => moveMonth(1)"
      />

      <LevelsBadges
        :history-days="data.historyDays"
        :best-approach="myBestApproach"
      />
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  width: 100%;
}

.app-phone {
  width: min(458px, 100%);
  margin: 0 auto;
  display: grid;
  gap: 0.95rem;
  padding-bottom: 1.25rem;
}

.hero-card {
  border: 0;
  background:
    radial-gradient(circle at 14% 8%, rgba(12, 160, 255, 0.2), transparent 38%),
    linear-gradient(150deg, rgba(255, 255, 255, 0.98), rgba(247, 252, 255, 0.93));
  box-shadow: var(--shadow-soft);
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.9rem;
}

.hero-kicker {
  margin: 0;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
}

.hero-title {
  margin-top: 0.24rem;
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  color: var(--foreground-strong);
}

.hero-content {
  display: grid;
  gap: 0.95rem;
}

.hero-progress-row {
  display: grid;
  gap: 0.42rem;
}

.hero-progress-label {
  margin: 0;
  font-size: 0.78rem;
  color: var(--muted-foreground);
}

.hero-progress-value {
  margin: 0.2rem 0 0;
  font-family: var(--font-display);
  font-size: 1.3rem;
  line-height: 1;
  letter-spacing: -0.02em;
  color: var(--foreground-strong);
}

.hero-progress-track {
  height: 0.48rem;
  border-radius: 999px;
  background: rgba(13, 56, 92, 0.1);
  overflow: hidden;
}

.hero-progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-strong), #46d2ff);
  transition: width 0.34s ease;
}

.hero-progress-footnote {
  margin: 0;
  font-size: 0.76rem;
  color: var(--muted-foreground);
}

.hero-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.52rem;
}

.metric-pill {
  border-radius: 0.84rem;
  background: rgba(244, 249, 253, 0.94);
  padding: 0.56rem 0.63rem;
  display: grid;
  gap: 0.22rem;
  min-height: 3.2rem;
}

.metric-label {
  font-size: 0.68rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.metric-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--foreground-strong);
}

.chat-context-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.chat-context-header {
  display: flex;
  justify-content: space-between;
  gap: 0.7rem;
  align-items: flex-start;
}

.chat-context-sub {
  margin: 0.22rem 0 0;
  font-size: 0.78rem;
  color: var(--muted-foreground);
}

.chat-switch {
  display: grid;
  gap: 0.22rem;
  justify-items: end;
}

.chat-label {
  font-size: 0.64rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
}

.chat-select {
  width: min(10.8rem, 46vw);
  min-height: 2rem;
  border: 1px solid rgba(17, 53, 91, 0.14);
  border-radius: 0.7rem;
  background: rgba(255, 255, 255, 0.92);
  color: var(--foreground);
  font: inherit;
  font-size: 0.76rem;
  padding: 0.2rem 0.45rem;
}

.chat-select:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.chat-context-metrics {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.52rem;
}

.context-pill {
  border-radius: 0.84rem;
  background: rgba(244, 249, 253, 0.94);
  padding: 0.56rem 0.63rem;
  display: grid;
  gap: 0.22rem;
  min-height: 3.2rem;
}

.context-label {
  font-size: 0.68rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.context-value {
  font-size: 1.02rem;
  font-weight: 800;
  color: var(--foreground-strong);
}

.stats-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.56rem;
}

.stat-item {
  margin: 0;
  padding: 0.7rem;
  border-radius: 0.9rem;
  background: rgba(243, 248, 253, 0.88);
}

.stat-key {
  margin: 0;
  font-size: 0.71rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted-foreground);
}

.stat-value {
  margin: 0.34rem 0 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  line-height: 1;
  color: var(--foreground-strong);
}

@media (min-width: 620px) {
  .app-phone {
    width: min(760px, 100%);
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
  }

  .app-phone > :first-child,
  .app-phone > :nth-child(2),
  .app-phone > :nth-child(3),
  .app-phone > :nth-child(4),
  .app-phone > :nth-child(5) {
    grid-column: 1 / -1;
  }
}
</style>
