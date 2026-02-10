export function formatDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`
}

function dateKeyToOrdinal(dateKey) {
  if (typeof dateKey !== 'string') return null
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000)
}

export function cloneValue(value) {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value))
}

export function clampTarget(value) {
  return Math.max(20, Math.min(500, Number(value) || 100))
}

function parseChat(raw, index = 0) {
  const id = raw?.chat_id ?? raw?.id ?? raw?.chatId ?? raw?.value
  if (id == null) {
    return null
  }
  const title = raw?.title ?? raw?.name ?? raw?.label ?? `Чат ${index + 1}`
  return {
    id: String(id),
    title: String(title),
  }
}

export function normalizeChats(payload) {
  const candidates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.rows)
      ? payload.rows
      : Array.isArray(payload?.chats)
        ? payload.chats
        : []

  const parsed = candidates.map((item, index) => parseChat(item, index)).filter(Boolean)

  const uniqMap = new Map(parsed.map((item) => [item.id, item]))
  return Array.from(uniqMap.values())
}

export function normalizeStatusRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      user_id: Number(row.user_id),
      username: row.username ?? row.display_name ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      count: Number(row.count ?? row.total ?? 0),
      approaches: Array.isArray(row.approaches) ? row.approaches : [],
    }))
    .filter((row) => Number(row.count || 0) > 0)
}

export function normalizeRecordsRows(rows) {
  return (rows || [])
    .map((row) => ({
      ...row,
      user_id: Number(row.user_id),
      username: row.username ?? row.display_name ?? null,
      first_name: row.first_name ?? null,
      last_name: row.last_name ?? null,
      max_add: Number(row.max_add ?? row.best_approach ?? 0),
      record_date: row.record_date ?? row.best_day_date ?? null,
    }))
    .sort((a, b) => Number(b.max_add || 0) - Number(a.max_add || 0))
}

export function computeStreaks(days, target, anchorDateKey) {
  const threshold = clampTarget(target)
  const streakableOrdinals = Object.keys(days || {})
    .filter((dateKey) => Number(days[dateKey] || 0) >= threshold)
    .map((dateKey) => dateKeyToOrdinal(dateKey))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b)

  if (streakableOrdinals.length === 0) {
    return { currentStreak: 0, bestStreak: 0 }
  }

  let best = 0
  let run = 0
  let previous = null

  for (const current of streakableOrdinals) {
    if (!previous) {
      run = 1
    } else {
      const diff = current - previous
      run = diff === 1 ? run + 1 : 1
    }

    best = Math.max(best, run)
    previous = current
  }

  const streakSet = new Set(streakableOrdinals)
  const fallbackOrdinal = dateKeyToOrdinal(formatDateKey(new Date()))
  let cursor = dateKeyToOrdinal(anchorDateKey)
  if (!Number.isFinite(cursor)) {
    cursor = fallbackOrdinal
  }

  let currentStreak = 0
  while (Number.isFinite(cursor) && streakSet.has(cursor)) {
    currentStreak += 1
    cursor -= 1
  }

  return {
    currentStreak,
    bestStreak: best,
  }
}

export function buildApproachesDaysFromHistory(days) {
  return Object.keys(days || {}).reduce((acc, dateKey) => {
    const total = Number(days[dateKey] || 0)
    if (total > 0) {
      acc[dateKey] = Math.max(1, Math.round(total / 20))
    }
    return acc
  }, {})
}

export function normalizeApiDateKey(value) {
  if (value == null) return ''
  if (typeof value === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})T/)
    if (isoMatch) return isoMatch[1]
    return ''
  }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ''
  return parsed.toISOString().slice(0, 10)
}

export function buildTimeOfDayPushups(rows) {
  let morning = 0
  let day = 0
  let evening = 0

  ;(rows || []).forEach((entry) => {
    if (entry?.migrated) return
    const count = Number(entry?.count || 0)
    if (!Number.isFinite(count) || count <= 0) return
    if (!entry?.created_at) return

    const created = new Date(entry.created_at)
    if (Number.isNaN(created.getTime())) return

    const hour = created.getHours()
    if (hour < 12) {
      morning += count
    } else if (hour < 18) {
      day += count
    } else {
      evening += count
    }
  })

  return {
    morning,
    day,
    evening,
    total: morning + day + evening,
  }
}
