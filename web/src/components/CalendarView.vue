<script setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

defineProps({
  monthLabel: { type: String, required: true },
  days: { type: Array, default: () => [] },
  todayKey: { type: String, default: '' },
  onPrev: { type: Function, required: true },
  onNext: { type: Function, required: true },
})
</script>

<template>
  <Card class="calendar-card">
    <CardHeader class="calendar-header">
      <div>
        <CardTitle>Календарь тренировок</CardTitle>
        <p class="calendar-sub">{{ monthLabel }}</p>
      </div>
      <div class="calendar-nav">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="nav-button"
          aria-label="Предыдущий месяц"
          @click="onPrev"
        >
          ‹
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="nav-button"
          aria-label="Следующий месяц"
          @click="onNext"
        >
          ›
        </Button>
      </div>
    </CardHeader>
    <CardContent class="calendar-content">
      <div class="calendar-grid">
        <div v-for="w in 7" :key="w" class="weekday">
          {{ ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][w - 1] }}
        </div>
        <div
          v-for="day in days"
          :key="day.key"
          :class="['day', day.tone, { 'day-today': day.key === todayKey }]"
        >
          <template v-if="day.value">
            <span class="day-number">{{ day.value }}</span>
            <span v-if="day.count > 0" class="day-count">{{ day.count }} · {{ day.approachesCount || 0 }}п</span>
          </template>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.calendar-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.7rem;
}

.calendar-sub {
  margin: 0.18rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.calendar-nav {
  display: flex;
  gap: 0.3rem;
}

.nav-button {
  border-radius: 0.7rem;
}

.calendar-content {
  padding-top: 0.2rem;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.28rem;
}

.weekday {
  text-align: center;
  font-size: 0.66rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.day {
  border-radius: 0.64rem;
  min-height: 2.45rem;
  position: relative;
  background: rgba(244, 248, 252, 0.7);
}

.day-number {
  position: absolute;
  top: 0.21rem;
  left: 0.29rem;
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--foreground-strong);
}

.day-count {
  position: absolute;
  right: 0.29rem;
  bottom: 0.26rem;
  font-size: 0.55rem;
  font-weight: 700;
  color: var(--foreground-strong);
}

.day.empty {
  background: rgba(242, 246, 252, 0.58);
}

.day.mid {
  background: color-mix(in oklab, var(--accent-strong) 26%, white 74%);
}

.day.high {
  background: color-mix(in oklab, #22c55e 50%, white 50%);
}

.day-today {
  outline: 2px solid color-mix(in oklab, var(--accent-strong) 60%, white 40%);
  outline-offset: 1px;
}
</style>
