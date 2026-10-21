import { useAuthStore } from './store'

export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '')

export async function request<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const token = useAuthStore.getState().token
  const headers = new Headers(init.headers)
  if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers })
  if (!res.ok) {
    if (res.status === 401 && token) useAuthStore.getState().logout()
    const error = await res.json().catch(() => ({}))
    throw new Error(Array.isArray(error.message) ? error.message.join(', ') : error.message || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return await res.json() as T
}

export const jsonBody = (method: string, data?: unknown): RequestInit => ({ method, ...(data === undefined ? {} : { body: JSON.stringify(data) }) })
export function queryString(data: object = {}) {
  return new URLSearchParams(Object.entries(data).filter(([,v]) => v !== undefined && v !== null && v !== '').map(([k,v]) => [k,String(v)])).toString()
}
