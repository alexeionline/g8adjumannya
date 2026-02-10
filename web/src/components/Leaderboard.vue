<script setup>
import { computed, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const showAll = ref(false)
const TOP_LIMIT = 5

const displayedItems = computed(() =>
  showAll.value ? props.items || [] : (props.items || []).slice(0, TOP_LIMIT)
)
</script>

<template>
  <Card class="leader-card">
    <CardHeader class="leader-header">
      <CardTitle>Рекорды</CardTitle>
      <p class="leader-sub">Лучший разовый подход в этом чате</p>
    </CardHeader>
    <CardContent>
      <template v-if="items.length">
        <ul class="leaderboard">
          <li v-for="item in displayedItems" :key="item.key" class="leader-item">
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
        <div v-if="items.length > TOP_LIMIT" class="show-more-wrap">
          <Button type="button" size="sm" class="show-more-btn" @click="showAll = !showAll">
            {{ showAll ? 'Свернуть' : 'Показать всех' }}
          </Button>
        </div>
      </template>
      <div v-else class="leader-empty">Пока нет рекордов</div>
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

.show-more-wrap {
  margin-top: 0.7rem;
  display: flex;
  justify-content: center;
}

.show-more-btn {
  min-width: 9rem;
  border-radius: 999px;
  border: 1px solid rgba(10, 88, 156, 0.26);
  background: linear-gradient(145deg, rgba(239, 249, 255, 0.96), rgba(223, 241, 255, 0.94));
  color: color-mix(in oklab, var(--foreground-strong) 85%, #0ea5e9 15%);
  font-weight: 700;
  letter-spacing: 0.01em;
  box-shadow: 0 8px 18px rgba(14, 165, 233, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
}

.show-more-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(14, 165, 233, 0.18);
  background: linear-gradient(145deg, rgba(226, 245, 255, 0.98), rgba(203, 233, 255, 0.94));
}
</style>
