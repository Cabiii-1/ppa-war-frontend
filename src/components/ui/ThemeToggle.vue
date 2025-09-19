<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { Switch } from '@/components/ui/switch'

const isDark = ref(false)

// Function to apply theme
const applyTheme = (dark: boolean) => {
  if (dark) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

// Watch for changes and apply theme
watch(isDark, (newValue) => {
  applyTheme(newValue)
})

// Initialize theme on mount
onMounted(() => {
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    isDark.value = savedTheme === 'dark'
  } else {
    // Default to system preference
    isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
  }
  applyTheme(isDark.value)
})
</script>

<template>
  <div class="flex items-center gap-2">
    <Switch
      id="theme-toggle"
      v-model="isDark"
    />
  </div>
</template>