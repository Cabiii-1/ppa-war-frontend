import axios from 'axios'
import type {
  Entry,
  CreateEntryData,
  UpdateEntryData,
  EntryFilters,
  PaginatedEntries
} from '@/types/entry'

const API_BASE_URL = 'http://localhost:8001/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
})

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  errors?: Record<string, string[]>
}

export const entriesService = {
  async getEntries(filters?: EntryFilters): Promise<ApiResponse<PaginatedEntries>> {
    const params = new URLSearchParams()
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString())
        }
      })
    }

    const response = await api.get(`/entries?${params.toString()}`)
    return response.data
  },

  async getEntry(id: number): Promise<ApiResponse<Entry>> {
    const response = await api.get(`/entries/${id}`)
    return response.data
  },

  async createEntry(data: CreateEntryData): Promise<ApiResponse<Entry>> {
    const response = await api.post('/entries', data)
    return response.data
  },

  async updateEntry(id: number, data: UpdateEntryData): Promise<ApiResponse<Entry>> {
    const response = await api.put(`/entries/${id}`, data)
    return response.data
  },

  async deleteEntry(id: number): Promise<ApiResponse<void>> {
    const response = await api.delete(`/entries/${id}`)
    return response.data
  },

  async bulkDeleteEntries(ids: number[]): Promise<ApiResponse<void>> {
    const response = await api.post('/entries/bulk-delete', { ids })
    return response.data
  },

  async getEntriesByDateRange(filters: {
    date_from: string
    date_to: string
    employee_id?: string
    status?: string
  }): Promise<ApiResponse<Entry[]>> {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString())
      }
    })

    const response = await api.get(`/entries/date-range?${params.toString()}`)
    return response.data
  }
}