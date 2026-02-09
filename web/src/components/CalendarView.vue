<script setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

defineProps({
  monthLabel: { type: String, required: true },
  days: { type: Array, default: () => [] },
  onPrev: { type: Function, required: true },
  onNext: { type: Function, required: true },
})
</script>

<template>
  <Card>
    <CardHeader class="flex flex-row items-center justify-between gap-2 px-4 py-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="shrink-0"
        aria-label="Предыдущий месяц"
        @click="onPrev"
      >
        ‹
      </Button>
      <CardTitle class="mb-0 text-base font-semibold">
        {{ monthLabel }}
      </CardTitle>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        class="shrink-0"
        aria-label="Следующий месяц"
        @click="onNext"
      >
        ›
      </Button>
    </CardHeader>
    <CardContent class="px-4 pb-4 pt-0">
      <div class="calendar-grid">
        <div v-for="w in 7" :key="w" class="weekday">
          {{ ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'][w - 1] }}
        </div>
        <div
          v-for="day in days"
          :key="day.key"
          :class="['day', day.tone]"
        >
          <template v-if="day.value">
            <span class="day-number">{{ day.value }}</span>
            <span v-if="day.count > 0" class="day-count">{{ day.count }}</span>
          </template>
        </div>
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.weekday {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  text-align: center;
}

.day {
  text-align: center;
  padding: 4px;
  border-radius: var(--radius-sm, 6px);
  font-size: 0.875rem;
  color: var(--foreground);
  position: relative;
  min-height: 44px;
}

.day-number {
  position: absolute;
  top: 4px;
  left: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.day-count {
  position: absolute;
  right: 4px;
  bottom: 4px;
  font-size: 0.5625rem;
  font-weight: 500;
  border: 1px solid var(--card);
  border-radius: 4px;
  padding: 0 4px;
  line-height: 1.4;
}

.day.empty {
  color: var(--calendar-empty);
}

.day.mid {
  background: var(--calendar-mid);
  color: white;
  font-weight: 700;
}

.day.high {
  background: var(--calendar-high);
  color: white;
  font-weight: 700;
}
</style>
