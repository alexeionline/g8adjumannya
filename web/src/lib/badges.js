function dateKeyToOrdinal(dateKey) {
  const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function getLongestStreak(daysMap, predicate) {
  const validOrdinals = Object.keys(daysMap || {})
    .filter((dateKey) => predicate(Number(daysMap[dateKey] || 0)))
    .map((dateKey) => dateKeyToOrdinal(dateKey))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  if (validOrdinals.length === 0) return 0

  let best = 1
  let current = 1

  for (let i = 1; i < validOrdinals.length; i += 1) {
    const diffDays = validOrdinals[i] - validOrdinals[i - 1]
    if (diffDays === 1) {
      current += 1
      if (current > best) best = current
    } else {
      current = 1
    }
  }

  return best
}

export function buildBadgesMetrics(historyDays, bestApproach) {
  const counts = Object.values(historyDays || {}).map((value) => Number(value || 0))
  const activeDays = counts.filter((value) => value > 0).length
  const days100 = counts.filter((value) => value >= 100).length
  const maxDayTotal = counts.length ? Math.max(...counts) : 0
  const totalPushups = counts.reduce((sum, value) => sum + value, 0)
  const maxActiveStreak = getLongestStreak(historyDays, (value) => value > 0)

  return {
    activeDays,
    days100,
    maxDayTotal,
    totalPushups,
    bestApproach: Number(bestApproach || 0),
    maxActiveStreak,
  }
}

export function buildChallengeBadges(metrics) {
  const { activeDays, days100, maxDayTotal, totalPushups, bestApproach, maxActiveStreak } = metrics
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
}
