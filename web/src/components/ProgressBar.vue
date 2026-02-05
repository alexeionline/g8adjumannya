<script setup>
const props = defineProps({
  /** Текущее значение (отжимания за день) */
  value: { type: Number, default: 0 },
  /** Цель (по умолчанию 100) */
  goal: { type: Number, default: 100 },
})

function fillPercent() {
  const val = Number(props.value) || 0
  const g = Number(props.goal) || 100
  return Math.max(0, Math.min(100, (val / g) * 100))
}

function fillHeight() {
  const pct = fillPercent()
  return pct >= 100 ? 'calc(100% - 6px)' : `${pct}%`
}
</script>

<template>
  <div class="progress-glass">
    <div
      class="progress-glass-fill"
      :style="{ height: fillHeight() }"
    ></div>
    <span class="progress-glass-number">{{ value }}</span>
  </div>
</template>

<style scoped>
.progress-glass {
  position: relative;
  width: 100%;
  min-height: 72px;
  border: 3px solid #b5cae9;
  border-radius: 9px;
  background: #f0f2f6;
  box-shadow: inset 0 -2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.progress-glass::after {
  content: '';
  position: absolute;
  left: 10px;
  top: 0;
  bottom: 0;
  width: 8px;
  background: #fff;
  opacity: 0.35;
  z-index: 0;
}

/* Внутренний отступ 3px: заливка и число не доходят до бордера */
.progress-glass-fill {
  position: absolute;
  left: 3px;
  right: 3px;
  bottom: 3px;
  border-radius: 6px;
  transition: height 0.35s ease-out;
  background: linear-gradient(to right, #2cc0ec, #2386cb);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.progress-glass-number {
  position: absolute;
  left: 3px;
  right: 3px;
  top: 10px;
  z-index: 2;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #1f2a44;
  text-shadow: 0 0 2px #fff, 0 1px 2px #fff;
}
</style>
