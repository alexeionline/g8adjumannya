<script setup>
defineProps({
  items: { type: Array, default: () => [] },
})
</script>

<template>
  <section class="card">
    <h2>Лучшие результаты</h2>
    <ul class="leaderboard">
      <li v-for="item in items" :key="item.key" class="leader-item">
        <div class="leader-left">
          <span v-if="item.medal" :class="['medal', item.medal]"></span>
          <span v-else class="rank">{{ item.rank }}.</span>
          <span class="name">{{ item.label }}</span>
        </div>
        <div class="leader-right">
          <span class="value">{{ item.value }}</span>
          <span class="date">{{ item.date }}</span>
        </div>
      </li>
    </ul>
  </section>
</template>

<style scoped>
h2 {
  margin-bottom: 16px;
}

.date {
  color: #6b7280;
  font-size: 11px;
}
</style>
