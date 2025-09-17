<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Building2 } from "lucide-vue-next"

const props = defineProps<{
  class?: HTMLAttributes["class"]
}>()

const router = useRouter()
const authStore = useAuthStore()

const form = reactive({
  username: '',
  password: ''
})

const handleSubmit = async () => {
  if (!form.username || !form.password) return

  const success = await authStore.login({
    username: form.username,
    password: form.password
  })

  if (success) {
    // Ensure user data is loaded before navigation
    await authStore.fetchUser()
    router.push('/dashboard')
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <div class="flex flex-col items-center gap-4 text-center mb-6">
      <div class="flex items-center gap-3">
        <div class="flex items-center justify-center w-12 h-12 bg-primary text-primary-foreground rounded-lg">
          <Building2 class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl font-bold text-primary">PGC</h1>
          <p class="text-sm text-muted-foreground">Daily Accomplishment Report</p>
        </div>
      </div>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Login to your account</CardTitle>
        <CardDescription>
          Enter your PGC credentials to access the DAR system
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit">
          <div class="flex flex-col gap-6">
            <div class="grid gap-3">
              <Label for="username">Username</Label>
              <Input
                id="username"
                v-model="form.username"
                type="text"
                placeholder="Enter your username"
                required
                :disabled="authStore.isLoading"
              />
            </div>
            <div class="grid gap-3">
              <div class="flex items-center">
                <Label for="password">Password</Label>
                <a
                  href="#"
                  class="ml-auto inline-block text-sm underline-offset-4 hover:underline text-muted-foreground"
                >
                  Forgot your password?
                </a>
              </div>
              <Input
                id="password"
                v-model="form.password"
                type="password"
                required
                :disabled="authStore.isLoading"
              />
            </div>

            <!-- Error Message -->
            <div v-if="authStore.error" class="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {{ authStore.error }}
            </div>

            <div class="flex flex-col gap-3">
              <Button
                type="submit"
                class="w-full"
                :disabled="authStore.isLoading || !form.username || !form.password"
              >
                <span v-if="authStore.isLoading">Signing in...</span>
                <span v-else>Sign In</span>
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  </div>
</template>