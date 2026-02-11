<script setup>
import { onBeforeUnmount, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AppActionButton from '@/components/base/AppActionButton.vue'
import { Input } from '@/components/ui/input'

const props = defineProps({
  userInput: { type: String, default: '' },
  onQuickAdd: { type: Function, default: null },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])

const quickAdds = [5, 10, 15, 20, 25, 30]
const actionsLocked = ref(false)
const overlayVisible = ref(false)
const overlayText = ref('')
let hideTimer = null

function showOverlay() {
  overlayVisible.value = true
  overlayText.value = ''
  actionsLocked.value = true
}

function hideOverlay() {
  overlayVisible.value = false
  overlayText.value = ''
  actionsLocked.value = false
}

function resolveOverlayWithDelay(text) {
  overlayText.value = text
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    hideOverlay()
    hideTimer = null
  }, 3_000)
}

async function runAddAction(action, value) {
  showOverlay()
  const ok = await action()
  if (ok) {
    resolveOverlayWithDelay(`Добавлен подход: ${value}!\nОтличная работа!`)
    return
  }
  resolveOverlayWithDelay('Не удалось добавить подход')
}

async function handleSubmitClick() {
  if (actionsLocked.value) return
  const value = Number(props.userInput)
  await runAddAction(props.onSubmit, value)
}

async function handleQuickAddClick(value) {
  if (actionsLocked.value || !props.onQuickAdd) return
  await runAddAction(() => props.onQuickAdd(value), value)
}

onBeforeUnmount(() => {
  if (hideTimer) clearTimeout(hideTimer)
  if (overlayVisible.value) {
    overlayVisible.value = false
    overlayText.value = ''
    actionsLocked.value = false
  }
})
</script>

<template>
  <Card class="add-block-card">
    <transition name="overlay-fade">
      <div v-if="overlayVisible" class="add-overlay" role="status" aria-live="polite">
        <span class="add-overlay-text">{{ overlayText }}</span>
      </div>
    </transition>

    <CardHeader class="add-block-header">
      <CardTitle class="add-block-title">Быстрое добавление</CardTitle>
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
          @keydown.enter.prevent="handleSubmitClick"
        />
        <AppActionButton
          type="button"
          variant="primary"
          class="add-submit"
          :disabled="actionsLocked"
          @click="handleSubmitClick"
        >
          Добавить
        </AppActionButton>
      </div>

      <div class="quick-row" role="group" aria-label="Быстрые значения">
        <AppActionButton
          v-for="value in quickAdds"
          :key="value"
          variant="chip"
          size="md"
          class="quick-add-btn"
          :disabled="actionsLocked"
          @click="handleQuickAddClick(value)"
        >
          +{{ value }}
        </AppActionButton>
      </div>

    </CardContent>
  </Card>
</template>

<style scoped>
.add-block-card {
  position: relative;
  overflow: hidden;
  border: 0;
  background: linear-gradient(152deg, rgba(255, 255, 255, 0.94), rgba(255, 255, 255, 0.86));
  box-shadow: var(--shadow-soft);
}

.add-block-header {
  padding-bottom: 0.3rem;
}

.add-block-title {
  font-family: var(--font-display);
  letter-spacing: -0.02em;
  color: var(--foreground-strong);
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
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
  margin-top: 0.7rem;
  width: 100%;
}

.quick-row .app-action-btn {
  width: 100%;
  justify-content: center;
}

.quick-add-btn {
  background: #00bbef;
  color: #fff;
}

.quick-add-btn:hover {
  background: color-mix(in oklab, #00bbef 86%, white 14%);
}

.add-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  border-radius: inherit;
  background: rgba(216, 237, 249, 0.94);
  backdrop-filter: blur(1px);
  z-index: 3;
}

.add-overlay-text {
  display: inline-flex;
  align-items: center;
  gap: 0.42rem;
  padding: 0 0.6rem;
  font-size: 1.08rem;
  font-weight: 400;
  line-height: 1.35;
  color: var(--muted-foreground);
  text-align: center;
  white-space: pre-line;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.35);
}


.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

</style>
