import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/login',
      name: 'Login',
      component: () => import('@/views/LoginView.vue'),
      meta: {
        requiresGuest: true
      }
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: () => import('@/views/DashboardView.vue'),
      redirect: '/dashboard/overview',
      meta: {
        requiresAuth: true
      },
      children: [
        {
          path: 'overview',
          name: 'DashboardOverview',
          component: () => import('@/components/dashboard/modules/OverviewModule.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: 'daily-entries',
          name: 'DailyEntries',
          component: () => import('@/components/dashboard/modules/DailyEntriesModule.vue'),
          meta: { requiresAuth: true }
        },
        {
          path: 'weekly-reports',
          name: 'WeeklyReports',
          component: () => import('@/components/dashboard/modules/WeeklyReportsModule.vue'),
          meta: { requiresAuth: true }
        }
      ]
    }
  ]
})

// Navigation guards
router.beforeEach(async (to, _, next) => {
  const authStore = useAuthStore()

  // If user has token but no user data, try to fetch user
  if (authStore.token && !authStore.user) {
    await authStore.initializeAuth()
  }

  // Check if route requires authentication
  if (to.meta.requiresAuth) {
    if (!authStore.isAuthenticated) {
      // Clear any error state and redirect to login
      authStore.clearError()
      next('/login')
      return
    }
  }

  // Check if route requires guest (not authenticated)
  if (to.meta.requiresGuest) {
    if (authStore.isAuthenticated) {
      next('/dashboard')
      return
    }
  }

  next()
})

export default router