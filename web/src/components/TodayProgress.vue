<script setup>
import { computed } from 'vue'
import { Progress } from '@/components/ui/progress'

const props = defineProps({
  value: { type: Number, default: 0 },
  goal: { type: Number, default: 100 },
})

const percent = computed(() => {
  const val = Number(props.value) || 0
  const g = Number(props.goal) || 100
  return Math.max(0, Math.min(100, (val / g) * 100))
})
</script>

<template>
  <div
    class="flex w-full flex-col gap-1"
    role="progressbar"
    :aria-valuenow="value"
    :aria-valuemin="0"
    :aria-valuemax="goal"
    :aria-label="`${value} из ${goal}`"
  >
    <div class="flex items-center justify-between text-sm">
      <span class="font-medium text-foreground">{{ value }} / {{ goal }}</span>
    </div>
    <Progress :model-value="percent" :max="100" class="h-2.5" />
  </div>
</template>
