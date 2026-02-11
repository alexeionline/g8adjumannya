<script setup>
defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: '' },
})
</script>

<template>
  <header class="app-header">
    <div class="hero-image" role="img" aria-label="Фоновое изображение челленджа">
      <div class="hero-copy-wrap">
        <div class="hero-brand" aria-hidden="true">
          <img src="/logo.png" alt="" class="hero-brand-image" />
        </div>
        <div class="hero-copy">
          <p class="brand-kicker">Система ежедневного челленджа</p>
          <h1>{{ title }}</h1>
          <p v-if="subtitle" class="brand-subtitle">{{ subtitle }}</p>
        </div>
      </div>
      <div class="hero-scrim" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  margin-left: calc(var(--edge-gutter, 0.85rem) * -1);
  margin-right: calc(var(--edge-gutter, 0.85rem) * -1);
  margin-bottom: -0.35rem;
  z-index: 0;
}

.hero-image {
  position: relative;
  min-height: 14.2rem;
  border-radius: 0 0 1.4rem 1.4rem;
  overflow: hidden;
  background-image: url('/background.png');
  background-size: cover;
  background-position: center;
}

.hero-copy-wrap {
  position: absolute;
  inset: auto 0 0 0;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 0.82rem;
  padding: 0 0 1rem 0;
  width: min(458px, 100%);
  margin: 0 auto;
}

.hero-copy {
  min-width: 0;
}

.hero-brand {
  width: 3.18rem;
  height: 3.18rem;
  border-radius: 1rem;
  overflow: hidden;
  box-shadow: 0 10px 22px rgba(10, 30, 52, 0.24);
  border: 2px solid rgba(255, 255, 255, 0.9);
  background: rgba(255, 255, 255, 0.9);
  flex: 0 0 auto;
}

.hero-brand-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.hero-scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(216, 237, 249, 0) 48%,
    rgba(216, 237, 249, 0.52) 76%,
    rgba(216, 237, 249, 0.92) 92%,
    rgba(216, 237, 249, 1) 100%
  );
  pointer-events: none;
}

.brand-kicker {
  margin: 0;
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(32, 57, 83, 0.9);
  text-shadow: 0 1px 2px rgba(248, 252, 255, 0.75);
}

h1 {
  margin: 0.1rem 0 0;
  font-family: var(--font-display);
  font-size: 1.1rem;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: rgba(22, 46, 74, 0.98);
  text-shadow: 0 1px 2px rgba(246, 251, 255, 0.76);
}

.brand-subtitle {
  margin: 0.14rem 0 0;
  color: rgba(45, 69, 95, 0.88);
  font-size: 0.74rem;
  text-shadow: 0 1px 2px rgba(247, 252, 255, 0.74);
}

@media (min-width: 768px) {
  .app-header {
    margin-left: 0;
    margin-right: 0;
  }

  .hero-image {
    border-radius: 1.3rem;
  }
}

@media (max-width: 420px) {
  .hero-image {
    min-height: 13rem;
  }

  .hero-copy-wrap {
    padding: 0 0 1rem 0;
    gap: 0.62rem;
  }

  .hero-brand {
    width: 2.78rem;
    height: 2.78rem;
  }

  h1 {
    font-size: 1rem;
  }
}
</style>
