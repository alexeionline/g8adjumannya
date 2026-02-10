<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="app-header">
    <div class="brand-mark" aria-hidden="true">
      <img src="/logo.png" alt="" class="brand-mark-image" />
      <span class="brand-mark-glow" />
    </div>
    <div class="brand-copy">
      <p class="brand-kicker">Система ежедневного челленджа</p>
      <h1>{{ title }}</h1>
      <p v-if="subtitle" class="brand-subtitle">{{ subtitle }}</p>
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.9rem;
}

.brand-mark {
  position: relative;
  width: 3rem;
  height: 3rem;
  border-radius: 0.95rem;
  overflow: hidden;
  box-shadow: 0 10px 26px rgba(8, 30, 58, 0.2);
}

.brand-mark-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.brand-mark-glow {
  position: absolute;
  inset: 0;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.34), rgba(255, 255, 255, 0));
  pointer-events: none;
}

.brand-copy {
  min-width: 0;
}

.brand-kicker {
  margin: 0;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted-foreground);
}

h1 {
  margin: 0.1rem 0 0;
  font-family: var(--font-display);
  font-size: 1.45rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--foreground-strong);
}

.brand-subtitle {
  margin: 0.24rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.8rem;
}
</style>
