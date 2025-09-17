<script setup lang="ts">
import type { SidebarProps } from "@/components/ui/sidebar"
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

import {
  FileText,
  Building2,
} from "lucide-vue-next"
import NavMain from "@/components/dashboard/NavMain.vue"
import NavUser from "@/components/dashboard/NavUser.vue"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

const props = withDefaults(defineProps<SidebarProps>(), {
  collapsible: "icon",
})

const authStore = useAuthStore()

const data = computed(() => ({
  user: {
    name: authStore.user?.name || "N/A",
    email: authStore.user?.email || "N/A",
    avatar: "/avatars/default.jpg",
  },
  teams: [
    {
      name: "PGC",
      logo: Building2,
      plan: "Enterprise",
    }
  ],
  navMain: [
    {
      title: "Daily Entries",
      url: "/dashboard/daily-entries",
      icon: FileText,
      isActive: true,
    },



  ],

}))
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <div class="p-4">
      </div>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="data.navMain" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser :user="data.user" />
    </SidebarFooter>
    <SidebarRail />
  </Sidebar>
</template>