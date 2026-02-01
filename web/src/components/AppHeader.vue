<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="brand">
    <div class="logo">
      <img src="/logo.png" alt="Daily Tracker logo" />
    </div>
    <h1>{{ title }}</h1>
    <p v-if="subtitle">{{ subtitle }}</p>
  </header>
</template>
