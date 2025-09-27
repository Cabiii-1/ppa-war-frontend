<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { DateFormatter, getLocalTimeZone, fromDate } from '@internationalized/date'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { weeklyReportsService } from '@/services/weeklyReports'
import { entriesService } from '@/services/entries'
import { enumsService } from '@/services/enums'
import type { WeeklyReport } from '@/services/weeklyReports'
import type { CreateEntryData } from '@/types/entry'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Search, CheckCircle, FileText, FileDown, Check, Clock, AlertCircle, Plus, Calendar as CalendarIcon } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { PdfService } from '@/services/pdfService'

const authStore = useAuthStore()
const router = useRouter()

// Date formatter
const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// State
const reports = ref<WeeklyReport[]>([])
const loading = ref(false)
const searchQuery = ref('')
const showSubmitConfirmDialog = ref(false)
const pdfLoading = ref(false)
const pendingSubmitId = ref<number | null>(null)

// Add Entry State
const statusOptions = ref<string[]>([])
const loadingStatusOptions = ref(false)
const showAddDialog = ref(false)
const addEntryError = ref('')
const selectedEntryDate = ref(fromDate(new Date(), getLocalTimeZone()))

// Form state
const newEntry = reactive<CreateEntryData>({
  employee_id: '',
  entry_date: format(new Date(), 'yyyy-MM-dd'),
  ppa: '',
  kpi: '',
  status: '',
  status_comment: '',
  remarks: ''
})

// Computed
const filteredReports = computed(() => {
  // Ensure reports.value is always an array
  const reportsArray = Array.isArray(reports.value) ? reports.value : []

  // First filter by current user's employee_id
  const userReports = reportsArray.filter(report =>
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
      // Handle paginated response - extract the actual reports array
      reports.value = response.data?.data || []
    } else {
      reports.value = []
      console.error('Failed to load weekly reports:', response.message || 'Unknown error')
    }
  } catch (error) {
    console.error('Failed to load weekly reports:', error)
    reports.value = []
  } finally {
    loading.value = false
  }
}

const navigateToDailyEntries = (report: WeeklyReport) => {
  // Navigate to daily entries with the report's date range
  router.push({
    name: 'DailyEntries',
    query: {
      start_date: report.period_start,
      end_date: report.period_end
    }
  })
}

// Entry management methods
const loadStatusOptions = async () => {
  loadingStatusOptions.value = true
  try {
    const response = await enumsService.getStatusOptions()
    if (response.success) {
      statusOptions.value = response.data
    }
  } catch (error) {
    console.error('Failed to load status options:', error)
    statusOptions.value = []
  } finally {
    loadingStatusOptions.value = false
  }
}

const addEntry = async () => {
  // Clear any previous errors
  addEntryError.value = ''

  try {
    // Set employee_id to current user
    newEntry.employee_id = authStore.user?.employee_id || authStore.user?.id?.toString() || ''

    // Convert calendar date to string format for API
    newEntry.entry_date = format(selectedEntryDate.value!.toDate(), 'yyyy-MM-dd')

    const response = await entriesService.createEntry(newEntry)
    if (response.success) {
      showAddDialog.value = false
      resetForm()
      await loadReports() // Refresh the reports list
    } else {
      addEntryError.value = response.message || 'Failed to create entry'
    }
  } catch (error: any) {
    console.error('Failed to create entry:', error)
    if (error.response?.status === 403) {
      addEntryError.value = error.response.data.message || 'Cannot add entries to submitted weekly reports'
    } else {
      addEntryError.value = 'Failed to create entry. Please try again.'
    }
  }
}

const resetForm = () => {
  selectedEntryDate.value = fromDate(new Date(), getLocalTimeZone())
  addEntryError.value = ''
  Object.assign(newEntry, {
    employee_id: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    ppa: '',
    kpi: '',
    status: statusOptions.value.length > 0 ? statusOptions.value[0] : '',
    status_comment: '',
    remarks: ''
  })
}

// Set default status dynamically based on available options
const initializeNewEntry = () => {
  newEntry.status = statusOptions.value.length > 0 ? statusOptions.value[0] : ''
}


const showSubmitConfirmation = (reportId: number) => {
  pendingSubmitId.value = reportId
  showSubmitConfirmDialog.value = true
}

const confirmSubmit = async () => {
  if (pendingSubmitId.value === null) return

  try {
    const response = await weeklyReportsService.updateWeeklyReportStatus(pendingSubmitId.value, 'submitted')
    if (response.success) {
      showSubmitConfirmDialog.value = false
      pendingSubmitId.value = null
      await loadReports()
    }
  } catch (error) {
    console.error('Failed to submit report:', error)
  }
}


