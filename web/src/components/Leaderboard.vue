<script setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

defineProps({
  items: { type: Array, default: () => [] },
})

function rankVariant(rank) {
  if (rank === 1) return 'default'
  if (rank === 2) return 'secondary'
  return 'outline'
}
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
            <Badge :variant="rankVariant(item.rank)" class="rank-badge">
              {{ item.rank }}
            </Badge>
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
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.leader-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--card-foreground);
  min-width: 0;
}

.rank-badge {
  flex-shrink: 0;
  min-width: 1.5rem;
  justify-content: center;
}

.name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.leader-right {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
  color: var(--muted-foreground);
  flex-shrink: 0;
}

.leader-right .value {
  font-weight: 600;
}

.date {
  font-size: 0.6875rem;
}
</style>
