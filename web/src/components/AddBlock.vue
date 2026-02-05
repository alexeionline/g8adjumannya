<script setup>
defineProps({
  userInput: { type: String, default: '' },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])
</script>

<template>
  <section class="card add-block">
    <div class="input-row">
      <input
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="Добавить кол-во"
        min="1"
        max="1000"
        :value="userInput"
        @input="emit('update:userInput', $event.target.value)"
      />
      <button type="button" @click="onSubmit">Добавить</button>
    </div>
  </section>
</template>

<style scoped>
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
  background: #2386cb;
  color: #ffffff;
  border: none;
  border-radius: 10px;
  padding: 8px 16px;
}
</style>