const formatDate = (dateString: string) => {
  return format(parseISO(dateString), 'MMM dd, yyyy')
}

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case 'submitted':
      return Check
    case 'draft':
      return Clock
    case 'processing':
      return AlertCircle
    default:
      return null
  }
}

const downloadPdf = async (report: WeeklyReport) => {
  if (pdfLoading.value) return

  pdfLoading.value = true
  try {
    const blob = await PdfService.downloadWeeklyReportPdf(report.id)
    const filename = PdfService.createPdfFilename(
      report.period_start,
      report.period_end
    )
    PdfService.downloadBlobAsFile(blob, filename)
  } catch (error) {
    console.error('PDF download error:', error)
  } finally {
    pdfLoading.value = false
  }
}

const previewPdf = async (report: WeeklyReport) => {
  if (pdfLoading.value) return

  pdfLoading.value = true
  try {
    const blob = await PdfService.previewWeeklyReportPdf(report.id)
    PdfService.previewBlobInNewTab(blob)
  } catch (error) {
    console.error('PDF preview error:', error)
  } finally {
    pdfLoading.value = false
  }
}



// Lifecycle
onMounted(async () => {
  await loadStatusOptions()
  initializeNewEntry()
  loadReports()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold mb-1">Weekly Accomplishment Reports</h1>
        <p class="text-base leading-relaxed text-muted-foreground">View and manage your weekly accomplishment reports</p>
      </div>

      <Dialog v-model:open="showAddDialog">
        <DialogTrigger as-child>
          <Button
            class="px-6 py-3 text-base font-medium"
            title="Add New Accomplishment"
          >
            <Plus class="h-4 w-4 mr-2" />
            Add New Accomplishment
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Accomplishment</DialogTitle>
          </DialogHeader>

          <!-- Error Message Display -->
          <div v-if="addEntryError" class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clip-rule="evenodd" />
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-red-800 dark:text-red-400">
                  Unable to add entry
                </h3>
                <div class="mt-2 text-sm text-red-700 dark:text-red-300">
                  {{ addEntryError }}
                </div>
              </div>
            </div>
          </div>

          <form @submit.prevent="addEntry" class="space-y-6">
            <!-- Date Field -->
            <div class="space-y-3">
              <Label for="entry_date" class="text-base font-semibold">Date *</Label>
              <Popover>
                <PopoverTrigger as-child>
                  <Button
                    variant="outline"
                    :class="cn(
                      'w-full justify-start text-left font-normal h-12 px-4 text-base',
                      !selectedEntryDate && 'text-muted-foreground'
                    )"
                  >
                    <CalendarIcon class="mr-3 h-5 w-5" />
                    {{ selectedEntryDate ? df.format(selectedEntryDate.toDate()) : 'Select date' }}
                  </Button>
                </PopoverTrigger>
                <PopoverContent class="w-auto p-0">
                  <Calendar
                    v-model="selectedEntryDate as any"
                    initial-focus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <!-- Project/Activity Field -->
            <div class="space-y-3">
              <Label for="ppa" class="text-base font-semibold">Program/Project/Activity *</Label>
              <Textarea
                id="ppa"
                v-model="newEntry.ppa"
                placeholder="e.g., Client meeting, Training session"
                class="min-h-[80px] px-4 py-3 text-base resize-none"
                required
              />
            </div>

            <!-- Key Results Field -->
            <div class="space-y-3">
              <Label for="kpi" class="text-base font-semibold">KPI(Key Performance Indicator)*</Label>
              <Textarea
                id="kpi"
                v-model="newEntry.kpi"
                placeholder="e.g., Completed 3 projects, Signed new contract worth etc.."
                class="min-h-[80px] px-4 py-3 text-base resize-none"
                required
              />
            </div>

            <!-- Status Section -->
            <div class="space-y-3">
              <Label for="status" class="text-base font-semibold">Status *</Label>
              <div class="flex gap-3">
                <div class="flex-1 max-w-[35%]">
                  <Select v-model="newEntry.status" required>
                    <SelectTrigger class="h-12 px-4 text-base">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem
                        v-for="option in statusOptions"
                        :key="option"
                        :value="option"
                        class="flex items-center gap-2 py-3 text-base"
                      >
                        <span>{{ option }}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex-1 max-w-[65%]">
                  <Input
                    id="status_comment"
                    v-model="newEntry.status_comment"
                    placeholder="e.g., Waiting for approval, On track for Friday"
                    class="h-12 px-4 text-base"
                  />
                  <Label for="status_comment" class="text-xs text-muted-foreground mt-1">Status notes (optional)</Label>
                </div>
              </div>
            </div>

            <!-- Remarks Field -->
            <div class="space-y-3">
              <Label for="remarks" class="text-base font-semibold">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                v-model="newEntry.remarks"
                placeholder="Additional context, notes, or next steps"
                class="min-h-[80px] px-4 py-3 text-base resize-none"
              />
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                @click="showAddDialog = false; addEntryError = ''"
                class="h-12 px-6 text-base font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                :disabled="!newEntry.ppa || !newEntry.kpi || !newEntry.status"
                class="h-12 px-6 text-base font-medium bg-primary hover:bg-primary/90"
              >
                Add New Accomplishment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
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
          <Table class="w-full min-w-[800px]">
          <TableHeader>
            <TableRow class="h-12 border-b-2 border-border">
              <TableHead class="w-1/3 text-base font-semibold text-left">Period</TableHead>
              <TableHead class="w-1/6 text-base font-semibold text-left">Submitted</TableHead>
              <TableHead class="w-16 text-base font-semibold text-left">Entries</TableHead>
              <TableHead class="w-20 text-base font-semibold text-left">Status</TableHead>
              <TableHead class="w-1/4 text-base font-semibold text-left">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="loading">
              <TableRow v-for="i in 5" :key="`skeleton-${i}`">
                <TableCell>
                  <Skeleton class="h-4 w-40" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-5 w-8 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton class="h-6 w-16 rounded-md" />
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
              <TableCell colspan="5" class="text-center py-12 text-muted-foreground">
                <div class="flex flex-col items-center space-y-3">
                  <div class="text-4xl">📊</div>
                  <div class="text-base font-medium">No weekly reports found</div>
                  <div class="text-sm text-muted-foreground/70">Create your first report by adding entries in Daily Entries and saving them as a weekly report</div>
                </div>
              </TableCell>
            </TableRow>
            <TableRow
              v-else
              v-for="(report, index) in filteredReports"
              :key="report.id"
              @click="navigateToDailyEntries(report)"
              :class="cn(
                'cursor-pointer hover:bg-muted/50 h-12 border-b border-border',
                index % 2 === 1 ? 'bg-muted/25' : 'bg-background'
              )"
            >
              <TableCell class="font-medium text-base py-2 px-3">
                {{ formatDate(report.period_start) }} - {{ formatDate(report.period_end) }}
              </TableCell>
              <TableCell class="text-base py-2 px-3">
                {{ report.submitted_at ? formatDate(report.submitted_at) : '-' }}
              </TableCell>
              <TableCell class="py-2 px-3">
                <Badge variant="outline">{{ report.entries_count || 0 }}</Badge>
              </TableCell>
              <TableCell class="py-2 px-3">
                <span
                  :class="[
                    'inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium border',
                    report.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                      : report.status === 'submitted'
                      ? 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
                  ]"
                >
                  <component v-if="getStatusIcon(report.status)" :is="getStatusIcon(report.status)" class="h-3 w-3" />
                  {{ report.status }}
                </span>
              </TableCell>
              <TableCell @click.stop class="py-2 px-3">
                <div class="flex items-center gap-2">
                  <Button
                    @click="report.status === 'draft' ? showSubmitConfirmation(report.id) : undefined"
                    variant="ghost"
                    size="sm"
                    :class="[
                      'w-24 justify-start',
                      report.status === 'draft'
                        ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/10'
                        : 'text-green-500 cursor-default'
                    ]"
                    :disabled="report.status !== 'draft'"
                  >
                    <CheckCircle class="h-4 w-4 mr-1" />
                    {{ report.status === 'draft' ? 'Submit' : 'Submitted' }}
                  </Button>


                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <Button variant="ghost" size="sm" class="flex items-center gap-1 px-3 py-1 h-8 ml-2">
                        <FileText class="h-4 w-4" />
                        <span class="text-xs">PDF</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem @click="previewPdf(report)" :disabled="pdfLoading">
                        <FileText class="mr-2 h-4 w-4" />
                        Preview PDF
                      </DropdownMenuItem>

                      <DropdownMenuItem @click="downloadPdf(report)" :disabled="pdfLoading">
                        <FileDown class="mr-2 h-4 w-4" />
                        Download PDF
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>


    <!-- Submit Confirmation Dialog -->
    <AlertDialog v-model:open="showSubmitConfirmDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Submit Weekly Report</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to submit this weekly report? Once submitted, you will not be able to make changes to this report. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel @click="showSubmitConfirmDialog = false">Cancel</AlertDialogCancel>
          <AlertDialogAction @click="confirmSubmit">Yes, Submit Report</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

  </div>
</template>

<style scoped>
/* Custom styles if needed */
</style>