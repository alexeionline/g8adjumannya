<script setup>
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const props = defineProps({
  userInput: { type: String, default: '' },
  targetValue: { type: Number, default: 100 },
  currentTotal: { type: Number, default: 0 },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])

const quickAdds = [10, 20, 25, 30]

const completion = computed(() => {
  const target = Math.max(1, Number(props.targetValue) || 100)
  return Math.max(0, Math.min(100, Math.round((Number(props.currentTotal || 0) / target) * 100)))
})
</script>

<template>
  <Card class="add-block-card">
    <CardHeader class="add-block-header">
      <CardTitle class="add-block-title">Быстрое добавление</CardTitle>
      <p class="add-block-meta">{{ currentTotal }} / {{ targetValue || 100 }} за сегодня</p>
    </CardHeader>
    <CardContent class="add-block-content">
      <div class="add-row">
        <Input
          type="number"
          inputmode="numeric"
          pattern="[0-9]*"
          placeholder="Количество"
          min="1"
          max="1000"
          :model-value="userInput"
          @update:model-value="emit('update:userInput', $event)"
          class="add-input"
          @keydown.enter.prevent="onSubmit"
        />
        <Button type="button" class="add-submit" @click="onSubmit">
          Добавить
        </Button>
      </div>

      <div class="quick-row" role="group" aria-label="Быстрые значения">
        <button
          v-for="value in quickAdds"
          :key="value"
          type="button"
          class="quick-pill"
          @click="emit('update:userInput', String(value))"
        >
          +{{ value }}
        </button>
      </div>

      <div class="meter" aria-hidden="true">
        <span class="meter-fill" :style="{ width: `${completion}%` }" />
      </div>
    </CardContent>
  </Card>
</template>

<style scoped>
.add-block-card {
  border: 0;
  background: linear-gradient(152deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.86));
  box-shadow: var(--shadow-soft);
}

.add-block-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.75rem;
  padding-bottom: 0.3rem;
}

.add-block-title {
  font-size: 0.86rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

.add-block-meta {
  margin: 0;
  font-size: 0.86rem;
  color: var(--foreground-strong);
  font-weight: 600;
}

.add-block-content {
  display: grid;
  gap: 0.75rem;
}

.add-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.55rem;
}

.add-submit {
  min-width: 5.5rem;
}

.quick-row {
  display: flex;
  gap: 0.45rem;
  flex-wrap: wrap;
}

.quick-pill {
  border: 0;
  border-radius: 999px;
  padding: 0.38rem 0.72rem;
  min-height: 2rem;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--foreground);
  background: rgba(13, 153, 255, 0.11);
  transition: transform 0.2s ease, background-color 0.2s ease;
}

.quick-pill:hover {
  transform: translateY(-1px);
  background: rgba(13, 153, 255, 0.17);
}

.quick-pill:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.meter {
  height: 0.34rem;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(17, 53, 91, 0.08);
}

.meter-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-strong), #36d6ff);
  transition: width 0.3s ease;
}
</style>
