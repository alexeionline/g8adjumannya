<script setup>
import { computed } from 'vue'

const props = defineProps({
  active: { type: Boolean, default: false },
  variant: { type: String, default: 'leader' }, // leader | filter
})

const className = computed(() => [
  'app-tab-btn',
  `app-tab-btn-${props.variant}`,
  props.active ? 'app-tab-btn-active' : '',
])
</script>

<template>
  <button type="button" :class="className">
    <slot />
  </button>
</template>

<style scoped>
.app-tab-btn {
  font: inherit;
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease, transform 0.2s ease;
}

.app-tab-btn:hover {
  transform: translateY(-1px);
}

.app-tab-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.app-tab-btn-leader {
  border: 1px solid rgba(16, 49, 87, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--foreground-strong);
  padding: 0.2rem 0.62rem;
  font-size: 0.73rem;
  font-weight: 700;
}

.app-tab-btn-leader.app-tab-btn-active {
  border-color: rgba(14, 165, 233, 0.52);
  background: linear-gradient(145deg, rgba(234, 247, 255, 0.98), rgba(215, 238, 255, 0.92));
}

.app-tab-btn-filter {
  border: 1px solid rgba(20, 58, 95, 0.14);
  background: rgba(243, 248, 253, 0.94);
  color: var(--foreground);
  border-radius: 999px;
  padding: 0.25rem 0.62rem;
  font-size: 0.7rem;
  font-weight: 600;
}

.app-tab-btn-filter.app-tab-btn-active {
  background: linear-gradient(120deg, rgba(14, 165, 233, 0.16), rgba(59, 130, 246, 0.2));
  border-color: rgba(14, 165, 233, 0.35);
}
</style>
