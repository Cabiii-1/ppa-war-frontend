<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { useAuthStore } from '@/stores/auth'
import { weeklyReportsService } from '@/services/weeklyReports'
import type { WeeklyReport } from '@/services/weeklyReports'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Search, Eye, Trash2, CheckCircle, Archive } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import PdfReportActions from '@/components/pdf/PdfReportActions.vue'

const authStore = useAuthStore()

// State
const reports = ref<WeeklyReport[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showViewDialog = ref(false)
const showDeleteConfirmDialog = ref(false)
const selectedReport = ref<WeeklyReport | null>(null)
const reportEntries = ref<any[]>([])
const pendingDeleteId = ref<number | null>(null)

// Computed
const filteredReports = computed(() => {
  // First filter by current user's employee_id
  const userReports = reports.value.filter(report =>
    report.employee_id === authStore.user?.employee_id
  )

  // Then apply search filter
  if (!searchQuery.value) return userReports
  return userReports.filter(report =>
    report.period_start.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    report.period_end.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    report.status.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Methods
const loadReports = async () => {
  loading.value = true
  try {
    const response = await weeklyReportsService.getWeeklyReports()
    if (response.success) {
      reports.value = response.data || []
    }
  } catch (error) {
    console.error('Failed to load weekly reports:', error)
  } finally {
    loading.value = false
  }
}

const viewReport = async (report: WeeklyReport) => {
  try {
    selectedReport.value = report
    const response = await weeklyReportsService.getWeeklyReport(report.id)
    if (response.success) {
      reportEntries.value = (response.data as any)?.entries || []
      showViewDialog.value = true
    }
  } catch (error) {
    console.error('Failed to load report details:', error)
  }
}

const updateStatus = async (reportId: number, status: WeeklyReport['status']) => {
  try {
    const response = await weeklyReportsService.updateWeeklyReportStatus(reportId, status)
    if (response.success) {
      await loadReports()
    }
  } catch (error) {
    console.error('Failed to update status:', error)
  }
}

const deleteReport = (id: number) => {
  pendingDeleteId.value = id
  showDeleteConfirmDialog.value = true
}

const confirmDelete = async () => {
  if (pendingDeleteId.value === null) return

  try {
    const response = await weeklyReportsService.deleteWeeklyReport(pendingDeleteId.value)
    if (response.success) {
      showDeleteConfirmDialog.value = false
      pendingDeleteId.value = null
      await loadReports()
    }
  } catch (error) {
    console.error('Failed to delete report:', error)
  }
}

const formatDate = (dateString: string) => {
  return format(parseISO(dateString), 'MMM dd, yyyy')
}


// Lifecycle
onMounted(() => {
  loadReports()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-muted-foreground">View and manage your weekly accomplishment reports</p>
      </div>
    </div>

    <!-- Search -->
    <div class="flex items-center space-x-4">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          v-model="searchQuery"
          placeholder="Search reports..."
          class="pl-10"
        />
      </div>
    </div>

    <!-- Reports Table -->
    <Card>
      <CardContent class="p-0">
        <div class="overflow-x-auto">
          <Table class="w-full">
          <TableHeader>
            <TableRow>
              <TableHead class="w-1/3">Period</TableHead>
              <TableHead class="w-20">Status</TableHead>
              <TableHead class="w-16">Entries</TableHead>
              <TableHead class="w-1/6">Submitted</TableHead>
              <TableHead class="w-1/4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading">
              <TableRow v-for="i in 5" :key="`skeleton-${i}`">
                <TableCell>
                  <Skeleton class="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-6 w-16 rounded-md" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-5 w-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <div class="flex items-center space-x-1">
                    <Skeleton class="h-6 w-6 rounded" />
                    <Skeleton class="h-6 w-6 rounded" />
                    <Skeleton class="h-6 w-6 rounded" />
                  </div>
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else-if="filteredReports.length === 0">
              <TableCell colspan="5" class="text-center py-8 text-muted-foreground">
                No weekly reports found
              </TableCell>
            </TableRow>
            <TableRow v-else v-for="report in filteredReports" :key="report.id">
              <TableCell class="font-medium">
                {{ formatDate(report.period_start) }} - {{ formatDate(report.period_end) }}
              </TableCell>
              <TableCell>
                <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  {{ report.status }}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{{ report.entries_count || 0 }}</Badge>
              </TableCell>
              <TableCell>
                {{ report.submitted_at ? formatDate(report.submitted_at) : '-' }}
              </TableCell>
              <TableCell>
                <div class="flex items-center space-x-2">
                  <Button variant="ghost" size="sm" @click="viewReport(report)">
                    <Eye class="h-3 w-3" />
                  </Button>

                  <PdfReportActions
                    :report="report"
                    variant="outline"
                    size="sm"
                  />

                  <Button
                    v-if="report.status === 'draft'"
                    variant="ghost"
                    size="sm"
                    @click="updateStatus(report.id, 'submitted')"
                    class="text-green-600 hover:text-green-700"
                  >
                    <CheckCircle class="h-3 w-3" />
                  </Button>

                  <Button
                    v-if="report.status === 'submitted'"
                    variant="ghost"
                    size="sm"
                    @click="updateStatus(report.id, 'archived')"
                    class="text-blue-600 hover:text-blue-700"
                  >
                    <Archive class="h-3 w-3" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    @click="deleteReport(report.id)"
                    class="text-red-600 hover:text-red-700"
                  >
                    <Trash2 class="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>

    <!-- View Report Dialog -->
    <Dialog v-model:open="showViewDialog">
      <DialogContent class="sm:max-w-[800px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div class="flex items-center justify-between">
            <DialogTitle v-if="selectedReport">
              Weekly Report: {{ formatDate(selectedReport.period_start) }} - {{ formatDate(selectedReport.period_end) }}
            </DialogTitle>
            <PdfReportActions
              v-if="selectedReport"
              :report="selectedReport"
              variant="default"
              size="sm"
            />
          </div>
        </DialogHeader>
        <div class="flex-1 overflow-auto">
          <div v-if="selectedReport" class="space-y-4">
            <!-- Report Info -->
            <div class="bg-muted p-4 rounded-lg space-y-2">
              <div class="flex items-center justify-between">
                <span class="font-medium">Status:</span>
                <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                  {{ selectedReport.status }}
                </span>
              </div>
              <div class="flex items-center justify-between">
                <span class="font-medium">Total Entries:</span>
                <Badge variant="outline">{{ reportEntries.length }}</Badge>
              </div>
              <div v-if="selectedReport.submitted_at" class="flex items-center justify-between">
                <span class="font-medium">Submitted:</span>
                <span class="text-sm">{{ formatDate(selectedReport.submitted_at) }}</span>
              </div>
            </div>

            <!-- Entries Table -->
            <div class="border rounded-lg">
              <div class="overflow-x-auto">
                <Table class="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead class="w-24">Date</TableHead>
                    <TableHead class="w-1/3">PPA</TableHead>
                    <TableHead class="w-1/3">KPI</TableHead>
                    <TableHead class="w-20">Status</TableHead>
                    <TableHead class="w-1/6">Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow v-if="reportEntries.length === 0">
                    <TableCell colspan="5" class="text-center py-4 text-muted-foreground">
                      No entries found
                    </TableCell>
                  </TableRow>
                  <TableRow v-else v-for="entry in reportEntries" :key="entry.id">
                    <TableCell class="font-medium">
                      {{ formatDate(entry.entry_date) }}
                    </TableCell>
                    <TableCell class="max-w-0 text-sm">
                      <div class="truncate" :title="entry.ppa">
                        {{ entry.ppa }}
                      </div>
                    </TableCell>
                    <TableCell class="max-w-0 text-sm">
                      <div class="truncate" :title="entry.kpi">
                        {{ entry.kpi }}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                        {{ entry.status }}
                      </span>
                    </TableCell>
                    <TableCell class="max-w-0 text-sm">
                      <div class="truncate" :title="entry.remarks || ''">
                        {{ entry.remarks || '-' }}
                      </div>
                    </TableCell>
                  </TableRow>
                </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Dialog -->
    <Dialog v-model:open="showDeleteConfirmDialog">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
        </DialogHeader>
        <div class="py-4">
          <p class="text-sm text-muted-foreground">
            Are you sure you want to delete this weekly report? This will also unlink all associated entries. This action cannot be undone.
          </p>
        </div>
        <div class="flex justify-end space-x-2">
          <Button type="button" variant="outline" @click="showDeleteConfirmDialog = false">
            Cancel
          </Button>
          <Button type="button" variant="destructive" @click="confirmDelete">
            Yes, Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>