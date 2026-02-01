<script setup>
import { computed, onMounted, ref } from 'vue'
import AppHeader from './components/AppHeader.vue'
import TodayResults from './components/TodayResults.vue'
import Leaderboard from './components/Leaderboard.vue'
import CalendarView from './components/CalendarView.vue'
import { useAuthStore } from './stores/auth'
import { useDataStore } from './stores/data'

const auth = useAuthStore()
const data = useDataStore()

const monthCursor = ref(new Date())
const historyUserId = ref('')

onMounted(async () => {
  auth.load()
  historyUserId.value = auth.defaultUserId || ''
  if (auth.isReady) {
    await data.loadAll(auth, historyUserId.value || auth.defaultUserId)
  }
})

const todayResults = computed(() =>
  (data.statusRows || []).map((row) => ({
    key: row.user_id,
    label: row.username || row.first_name || row.user_id,
    value: row.count,
  }))
)

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
  const monthName = monthCursor.value.toLocaleString('en-US', { month: 'long' })
  return monthName
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
    result.push({ key: `empty-${i}`, value: '', tone: 'empty' })
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const count = Number(data.historyDays?.[dateKey] || 0)
    const tone = count >= 80 ? 'high' : count >= 40 ? 'mid' : count > 0 ? 'low' : 'empty'
    result.push({ key: dateKey, value: day, tone })
  }

  return result
})

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [year, month, day] = dateStr.split('-')
  return `${day}.${month}.${year}`
}

async function loadHistory() {
  if (!historyUserId.value) return
  await data.loadHistory(auth, Number(historyUserId.value))
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

      <TodayResults
        :items="todayResults"
        :user-input="historyUserId"
        @update:userInput="historyUserId = $event"
        :on-submit="loadHistory"
      />

      <Leaderboard :items="leaderboard" />

      <CalendarView
        :month-label="monthLabel"
        :days="calendarDays"
        :on-prev="() => moveMonth(-1)"
        :on-next="() => moveMonth(1)"
      />
    </div>
  </div>
</template>
