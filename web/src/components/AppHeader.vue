<template>
  <header class="app-header">
    <div class="hero-image" role="img" aria-label="Фоновое изображение челленджа">
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
