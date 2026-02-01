import { createApiClient } from './client'

function requireAuth(auth) {
  if (!auth.apiBase || !auth.token) {
    throw new Error('Заполни API Base и Token')
  }
}

export async function fetchStatus(auth, date) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const params = {}
  if (date) {
    params.date = date
  }
  const { data } = await client.get('/status', { params })
  return data
}

export async function fetchRecords(auth) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.get('/records')
  return data
}

export async function fetchHistory(auth, userId) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.get('/history', {
    params: { user_id: userId },
  })
  return data
}
