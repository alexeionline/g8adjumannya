<script setup>
import { computed } from 'vue'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

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

function getLongestStreak(daysMap, predicate) {
  const validDates = Object.keys(daysMap || {})
    .filter((dateKey) => predicate(Number(daysMap[dateKey] || 0)))
    .sort()

  if (validDates.length === 0) return 0

  let best = 1
  let current = 1

  for (let i = 1; i < validDates.length; i += 1) {
    const prev = new Date(`${validDates[i - 1]}T00:00:00`)
    const cur = new Date(`${validDates[i]}T00:00:00`)
    if (Number.isNaN(prev.getTime()) || Number.isNaN(cur.getTime())) {
      current = 1
      continue
    }
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000)
    if (diffDays === 1) {
      current += 1
      if (current > best) best = current
    } else {
      current = 1
    }
  }

  return best
}

const metrics = computed(() => {
  const counts = Object.values(props.historyDays || {}).map((value) => Number(value || 0))
  const activeDays = counts.filter((value) => value > 0).length
  const days100 = counts.filter((value) => value >= 100).length
  const maxDayTotal = counts.length ? Math.max(...counts) : 0
  const totalPushups = counts.reduce((sum, value) => sum + value, 0)
  const maxActiveStreak = getLongestStreak(props.historyDays, (value) => value > 0)

  return {
    activeDays,
    days100,
    maxDayTotal,
    totalPushups,
    bestApproach: Number(props.bestApproach || 0),
    maxActiveStreak,
  }
})

const badges = computed(() => {
  const { activeDays, days100, maxDayTotal, totalPushups, bestApproach, maxActiveStreak } = metrics.value

  return [
    {
      id: 'first_rep',
      title: 'Коврик Распакован',
      rule: 'Хотя бы 1 день с отжиманиями',
      achieved: activeDays >= 1,
      tone: 'calm',
    },
    {
      id: 'one_hundred_once',
      title: 'Сотка в Кармане',
      rule: '100+ за день хотя бы 1 раз',
      achieved: days100 >= 1,
      tone: 'sport',
    },
    {
      id: 'one_hundred_three_days',
      title: 'Три Сотки Без Паники',
      rule: '100+ за день хотя бы 3 дня',
      achieved: days100 >= 3,
      tone: 'sport',
    },
    {
      id: 'active_7_days',
      title: 'Неделятор',
      rule: '7 дней с отжиманиями',
      achieved: activeDays >= 7,
      tone: 'calm',
    },
    {
      id: 'hundred_ten_days',
      title: 'Железный Десятидневник',
      rule: '100+ за день 10 дней',
      achieved: days100 >= 10,
      tone: 'sport',
    },
    {
      id: 'active_30_days',
      title: 'Месяц Без Отмазок',
      rule: '30 дней с отжиманиями',
      achieved: activeDays >= 30,
      tone: 'calm',
    },
    {
      id: 'active_50_days',
      title: 'Полтинник На Характере',
      rule: '50 дней с отжиманиями',
      achieved: activeDays >= 50,
      tone: 'calm',
    },
    {
      id: 'active_75_days',
      title: 'Семьдесят Пять Без Шага Назад',
      rule: '75 дней с отжиманиями',
      achieved: activeDays >= 75,
      tone: 'calm',
    },
    {
      id: 'active_100_days',
      title: 'Легенда Сотого Дня',
      rule: '100 дней с отжиманиями',
      achieved: activeDays >= 100,
      tone: 'legend',
    },
    {
      id: 'streak_7_days',
      title: 'Семидневный Ритм',
      rule: '7 дней подряд',
      achieved: maxActiveStreak >= 7,
      tone: 'punch',
    },
    {
      id: 'streak_10_days',
      title: 'Десять Без Сбоев',
      rule: '10 дней подряд',
      achieved: maxActiveStreak >= 10,
      tone: 'punch',
    },
    {
      id: 'streak_30_days',
      title: 'Месяц На Автопилоте',
      rule: '30 дней подряд',
      achieved: maxActiveStreak >= 30,
      tone: 'legend',
    },
    {
      id: 'single_10',
      title: 'Щелчок по Гравитации',
      rule: '10 за один подход',
      achieved: bestApproach >= 10,
      tone: 'punch',
    },
    {
      id: 'single_25',
      title: 'Плечи Заговорили',
      rule: '25 за один подход',
      achieved: bestApproach >= 25,
      tone: 'punch',
    },
    {
      id: 'single_50',
      title: 'Лифт Не Нужен',
      rule: '50 за один подход',
      achieved: bestApproach >= 50,
      tone: 'punch',
    },
    {
      id: 'day_50',
      title: 'Полтинник За Сутки',
      rule: '50 за день',
      achieved: maxDayTotal >= 50,
      tone: 'sport',
    },
    {
      id: 'day_150',
      title: 'Полтора Пака Мотивации',
      rule: '150 за день',
      achieved: maxDayTotal >= 150,
      tone: 'sport',
    },
    {
      id: 'day_200',
      title: 'Двести и Улыбка',
      rule: '200 за день',
      achieved: maxDayTotal >= 200,
      tone: 'sport',
    },
    {
      id: 'day_300',
      title: 'Триста Спартанцев Во Мне',
      rule: '300 за день',
      achieved: maxDayTotal >= 300,
      tone: 'legend',
    },
    {
      id: 'total_1000',
      title: 'Клуб Тысячи',
      rule: '1000 отжиманий всего',
      achieved: totalPushups >= 1000,
      tone: 'total',
    },
    {
      id: 'total_5000',
      title: 'Пять Тысяч Без Тормозов',
      rule: '5000 отжиманий всего',
      achieved: totalPushups >= 5000,
      tone: 'total',
    },
    {
      id: 'total_10000',
      title: 'Десятка Стали',
      rule: '10000 отжиманий всего',
      achieved: totalPushups >= 10000,
      tone: 'total',
    },
    {
      id: 'total_50000',
      title: 'Полтинник Невозможного',
      rule: '50000 отжиманий всего',
      achieved: totalPushups >= 50000,
      tone: 'legend',
    },
    {
      id: 'total_100000',
      title: 'Сотка Титана',
      rule: '100000 отжиманий всего',
      achieved: totalPushups >= 100000,
      tone: 'legend',
    },
  ]
})

const unlockedCount = computed(() => badges.value.filter((item) => item.achieved).length)

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
    </CardHeader>
    <CardContent>
      <ul class="badges-grid">
        <li
          v-for="badge in badges"
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

.badges-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.52rem;
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
