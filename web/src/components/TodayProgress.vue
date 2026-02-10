<script setup>
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  goal: { type: Number, default: 100 },
})

const percent = computed(() => {
  const val = Number(props.value) || 0
  const g = Math.max(1, Number(props.goal) || 100)
  return Math.max(0, Math.min(100, (val / g) * 100))
})
</script>

<template>
  <div
    class="progress-chip"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="goal"
    :aria-label="`${value} из ${goal}`"
  >
    <div class="ring" :style="{ '--value': percent }">
      <span class="ring-value">{{ Math.round(percent) }}%</span>
    </div>
    <p class="progress-text">{{ value }} / {{ goal }}</p>
  </div>
</template>

<style scoped>
.progress-chip {
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 0.7rem;
}

.ring {
  --size: 2.6rem;
  width: var(--size);
  height: var(--size);
  border-radius: 999px;
  display: grid;
  place-items: center;
  background:
    radial-gradient(circle at center, rgba(255, 255, 255, 0.96) 58%, transparent 59%),
    conic-gradient(from -90deg, var(--accent-strong) calc(var(--value) * 1%), rgba(17, 53, 91, 0.12) 0%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

.ring-value {
  font-size: 0.57rem;
  font-weight: 700;
  color: var(--foreground-strong);
}

.progress-text {
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--foreground);
}
</style>
