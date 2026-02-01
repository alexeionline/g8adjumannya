import { createApiClient } from './client'

function requireAuth(auth) {
  if (!auth.apiBase || !auth.token || !auth.chatId) {
    throw new Error('Заполни API Base, Token и Chat ID')
  }
}

export async function fetchStatus(auth, date) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const params = { chat_id: auth.chatId }
  if (date) {
    params.date = date
  }
  const { data } = await client.get('/status', { params })
  return data
}

export async function fetchRecords(auth) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.get('/records', { params: { chat_id: auth.chatId } })
  return data
}

export async function fetchHistory(auth, userId) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.get('/history', {
    params: { chat_id: auth.chatId, user_id: userId },
  })
  return data
}
