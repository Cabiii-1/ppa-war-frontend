<script setup lang="ts">
import type { HTMLAttributes } from "vue"
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
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
    <Card class="overflow-hidden p-0">
      <CardContent class="grid p-0 md:grid-cols-2">
        <form @submit.prevent="handleSubmit" class="p-6 md:p-8">
          <div class="flex flex-col gap-6">
            <div class="flex flex-col items-center text-center">
              <h1 class="text-2xl font-bold">
                Welcome back
              </h1>
              <p class="text-muted-foreground text-balance">
                Login to your PGC Daily Accomplishment Report account
              </p>
            </div>
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
                  class="ml-auto text-sm underline-offset-2 hover:underline"
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

            <Button
              type="submit"
              class="w-full"
              :disabled="authStore.isLoading || !form.username || !form.password"
            >
              <span v-if="authStore.isLoading">Signing in...</span>
              <span v-else>Login</span>
            </Button>
          </div>
        </form>
        <div class="bg-muted relative hidden md:block">
          <img
            src="/sso_logo.webp"
            alt="PGC Logo"
            class="absolute inset-0 h-full w-full object-contain p-8 dark:brightness-[0.8]"
          />
        </div>
      </CardContent>
    </Card>
    <div class="text-muted-foreground text-center text-xs text-balance">
      Philippine Gambling Corporation - Daily Accomplishment Report System
    </div>
  </div>
</template>