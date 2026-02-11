<script setup>
import { computed, ref } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import AppTabButton from '@/components/base/AppTabButton.vue'
import { buildBadgesMetrics, buildChallengeBadges } from '@/lib/badges'

const props = defineProps({
  historyDays: {
    type: Object,
    default: () => ({}),
  },
  bestApproach: {
    type: Number,
    default: 0,
  },
})

const metrics = computed(() => {
  return buildBadgesMetrics(props.historyDays, props.bestApproach)
})

const badges = computed(() => {
  return buildChallengeBadges(metrics.value)
})

const unlockedCount = computed(() => badges.value.filter((item) => item.achieved).length)
const filter = ref('all')
const filteredBadges = computed(() => {
  if (filter.value === 'done') return badges.value.filter((item) => item.achieved)
  if (filter.value === 'open') return badges.value.filter((item) => !item.achieved)
  return badges.value
})

function badgeToneClass(tone) {
  return {
    calm: 'tone-calm',
    sport: 'tone-sport',
    punch: 'tone-punch',
    total: 'tone-total',
    legend: 'tone-legend',
  }[tone] || 'tone-calm'
}
</script>

<template>
  <Card class="badges-card">
    <CardHeader class="badges-header">
      <div>
        <CardTitle>Бейджи челленджа</CardTitle>
        <p class="badges-sub">Открыто {{ unlockedCount }} из {{ badges.length }} бейджей</p>
      </div>
      <div class="badges-filters" role="tablist" aria-label="Фильтр наград">
        <AppTabButton variant="filter" :active="filter === 'all'" @click="filter = 'all'">
          Все
        </AppTabButton>
        <AppTabButton variant="filter" :active="filter === 'done'" @click="filter = 'done'">
          Завершенные
        </AppTabButton>
        <AppTabButton variant="filter" :active="filter === 'open'" @click="filter = 'open'">
          Открытые
        </AppTabButton>
      </div>
    </CardHeader>
    <CardContent>
      <ul v-if="filteredBadges.length" class="badges-grid">
        <li
          v-for="badge in filteredBadges"
          :key="badge.id"
          class="badge-item"
          :class="[
            badge.achieved ? 'badge-item-unlocked' : 'badge-item-locked',
            badgeToneClass(badge.tone),
          ]"
        >
          <div class="badge-medal" :aria-label="badge.title">
            <svg
              v-if="badge.achieved"
              viewBox="0 0 24 24"
              class="badge-icon badge-icon-trophy"
              aria-hidden="true"
            >
              <path
                d="M8 4h8v2a4 4 0 0 0 4 4h1a4 4 0 0 1-4 4 5 5 0 0 1-4 3.87V20h3v2H8v-2h3v-2.13A5 5 0 0 1 7 14a4 4 0 0 1-4-4h1a4 4 0 0 0 4-4V4z"
                fill="currentColor"
              />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              class="badge-icon badge-icon-medal"
              aria-hidden="true"
            >
              <path
                d="M8 3h3l1 4h-3L8 3zm5 0h3l-1 4h-3l1-4zM12 9a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"
                fill="currentColor"
              />
            </svg>
          </div>
          <div class="badge-copy">
            <p class="badge-title">{{ badge.title }}</p>
            <p class="badge-rule">{{ badge.rule }}</p>
          </div>
        </li>
      </ul>
      <p v-else class="badges-empty">В этой категории пока нет наград</p>
    </CardContent>
  </Card>
</template>

<style scoped>
.badges-card {
  border: 0;
  box-shadow: var(--shadow-soft);
}

.badges-sub {
  margin: 0.22rem 0 0;
  font-size: 0.78rem;
  color: var(--muted-foreground);
}

.badges-filters {
  margin-top: 0.65rem;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.badges-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.52rem;
}

.badges-empty {
  margin: 0;
  color: var(--muted-foreground);
  font-size: 0.78rem;
}

.badge-item {
  border-radius: 0.9rem;
  border: 1px solid rgba(22, 50, 84, 0.08);
  padding: 0.58rem 0.62rem;
  display: grid;
  grid-template-columns: 2.2rem 1fr;
  gap: 0.58rem;
  align-items: center;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
}

.badge-item-unlocked {
  opacity: 1;
}

.badge-item-locked {
  opacity: 0.55;
  background: rgba(239, 245, 251, 0.7);
}

.badge-item-unlocked:hover {
  transform: translateY(-1px);
}

.badge-medal {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 999px;
  display: grid;
  place-items: center;
  background: linear-gradient(150deg, rgba(255, 255, 255, 0.92), rgba(196, 210, 224, 0.52));
}

.badge-medal-inner {
  font-family: var(--font-display);
  font-size: 0.56rem;
  letter-spacing: 0.02em;
  font-weight: 800;
  color: var(--foreground-strong);
}

.badge-icon {
  width: 1.1rem;
  height: 1.1rem;
}

.badge-icon-trophy {
  color: #ca8a04;
}

.badge-icon-medal {
  color: rgba(51, 65, 85, 0.58);
}

.badge-copy {
  min-width: 0;
}

.badge-title {
  margin: 0;
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--foreground-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.badge-rule {
  margin: 0.12rem 0 0;
  font-size: 0.68rem;
  color: var(--muted-foreground);
}

.tone-calm.badge-item-unlocked {
  background: linear-gradient(145deg, rgba(211, 244, 255, 0.86), rgba(240, 252, 255, 0.88));
  box-shadow: 0 8px 20px rgba(14, 165, 233, 0.12);
}

.tone-sport.badge-item-unlocked {
  background: linear-gradient(145deg, rgba(224, 245, 255, 0.86), rgba(242, 248, 255, 0.92));
  box-shadow: 0 8px 20px rgba(59, 130, 246, 0.14);
}

.tone-punch.badge-item-unlocked {
  background: linear-gradient(145deg, rgba(255, 236, 213, 0.88), rgba(255, 246, 232, 0.9));
  box-shadow: 0 8px 20px rgba(249, 115, 22, 0.16);
}

.tone-total.badge-item-unlocked {
  background: linear-gradient(145deg, rgba(219, 234, 254, 0.88), rgba(239, 246, 255, 0.94));
  box-shadow: 0 8px 20px rgba(37, 99, 235, 0.16);
}

.tone-legend.badge-item-unlocked {
  background: linear-gradient(145deg, rgba(220, 252, 231, 0.88), rgba(240, 253, 244, 0.95));
  box-shadow: 0 8px 20px rgba(22, 163, 74, 0.18);
}
</style>
