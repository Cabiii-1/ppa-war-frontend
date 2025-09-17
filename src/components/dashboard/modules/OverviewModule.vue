<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, TrendingUp, Users, Calendar } from "lucide-vue-next"

const authStore = useAuthStore()

onMounted(() => {
  if (!authStore.user && authStore.token) {
    authStore.fetchUser()
  }
})

const welcomeMessage = computed(() => `Welcome back, ${authStore.user?.name || 'User'}!`)
const currentDate = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})
</script>

<template>
  <div>
    <!-- Welcome Section -->
    <div class="mb-6">
      <h1 class="text-3xl font-bold">{{ welcomeMessage }}</h1>
      <p class="text-muted-foreground">{{ currentDate }}</p>

      <!-- User Details Section -->
      <div v-if="authStore.user" class="mt-4 p-4 bg-muted/30 rounded-lg">
        <h2 class="text-lg font-semibold mb-3">Employee Information</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
          <div>
            <span class="font-medium text-muted-foreground">Employee ID:</span>
            <p class="mt-1">{{ authStore.user.employee_id }}</p>
          </div>
          <div>
            <span class="font-medium text-muted-foreground">Email:</span>
            <p class="mt-1">{{ authStore.user.email }}</p>
          </div>
          <div>
            <span class="font-medium text-muted-foreground">Department:</span>
            <p class="mt-1">{{ authStore.user.department }}</p>
          </div>
          <div>
            <span class="font-medium text-muted-foreground">Position:</span>
            <p class="mt-1">{{ authStore.user.position }}</p>
          </div>
          <div v-if="authStore.user.manager_id">
            <span class="font-medium text-muted-foreground">Manager ID:</span>
            <p class="mt-1">{{ authStore.user.manager_id }}</p>
          </div>
        </div>
      </div>
    </div>
    <h1>asdad</h1>

  

  
  </div>
</template>