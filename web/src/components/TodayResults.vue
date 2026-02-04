<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  userInput: { type: String, default: '' },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])

const GOAL = 100

function fillHeight(value) {
  const numeric = Number(value) || 0
  const percent = Math.max(0, Math.min(100, (numeric / GOAL) * 100))
  return `${percent}%`
}
</script>

<template>
  <section class="card">
    <h2>Сегодня</h2>
    <div class="divider"></div>
    <ul class="today-list">
      <li
        v-for="item in items"
        :key="item.key"
        :class="{ 'result-done': item.value >= GOAL, 'result-pending': item.value < GOAL }"
        class="today-row"
      >
        <div class="today-left">
          <div class="today-glass">
            <div class="today-glass-fill" :style="{ height: fillHeight(item.value) }"></div>
            <span class="today-glass-number">{{ item.value }}</span>
          </div>
        </div>
        <div class="today-right">
          <div class="today-username">{{ item.label }}</div>
          <div class="today-approaches">
            <span
              v-for="(cnt, i) in item.approaches"
              :key="i"
              class="today-approach-square"
              :title="`${cnt}`"
            >{{ cnt }}</span>
          </div>
        </div>
      </li>
    </ul>
    <div class="divider"></div>
    <div class="input-row">
      <input
        type="text"
        placeholder="Добавить кол-во"
        :value="userInput"
        @input="emit('update:userInput', $event.target.value)"
      />
      <button type="button" @click="onSubmit">Add</button>
    </div>
  </section>
</template>

<style scoped>
.today-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.today-row {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 12px;
  align-items: stretch;
  min-height: 80px;
}

.today-left {
  display: flex;
  align-items: stretch;
}

.today-glass {
  position: relative;
  width: 100%;
  min-height: 72px;
  border-radius: 8px 8px 4px 4px;
  background: #f0f2f6;
  border: 1px solid #cfd7e6;
  box-shadow: inset 0 -2px 8px rgba(15, 23, 42, 0.06);
  overflow: hidden;
}

.today-glass-fill {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 0 0 4px 4px;
  transition: height 0.35s ease-out;
  background: #22c55e;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

.today-glass-number {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: #1f2a44;
  text-shadow: 0 0 2px #fff, 0 1px 2px #fff;
}

.today-right {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.today-username {
  text-align: center;
  font-weight: 600;
  font-size: 15px;
  color: #1f2a44;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.today-approaches {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  align-items: center;
}

.today-approach-square {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 4px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  background: #e5e7eb;
  border: 1px solid #d1d5db;
}

.result-done .today-approach-square {
  background: #dcfce7;
  border-color: #86efac;
  color: #166534;
}

.result-pending .today-approach-square {
  background: #fffbeb;
  border-color: #fde68a;
  color: #92400e;
}

.input-row {
  display: flex;
  gap: 8px;
}

.input-row input {
  flex: 1;
  border: 1px solid #d7dee9;
  border-radius: 10px;
  padding: 8px 12px;
}

.input-row button {
  background: #5b7fd1;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
}
</style>
