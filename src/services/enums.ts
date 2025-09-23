import axios from 'axios'
import router from '@/router'
import { useAuthStore } from '@/stores/auth'

// Create axios instance for enum service
const enumApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'
})

// Request interceptor to add auth token
enumApi.interceptors.request.use(
  (config) => {
    const authStore = useAuthStore()
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for error handling
enumApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const authStore = useAuthStore()
      authStore.logout()
      router.push('/login')
    }
    return Promise.reject(error)
  }
)

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
  error?: string
}

export const enumsService = {
  async getStatusOptions(): Promise<ApiResponse<string[]>> {
    try {
      const response = await enumApi.get<ApiResponse<string[]>>('/enums/status-options')
      return response.data
    } catch (error) {
      console.error('Failed to fetch status options:', error)
      throw error
    }
  }
}