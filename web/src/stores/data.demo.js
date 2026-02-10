import { formatDateKey } from './data.utils.js'

export const DEMO_USERS = [
  { user_id: 1001, username: 'alex', first_name: 'Alex', last_name: null },
  { user_id: 1002, username: 'maria', first_name: 'Maria', last_name: null },
  { user_id: 1003, username: 'denis', first_name: 'Denis', last_name: null },
  { user_id: 1004, username: 'irina', first_name: 'Irina', last_name: null },
  { user_id: 1005, username: 'oleg', first_name: 'Oleg', last_name: null },
  { user_id: 1006, username: 'nina', first_name: 'Nina', last_name: null },
  { user_id: 1007, username: 'roman', first_name: 'Roman', last_name: null },
  { user_id: 1008, username: 'sveta', first_name: 'Sveta', last_name: null },
]

export const DEMO_CHATS = [
  { id: '-10024588112', title: 'G8 Утренняя команда' },
  { id: '-10019877221', title: 'Вечерние бойцы' },
]

function demoCreatedAt(minutes) {
  const d = new Date()
  d.setHours(9, minutes, 0, 0)
  return d.toISOString()
}

function buildDemoHistory(seed = 0) {
  const days = {}
  const today = new Date()
  const variants = [0, 36, 58, 72, 94, 105, 116, 45]

  for (let i = 0; i < 60; i += 1) {
    const date = new Date(today)
    date.setDate(today.getDate() - i)
    const pick = variants[(i + seed) % variants.length]
    const value = i % 9 === 0 ? 0 : pick
    days[formatDateKey(date)] = value
  }

  return days
}

function buildMorningStatusRows() {
  return [
    {
      ...DEMO_USERS[0],
      count: 104,
      approaches: [
        { id: 11001, count: 12, created_at: demoCreatedAt(0) },
        { id: 11002, count: 12, created_at: demoCreatedAt(10) },
        { id: 11003, count: 12, created_at: demoCreatedAt(22) },
        { id: 11004, count: 12, created_at: demoCreatedAt(36) },
        { id: 11005, count: 12, created_at: demoCreatedAt(52) },
        { id: 11006, count: 12, created_at: demoCreatedAt(70) },
        { id: 11007, count: 12, created_at: demoCreatedAt(93) },
        { id: 11008, count: 12, created_at: demoCreatedAt(118) },
        { id: 11009, count: 8, created_at: demoCreatedAt(150) },
      ],
    },
    {
      ...DEMO_USERS[1],
      count: 84,
      approaches: [
        { id: 12001, count: 20, created_at: demoCreatedAt(5) },
        { id: 12002, count: 22, created_at: demoCreatedAt(23) },
        { id: 12003, count: 20, created_at: demoCreatedAt(52) },
        { id: 12004, count: 22, created_at: demoCreatedAt(88) },
      ],
    },
    {
      ...DEMO_USERS[2],
      count: 118,
      approaches: [
        { id: 13001, count: 30, created_at: demoCreatedAt(0) },
        { id: 13002, count: 30, created_at: demoCreatedAt(29) },
        { id: 13003, count: 28, created_at: demoCreatedAt(62) },
        { id: 13004, count: 30, created_at: demoCreatedAt(98) },
      ],
    },
    {
      ...DEMO_USERS[3],
      count: 64,
      approaches: [
        { id: 14001, count: 18, created_at: demoCreatedAt(0) },
        { id: 14002, count: 18, created_at: demoCreatedAt(18) },
        { id: 14003, count: 14, created_at: demoCreatedAt(36) },
        { id: 14004, count: 14, created_at: demoCreatedAt(54) },
      ],
    },
    {
      ...DEMO_USERS[4],
      count: 92,
      approaches: [
        { id: 15001, count: 22, created_at: demoCreatedAt(4) },
        { id: 15002, count: 24, created_at: demoCreatedAt(27) },
        { id: 15003, count: 24, created_at: demoCreatedAt(55) },
        { id: 15004, count: 22, created_at: demoCreatedAt(87) },
      ],
    },
    {
      ...DEMO_USERS[5],
      count: 44,
      approaches: [
        { id: 16001, count: 14, created_at: demoCreatedAt(6) },
        { id: 16002, count: 15, created_at: demoCreatedAt(29) },
        { id: 16003, count: 15, created_at: demoCreatedAt(61) },
      ],
    },
    {
      ...DEMO_USERS[6],
      count: 131,
      approaches: [
        { id: 17001, count: 35, created_at: demoCreatedAt(0) },
        { id: 17002, count: 33, created_at: demoCreatedAt(24) },
        { id: 17003, count: 33, created_at: demoCreatedAt(49) },
        { id: 17004, count: 30, created_at: demoCreatedAt(80) },
      ],
    },
    {
      ...DEMO_USERS[7],
      count: 57,
      approaches: [
        { id: 18001, count: 19, created_at: demoCreatedAt(11) },
        { id: 18002, count: 19, created_at: demoCreatedAt(38) },
        { id: 18003, count: 19, created_at: demoCreatedAt(74) },
      ],
    },
  ]
}

