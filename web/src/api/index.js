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
  if (auth.selectedChatId) {
    params.chat_id = auth.selectedChatId
  }
  const { data } = await client.get('/status', { params })
  return data
}

export async function fetchRecords(auth) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const params = {}
  if (auth.selectedChatId) {
    params.chat_id = auth.selectedChatId
  }
  const { data } = await client.get('/records', { params })
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

export async function addPushups(auth, userId, delta) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.post('/add', {
    user_id: userId,
    delta,
  })
  return data
}

export async function updateApproach(auth, approachId, userId, count) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.patch(`/approaches/${approachId}`, {
    user_id: userId,
    count,
  })
  return data
}

export async function deleteApproach(auth, approachId, userId) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.delete(`/approaches/${approachId}`, {
    data: { user_id: userId },
  })
  return data
}

export async function fetchChats(auth) {
  requireAuth(auth)
  const client = createApiClient(auth)
  const { data } = await client.get('/chats')
  return data
}
