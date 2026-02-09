<script setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

defineProps({
  items: { type: Array, default: () => [] },
})
</script>

<template>
  <Card>
    <CardHeader>
      <CardTitle>Лучшие результаты</CardTitle>
    </CardHeader>
    <CardContent>
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
    </CardContent>
  </Card>
</template>

<style scoped>
.leaderboard {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.625rem;
}

.leader-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.625rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
}

.leader-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--card-foreground);
}

.leader-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
}

.leader-right .value {
  font-weight: 600;
}

.date {
  font-size: 0.6875rem;
}

.medal {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.4);
}

.medal.gold {
  background: radial-gradient(circle at 30% 30%, #ffe69a, #f5b940);
}

.medal.silver {
  background: radial-gradient(circle at 30% 30%, #e7ecf5, #9da9ba);
}

.medal.bronze {
  background: radial-gradient(circle at 30% 30%, #f2c7a0, #c07c45);
}

.rank {
  width: 22px;
  text-align: center;
  color: var(--muted-foreground);
}
</style>