function buildEveningStatusRows() {
  return [
    {
      ...DEMO_USERS[0],
      count: 78,
      approaches: [
        { id: 21001, count: 20, created_at: demoCreatedAt(10) },
        { id: 21002, count: 18, created_at: demoCreatedAt(36) },
        { id: 21003, count: 20, created_at: demoCreatedAt(74) },
        { id: 21004, count: 20, created_at: demoCreatedAt(115) },
      ],
    },
    {
      ...DEMO_USERS[1],
      count: 112,
      approaches: [
        { id: 22001, count: 24, created_at: demoCreatedAt(8) },
        { id: 22002, count: 24, created_at: demoCreatedAt(32) },
        { id: 22003, count: 24, created_at: demoCreatedAt(60) },
        { id: 22004, count: 20, created_at: demoCreatedAt(94) },
        { id: 22005, count: 20, created_at: demoCreatedAt(132) },
      ],
    },
    {
      ...DEMO_USERS[2],
      count: 67,
      approaches: [
        { id: 23001, count: 17, created_at: demoCreatedAt(12) },
        { id: 23002, count: 16, created_at: demoCreatedAt(35) },
        { id: 23003, count: 17, created_at: demoCreatedAt(68) },
        { id: 23004, count: 17, created_at: demoCreatedAt(112) },
      ],
    },
    {
      ...DEMO_USERS[3],
      count: 126,
      approaches: [
        { id: 24001, count: 30, created_at: demoCreatedAt(0) },
        { id: 24002, count: 32, created_at: demoCreatedAt(30) },
        { id: 24003, count: 34, created_at: demoCreatedAt(70) },
        { id: 24004, count: 30, created_at: demoCreatedAt(110) },
      ],
    },
    {
      ...DEMO_USERS[4],
      count: 41,
      approaches: [
        { id: 25001, count: 11, created_at: demoCreatedAt(9) },
        { id: 25002, count: 10, created_at: demoCreatedAt(26) },
        { id: 25003, count: 10, created_at: demoCreatedAt(58) },
        { id: 25004, count: 10, created_at: demoCreatedAt(96) },
      ],
    },
    {
      ...DEMO_USERS[5],
      count: 96,
      approaches: [
        { id: 26001, count: 24, created_at: demoCreatedAt(13) },
        { id: 26002, count: 24, created_at: demoCreatedAt(42) },
        { id: 26003, count: 24, created_at: demoCreatedAt(73) },
        { id: 26004, count: 24, created_at: demoCreatedAt(103) },
      ],
    },
    {
      ...DEMO_USERS[6],
      count: 59,
      approaches: [
        { id: 27001, count: 15, created_at: demoCreatedAt(8) },
        { id: 27002, count: 14, created_at: demoCreatedAt(33) },
        { id: 27003, count: 15, created_at: demoCreatedAt(63) },
        { id: 27004, count: 15, created_at: demoCreatedAt(100) },
      ],
    },
    {
      ...DEMO_USERS[7],
      count: 142,
      approaches: [
        { id: 28001, count: 36, created_at: demoCreatedAt(0) },
        { id: 28002, count: 36, created_at: demoCreatedAt(24) },
        { id: 28003, count: 35, created_at: demoCreatedAt(54) },
        { id: 28004, count: 35, created_at: demoCreatedAt(89) },
      ],
    },
  ]
}

export function buildRecordsFromStatus(statusRows) {
  const now = new Date()
  const todayKey = formatDateKey(now)
  return statusRows
    .map((row, index) => {
      const bestApproach = Math.max(...(row.approaches || []).map((entry) => Number(entry.count || 0)), 0)
      const bestDay = Number(row.count || 0)
      const bonus = (index + 1) * 3
      return {
        user_id: row.user_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        max_add: bestApproach,
        record_date: todayKey,
        best_approach: bestApproach,
        best_day_total: bestDay,
        best_day_date: todayKey,
        total_all: bestDay * 18 + bestApproach * 4 + bonus * 10,
      }
    })
    .sort((a, b) => b.best_approach - a.best_approach)
}

export function buildDemoByChat() {
  const morningStatus = buildMorningStatusRows()
  const eveningStatus = buildEveningStatusRows()

  return {
    [DEMO_CHATS[0].id]: {
      statusRows: morningStatus,
      recordsRows: buildRecordsFromStatus(morningStatus),
      historyDays: buildDemoHistory(1),
    },
    [DEMO_CHATS[1].id]: {
      statusRows: eveningStatus,
      recordsRows: buildRecordsFromStatus(eveningStatus),
      historyDays: buildDemoHistory(4),
    },
  }
}
