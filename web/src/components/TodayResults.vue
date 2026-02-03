<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  userInput: { type: String, default: '' },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])

function progressWidth(value) {
  const numeric = Number(value) || 0
  const percent = Math.max(0, Math.min(100, numeric))
  return `${percent}%`
}
</script>

<template>
  <section class="card">
    <h2>Сегодня</h2>
    <div class="divider"></div>
    <ul class="list">
      <li
        v-for="item in items"
        :key="item.key"
        :class="{ 'result-done': item.value >= 100, 'result-pending': item.value < 100 }"
      >
        <div class="today-bar">
          <div class="today-bar-fill" :style="{ width: progressWidth(item.value) }"></div>
          <span class="today-count">{{ item.value }}</span>
          <span class="today-name">{{ item.label }}</span>
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
