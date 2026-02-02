<script setup>
defineProps({
  items: { type: Array, default: () => [] },
  userInput: { type: String, default: '' },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])
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
        <span>{{ item.label }}</span>
        <span>{{ item.value }}</span>
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
