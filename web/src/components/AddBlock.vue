<script setup>
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

defineProps({
  userInput: { type: String, default: '' },
  onSubmit: { type: Function, required: true },
})

const emit = defineEmits(['update:userInput'])
</script>

<template>
  <Card>
    <CardContent class="flex flex-row gap-2 pt-6">
      <Input
        type="number"
        inputmode="numeric"
        pattern="[0-9]*"
        placeholder="Добавить кол-во"
        min="1"
        max="1000"
        :model-value="userInput"
        @update:model-value="emit('update:userInput', $event)"
        class="flex-1"
      />
      <Button type="button" @click="onSubmit">
        Добавить
      </Button>
    </CardContent>
  </Card>
</template>
