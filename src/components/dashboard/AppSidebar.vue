<script setup lang="ts">
import type { SidebarProps } from "@/components/ui/sidebar"
import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

import {
  FileText,
  Building2,
  Calendar,
} from "lucide-vue-next"
import NavMain from "@/components/dashboard/NavMain.vue"
import NavUser from "@/components/dashboard/NavUser.vue"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
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
    // {
    //   title: "Weekly Reports",
    //   url: "/dashboard/weekly-reports",
    //   icon: Calendar,
    //   isActive: false,
    // },
  ],

}))
</script>

<template>
  <Sidebar v-bind="props">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
            <div class="flex aspect-square size-8 items-center justify-center rounded-lg">
              <img
                src="/sso_logo.webp"
                alt="Province of Cagayan Official Seal"
                class="w-8 h-8"
              />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-semibold">PGC</span>
              <span class="truncate text-xs">Weekly Reports</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
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