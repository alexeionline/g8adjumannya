<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
})

const className = computed(() => [
  'app-action-btn',
  `app-action-btn-${props.variant}`,
  `app-action-btn-${props.size}`,
])
</script>

<template>
  <button :type="type" :class="className">
    <slot />
  </button>
</template>

<style scoped>
.app-action-btn {
  border: 0;
  font: inherit;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.app-action-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.app-action-btn-md {
  min-height: 2.2rem;
  padding: 0.42rem 0.82rem;
  border-radius: 0.72rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.app-action-btn-sm {
  min-height: 1.9rem;
  padding: 0.26rem 0.62rem;
  border-radius: 0.66rem;
  font-size: 0.74rem;
  font-weight: 700;
}

.app-action-btn-primary {
  color: var(--primary-foreground);
  background: color-mix(in oklab, var(--primary) 92%, white 8%);
}

.app-action-btn-primary:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--primary) 84%, white 16%);
}

.app-action-btn-outline {
  color: var(--foreground-strong);
  background: rgba(255, 255, 255, 0.94);
  border: 1px solid rgba(17, 53, 91, 0.18);
}

.app-action-btn-outline:hover {
  transform: translateY(-1px);
  background: rgba(246, 251, 255, 0.98);
}

.app-action-btn-danger {
  color: #fff;
  background: color-mix(in oklab, var(--destructive) 88%, black 12%);
}

.app-action-btn-danger:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, var(--destructive) 78%, black 22%);
}

.app-action-btn-chip {
  color: var(--foreground);
  background: rgba(13, 153, 255, 0.11);
  border-radius: 999px;
  min-height: 2rem;
  padding: 0.38rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.app-action-btn-chip:hover {
  transform: translateY(-1px);
  background: rgba(13, 153, 255, 0.17);
}

.app-action-btn-subtle {
  color: color-mix(in oklab, var(--foreground-strong) 85%, #0ea5e9 15%);
  border: 1px solid rgba(10, 88, 156, 0.26);
  border-radius: 999px;
  background: linear-gradient(145deg, rgba(239, 249, 255, 0.96), rgba(223, 241, 255, 0.94));
  box-shadow: 0 8px 18px rgba(14, 165, 233, 0.12);
}

.app-action-btn-subtle:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(14, 165, 233, 0.18);
  background: linear-gradient(145deg, rgba(226, 245, 255, 0.98), rgba(203, 233, 255, 0.94));
}
</style>
