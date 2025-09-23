import axios from 'axios'
import router from '@/router'
import type { ApiResponse } from './entries'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

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
      localStorage.removeItem('auth_user')
      router.push('/login')
    }
    return Promise.reject(error)
  }
)

export interface WeeklyReport {
  id: number
  employee_id: string
  period_start: string
  period_end: string
  submitted_at: string
  status: 'draft' | 'submitted'
  created_at: string
  updated_at: string
  entries_count?: number
}

export interface PaginatedWeeklyReports {
  current_page: number
  data: WeeklyReport[]
  first_page_url: string
  from: number
  last_page: number
  last_page_url: string
  links: Array<{
    url: string | null
    label: string
    page: number | null
    active: boolean
  }>
  next_page_url: string | null
  path: string
  per_page: number
  prev_page_url: string | null
  to: number
  total: number
}

export interface CreateWeeklyReportData {
  entry_ids: number[]
  period_start: string
  period_end: string
}

export interface UpdateWeeklyReportData {
  entry_ids: number[]
}

export const weeklyReportsService = {
  async createWeeklyReport(data: CreateWeeklyReportData): Promise<ApiResponse<WeeklyReport>> {
    const response = await api.post('/weekly-reports', data)
    return response.data
  },

  async getWeeklyReports(): Promise<ApiResponse<PaginatedWeeklyReports>> {
    const response = await api.get('/weekly-reports')
    return response.data
  },

  async getWeeklyReport(id: number): Promise<ApiResponse<WeeklyReport>> {
    const response = await api.get(`/weekly-reports/${id}`)
    return response.data
  },

  async updateWeeklyReport(id: number, data: UpdateWeeklyReportData): Promise<ApiResponse<WeeklyReport>> {
    const response = await api.put(`/weekly-reports/${id}`, data)
    return response.data
  },

  async updateWeeklyReportStatus(id: number, status: WeeklyReport['status']): Promise<ApiResponse<WeeklyReport>> {
    const response = await api.patch(`/weekly-reports/${id}/status`, { status })
    return response.data
  },

  async deleteWeeklyReport(id: number): Promise<ApiResponse<void>> {
    const response = await api.delete(`/weekly-reports/${id}`)
    return response.data
  }
}