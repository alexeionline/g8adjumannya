<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="text-center">
    <div class="mx-auto grid h-16 w-16 place-items-center overflow-hidden rounded-full bg-card shadow-md">
      <img src="/logo.png" alt="Daily Tracker logo" class="h-full w-full object-cover" />
    </div>
    <h1 class="mt-3 text-xl font-semibold text-foreground">
      {{ title }}
    </h1>
    <p v-if="subtitle" class="mt-1 text-sm text-muted-foreground">
      {{ subtitle }}
    </p>
  </header>
</template>
