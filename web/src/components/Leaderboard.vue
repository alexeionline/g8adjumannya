<script setup>
import { computed, ref, watch } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const props = defineProps({
  items: { type: Array, default: () => [] },
})

const tabs = [
  { id: 'approach', label: 'Подход', subtitle: 'Лучший разовый подход в этом чате', empty: 'Пока нет рекордов по подходу' },
  { id: 'day', label: 'День', subtitle: 'Лучший дневной результат в этом чате', empty: 'Пока нет рекордов по дням' },
  { id: 'total', label: 'Всего', subtitle: 'Больше всего повторений за всё время', empty: 'Пока нет суммарных рекордов' },
]

const activeTab = ref('approach')
const showAll = ref(false)
const TOP_LIMIT = 5

const activeMeta = computed(() => tabs.find((tab) => tab.id === activeTab.value) || tabs[0])

const rankedItems = computed(() => {
  const valuesByTab = {
    approach: { valueKey: 'bestApproach', dateKey: 'bestApproachDate' },
    day: { valueKey: 'bestDay', dateKey: 'bestDayDate' },
    total: { valueKey: 'totalAll', dateKey: '' },
  }

  const keys = valuesByTab[activeTab.value] || valuesByTab.approach
  return (props.items || [])
    .map((item) => ({
      key: item.key,
      label: item.label,
      value: Number(item[keys.valueKey] || 0),
      date: keys.dateKey ? String(item[keys.dateKey] || '') : '',
      joinedAtLabel: String(item.joinedAtLabel || ''),
      challengeDays: Number(item.challengeDays || 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value || String(a.label).localeCompare(String(b.label), 'ru'))
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }))
})

function formatDaysLabel(days) {
  const value = Number(days || 0)
  if (!value) return ''
  const mod10 = value % 10
  const mod100 = value % 100
  if (mod10 === 1 && mod100 !== 11) return `${value} день`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${value} дня`
  return `${value} дней`
}

function formatSpeed(value, days) {
  const total = Number(value || 0)
  const spanDays = Number(days || 0)
  if (!spanDays || !Number.isFinite(total)) return ''
  return `${Math.round(total / spanDays)} в день`
}

const displayedItems = computed(() => (showAll.value ? rankedItems.value : rankedItems.value.slice(0, TOP_LIMIT)))

watch(activeTab, () => {
  showAll.value = false
})
</script>

<template>
  <Card class="leader-card">
    <CardHeader class="leader-header">
      <CardTitle>Рекорды</CardTitle>
      <p class="leader-sub">{{ activeMeta.subtitle }}</p>
      <div class="leader-tabs" role="tablist" aria-label="Режим рекордов">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          type="button"
          class="leader-tab"
          :class="{ 'leader-tab-active': activeTab === tab.id }"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>
    </CardHeader>
    <CardContent>
      <template v-if="rankedItems.length">
        <ul class="leaderboard">
          <li v-for="item in displayedItems" :key="item.key" class="leader-item">
            <div class="leader-left">
              <span class="rank" :class="`rank-${Math.min(item.rank, 3)}`">{{ item.rank }}</span>
              <div>
                <p class="name">{{ item.label }}</p>
                <p v-if="activeTab === 'total' && item.joinedAtLabel" class="date">
                  с {{ item.joinedAtLabel }}
                  <span v-if="item.challengeDays > 0">({{ formatDaysLabel(item.challengeDays) }})</span>
                </p>
                <p v-if="item.date" class="date">{{ item.date }}</p>
              </div>
            </div>
            <div class="value-wrap">
              <div class="value">{{ item.value }}</div>
              <div v-if="activeTab === 'total' && item.challengeDays > 0" class="value-sub">
                {{ formatSpeed(item.value, item.challengeDays) }}
              </div>
            </div>
          </li>
        </ul>
        <div v-if="rankedItems.length > TOP_LIMIT" class="show-more-wrap">
          <Button type="button" size="sm" class="show-more-btn" @click="showAll = !showAll">
            {{ showAll ? 'Свернуть' : 'Показать всех' }}
          </Button>
        </div>
      </template>
      <div v-else class="leader-empty">{{ activeMeta.empty }}</div>
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

.leader-tabs {
  margin-top: 0.55rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.leader-tab {
  border: 1px solid rgba(16, 49, 87, 0.14);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.86);
  color: var(--foreground-strong);
  padding: 0.2rem 0.62rem;
  font-size: 0.73rem;
  font-weight: 700;
  cursor: pointer;
  transition: background-color 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
}

.leader-tab:hover {
  transform: translateY(-1px);
}

.leader-tab-active {
  border-color: rgba(14, 165, 233, 0.52);
  background: linear-gradient(145deg, rgba(234, 247, 255, 0.98), rgba(215, 238, 255, 0.92));
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

.value-wrap {
  display: grid;
  justify-items: end;
}

.value-sub {
  margin-top: 0.08rem;
  font-size: 0.66rem;
  color: var(--muted-foreground);
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
