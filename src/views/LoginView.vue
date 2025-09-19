<script setup lang="ts">
import LoginForm from "@/components/auth/LoginForm.vue"
</script>

<template>
  <div class="bg-muted flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
    <div class="flex w-full max-w-sm flex-col gap-6">
      <a href="#" class="flex items-center gap-2 self-center font-medium">
        <img
          src="/sso_logo.webp"
          alt="Provincial Government of Cagayan Logo"
          class="size-8"
        />
        Provincial Government of Cagayan
      </a>
      <LoginForm />
    </div>
  </div>
</template>