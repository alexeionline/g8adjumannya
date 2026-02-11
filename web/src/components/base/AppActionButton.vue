<script setup>
import { computed } from 'vue'

const props = defineProps({
  type: { type: String, default: 'button' },
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  disabled: { type: Boolean, default: false },
})

const className = computed(() => [
  'app-action-btn',
  `app-action-btn-${props.variant}`,
  `app-action-btn-${props.size}`,
])
</script>

<template>
  <button :type="type" :class="className" :disabled="disabled">
    <slot />
  </button>
</template>

<style scoped>
.app-action-btn {
  border: 0;
  font: inherit;
  color: #fff;
  background: #008ccf;
  border-radius: 0.7rem;
  cursor: pointer;
  transition: transform 0.18s ease, background-color 0.18s ease, color 0.18s ease, border-color 0.18s ease;
}

.app-action-btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
  transform: none !important;
}

.app-action-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.app-action-btn-md {
  min-height: 2.2rem;
  padding: 0.42rem 0.82rem;
  font-size: 0.82rem;
  font-weight: 700;
}

.app-action-btn-sm {
  min-height: 1.9rem;
  padding: 0.26rem 0.62rem;
  font-size: 0.74rem;
  font-weight: 700;
}

.app-action-btn-primary {
  color: #fff;
  background: #008ccf;
}

.app-action-btn-primary:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, #008ccf 88%, white 12%);
}

.app-action-btn-outline {
  color: #fff;
  background: #008ccf;
  border: 0;
}

.app-action-btn-outline:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, #008ccf 88%, white 12%);
}

.app-action-btn-danger {
  color: #fff;
  background: #008ccf;
}

.app-action-btn-danger:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, #008ccf 82%, black 18%);
}

.app-action-btn-chip {
  color: #fff;
  background: #008ccf;
  min-height: 2rem;
  padding: 0.38rem 0.72rem;
  font-size: 0.78rem;
  font-weight: 600;
}

.app-action-btn-chip:hover {
  transform: translateY(-1px);
  background: color-mix(in oklab, #008ccf 88%, white 12%);
}

.app-action-btn-subtle {
  color: #fff;
  border: 0;
  background: #008ccf;
  box-shadow: none;
}

.app-action-btn-subtle:hover {
  transform: translateY(-1px);
  box-shadow: none;
  background: color-mix(in oklab, #008ccf 88%, white 12%);
}
</style>
