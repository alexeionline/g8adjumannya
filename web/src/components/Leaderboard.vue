<script setup>
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

defineProps({
  items: { type: Array, default: () => [] },
})
</script>

<template>
  <Card class="leader-card">
    <CardHeader class="leader-header">
      <CardTitle>Records</CardTitle>
      <p class="leader-sub">Best single set in this chat</p>
    </CardHeader>
    <CardContent>
      <ul v-if="items.length" class="leaderboard">
        <li v-for="item in items" :key="item.key" class="leader-item">
          <div class="leader-left">
            <span class="rank" :class="`rank-${Math.min(item.rank, 3)}`">{{ item.rank }}</span>
            <div>
              <p class="name">{{ item.label }}</p>
              <p class="date">{{ item.date }}</p>
            </div>
          </div>
          <div class="value">{{ item.value }}</div>
        </li>
      </ul>
      <div v-else class="leader-empty">No records yet</div>
    </CardContent>
  </Card>
</template>

<style scoped>
.leader-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.leader-header {
  padding-bottom: 0.2rem;
}

.leader-sub {
  margin: 0.25rem 0 0;
  font-size: 0.8rem;
  color: var(--muted-foreground);
}

.leaderboard {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.55rem;
}

.leader-item {
  border-radius: 0.9rem;
  background: rgba(242, 247, 252, 0.9);
  padding: 0.62rem 0.72rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.leader-left {
  display: flex;
  align-items: center;
  gap: 0.58rem;
  min-width: 0;
}

.rank {
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--foreground-strong);
  background: rgba(16, 49, 87, 0.12);
}

.rank-1 {
  background: rgba(254, 203, 84, 0.45);
}

.rank-2 {
  background: rgba(199, 210, 222, 0.66);
}

.rank-3 {
  background: rgba(255, 191, 145, 0.6);
}

.name {
  margin: 0;
  font-size: 0.83rem;
  font-weight: 700;
  color: var(--foreground-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.date {
  margin: 0.1rem 0 0;
  color: var(--muted-foreground);
  font-size: 0.69rem;
}

.value {
  font-size: 0.98rem;
  font-weight: 800;
  color: var(--foreground-strong);
}

.leader-empty {
  text-align: center;
  font-size: 0.84rem;
  color: var(--muted-foreground);
  padding: 0.7rem;
}
</style>
