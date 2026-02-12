<script setup>
function closeWebApp() {
  const tg = window.Telegram?.WebApp
  if (tg && typeof tg.close === 'function') {
    tg.close()
    return
  }
  window.close()
}
</script>

<template>
  <header class="app-header">
    <div class="hero-image" role="img" aria-label="Фоновое изображение челленджа">
      <button type="button" class="app-close-btn" aria-label="Закрыть приложение" @click="closeWebApp">
        ✕
      </button>
      <div class="hero-scrim" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  position: relative;
  margin-bottom: -0.35rem;
  z-index: 0;
}

.hero-image {
  position: relative;
  min-height: 14.2rem;
  overflow: hidden;
  background-image: url('/background.png');
  background-image: image-set(
    url('/background.avif') type('image/avif'),
    url('/background.webp') type('image/webp'),
    url('/background.png') type('image/png')
  );
  background-size: cover;
  background-position: center;
}

.app-close-btn {
  position: absolute;
  top: 0.7rem;
  right: 0.75rem;
  z-index: 4;
  width: 2rem;
  height: 2rem;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: rgba(19, 45, 70, 0.9);
  font-size: 1rem;
  font-weight: 700;
  line-height: 1;
  display: grid;
  place-items: center;
  cursor: pointer;
}

.app-close-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
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
}
</style>
