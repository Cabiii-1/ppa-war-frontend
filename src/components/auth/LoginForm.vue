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
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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
    router.push('/daily-entries')
  }
}
</script>

<template>
  <div :class="cn('flex flex-col gap-6', props.class)">
    <Card>
      <CardHeader class="text-center">
        <CardTitle class="text-xl">
          Welcome back
        </CardTitle>
        <CardDescription>
          Login to your Weekly Accomplishment Report account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form @submit.prevent="handleSubmit">
          <div class="grid gap-6">
            <div class="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
            
            </div>
            <div class="grid gap-6">
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
                    class="ml-auto text-sm underline-offset-4 hover:underline"
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
          </div>
        </form>
      </CardContent>
    </Card>

  </div>
</template>