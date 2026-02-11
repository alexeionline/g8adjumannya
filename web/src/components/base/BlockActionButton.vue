<script setup>
defineProps({
  label: { type: String, default: '' },
  value: { type: String, default: '' },
  type: { type: String, default: 'button' },
  interactive: { type: Boolean, default: true },
})

defineEmits(['click'])
</script>

<template>
  <button
    :type="type"
    class="block-action-btn"
    :class="{ 'block-action-btn-static': !interactive }"
    :disabled="!interactive"
    @click="$emit('click')"
  >
    <span class="block-action-label">{{ label }}</span>
    <span class="block-action-value">{{ value }}</span>
  </button>
</template>

<style scoped>
.block-action-btn {
  border: 0;
  width: 100%;
  border-radius: 0.84rem;
  background: rgba(244, 249, 253, 0.94);
  padding: 0.56rem 0.63rem;
  display: grid;
  gap: 0.22rem;
  min-height: 3.2rem;
  text-align: left;
  cursor: pointer;
  transition: transform 0.16s ease, background-color 0.16s ease;
}

.block-action-btn:hover {
  transform: translateY(-1px);
  background: rgba(232, 244, 255, 0.98);
}

.block-action-btn-static {
  cursor: default;
}

.block-action-btn-static:hover {
  transform: none;
  background: rgba(244, 249, 253, 0.94);
}

.block-action-btn:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}

.block-action-label {
  font-size: 0.62rem;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.block-action-value {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--foreground-strong);
}
</style>
