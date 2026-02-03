<script setup>
defineProps({
  monthLabel: { type: String, required: true },
  days: { type: Array, default: () => [] },
  onPrev: { type: Function, required: true },
  onNext: { type: Function, required: true },
})
</script>

<template>
  <section class="calendar">
    <div class="calendar-header">
      <button type="button" class="icon" @click="onPrev">&lsaquo;</button>
      <span>{{ monthLabel }}</span>
      <button type="button" class="icon" @click="onNext">&rsaquo;</button>
    </div>
    <div class="calendar-grid">
      <div class="weekday">M</div>
      <div class="weekday">T</div>
      <div class="weekday">W</div>
      <div class="weekday">T</div>
      <div class="weekday">F</div>
      <div class="weekday">S</div>
      <div class="weekday">S</div>

      <div v-for="day in days" :key="day.key" :class="['day', day.tone]">
        <template v-if="day.value">
          <span class="day-number">{{ day.value }}</span>
          <span v-if="day.count > 0" class="day-count">{{ day.count }}</span>
        </template>
      </div>
    </div>
  </section>
</template>
