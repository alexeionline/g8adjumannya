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
    <h2>Today's Results</h2>
    <div class="divider"></div>
    <ul class="list">
      <li v-for="item in items" :key="item.key">
        <span>{{ item.label }}</span>
        <span>{{ item.value }}</span>
      </li>
    </ul>
    <div class="input-row">
      <input
        type="text"
        placeholder="Enter user_id..."
        :value="userInput"
        @input="emit('update:userInput', $event.target.value)"
      />
      <button type="button" @click="onSubmit">Add</button>
    </div>
  </section>
</template>
