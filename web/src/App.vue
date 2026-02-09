<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import AddBlock from './components/AddBlock.vue'
import TodayResults from './components/TodayResults.vue'
import Leaderboard from './components/Leaderboard.vue'
import CalendarView from './components/CalendarView.vue'
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

onMounted(async () => {
  if (isDemo) {
    historyUserId.value = String(data.demoUserId || '')
    await data.loadAll(auth, historyUserId.value)
    return
  }
  auth.load()
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const userId = params.get('user_id')
  const apiBase = params.get('api_base')
  if (apiBase) {
    auth.apiBase = apiBase
  }
  if (token) {
    auth.token = token
  }
  if (userId) {
    auth.defaultUserId = userId
  }
  if (token || userId || apiBase) {
    auth.save()
    window.history.replaceState({}, document.title, window.location.pathname)
  }
  if (!auth.apiBase) {
    auth.apiBase = window.location.origin
    auth.save()
  }
  historyUserId.value = auth.defaultUserId || ''
  if (auth.isReady) {
    await data.loadAll(auth, historyUserId.value || auth.defaultUserId)
  }
})

const todayDateKey = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

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
      value: row.count,
      approaches: approaches.length > 0 ? approaches : (row.count > 0 ? [{ id: null, count: row.count, created_at: null }] : []),
    }
  })
)

async function refreshToday() {
  await data.loadStatus(auth, todayDateKey.value)
}

async function handleUpdateApproach(approachId, userId, count) {
  await data.updateApproach(auth, approachId, userId, count, todayDateKey.value)
}

async function handleDeleteApproach(approachId, userId) {
  await data.deleteApproach(auth, approachId, userId, todayDateKey.value)
}

const leaderboard = computed(() =>
  (data.recordsRows || []).map((row, index) => {
    const medal = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : null
    return {
      key: row.user_id,
      label: row.username || row.first_name || row.user_id,
      value: row.max_add,
      date: formatDate(row.record_date),
      medal,
      rank: index + 1,
    }
  })
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

async function loadHistory() {
  if (!historyUserId.value) return
  await data.loadHistory(auth, Number(historyUserId.value))
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
</script>

<template>
  <div class="app">
    <div class="phone">
      <AppHeader title="G8 Adjumannya" />

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

      <AddBlock
        :user-input="addCountInput"
        @update:userInput="addCountInput = $event"
        :on-submit="submitAdd"
      />

      <TodayResults
        :items="todayResults"
        :on-refresh="refreshToday"
        :on-update-approach="handleUpdateApproach"
        :on-delete-approach="handleDeleteApproach"
      />

      <Leaderboard :items="leaderboard" />

      <Card>
        <CardHeader>
          <CardTitle>Статистика</CardTitle>
        </CardHeader>
        <CardContent>
          <div class="stats-grid">
            <div class="stat-card">
              <span class="stat-label">Дней участия</span>
              <span class="stat-value">{{ participationDays }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Всего отжиманий</span>
              <span class="stat-value">{{ totalPushups }}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Среднее за день</span>
              <span class="stat-value">{{ averagePushups }}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <CalendarView
        :month-label="monthLabel"
        :days="calendarDays"
        :on-prev="() => moveMonth(-1)"
        :on-next="() => moveMonth(1)"
      />
    </div>
  </div>
</template>

<style scoped>
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
}

.stat-card {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.75rem;
  border-radius: var(--radius);
  background: var(--muted);
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--foreground);
}
</style>
