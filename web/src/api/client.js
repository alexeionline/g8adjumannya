import axios from 'axios'

export function createApiClient({ apiBase, token }) {
  const baseURL = apiBase ? apiBase.replace(/\/$/, '') : ''
  return axios.create({
    baseURL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
}

export function extractErrorMessage(error) {
  if (error?.response?.data?.error) {
    return error.response.data.error
  }
  return error?.message || 'Unknown error'
}
