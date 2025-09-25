<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { format, parseISO, startOfWeek, startOfDay, endOfDay } from 'date-fns'
import { CalendarDate, DateFormatter, getLocalTimeZone, fromDate } from '@internationalized/date'
import { useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { entriesService } from '@/services/entries'
import { weeklyReportsService } from '@/services/weeklyReports'
import { enumsService } from '@/services/enums'
import { PdfService } from '@/services/pdfService'
import type { Entry, CreateEntryData, EntryFilters, PaginatedEntries } from '@/types/entry'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Calendar as CalendarIcon, Edit, Trash2, Check, Clock, AlertTriangle, ClipboardList, Loader2, FileText } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'

const authStore = useAuthStore()
const route = useRoute()

// Date formatter
const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// State
const entries = ref<Entry[]>([])
const pagination = ref<PaginatedEntries | null>(null)
const loading = ref(false)
const statusOptions = ref<string[]>([])
const loadingStatusOptions = ref(false)
const searchQuery = ref('')
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showConfirmDialog = ref(false)
const showDeleteConfirmDialog = ref(false)
const showViewDialog = ref(false)
const selectedEntry = ref<Entry | null>(null)
const selectedEntryDate = ref(fromDate(new Date(), getLocalTimeZone()))
const editingEntry = ref<Entry | null>(null)
const pendingUpdateData = ref<any>(null)
const pendingDeleteId = ref<number | null>(null)
const savingToWeeklyReport = ref(false)
const selectedDateRange = ref({
  start: new CalendarDate(2025, 9, 1),
  end: new CalendarDate(2025, 9, 17)
})

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

const editEntry = reactive<Partial<Entry>>({
  ppa: '',
  kpi: '',
  status: '',
  status_comment: '',
  remarks: ''
})

// Filters
const filters = reactive<EntryFilters>({
  per_page: 15
})

// Computed
const filteredEntries = computed(() => {
  if (!searchQuery.value) return entries.value
  return entries.value.filter(entry =>
    entry.ppa.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    entry.kpi.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    entry.status.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const dateRangeText = computed(() => {
  if (selectedDateRange.value?.start) {
    if (selectedDateRange.value?.end) {
      const startDate = selectedDateRange.value.start.toDate(getLocalTimeZone())
      const endDate = selectedDateRange.value.end.toDate(getLocalTimeZone())

      // Check if it's a weekdays selection (Mon-Fri)
      if (isWeekdaysSelection(startDate, endDate)) {
        const startMonth = startDate.toLocaleString('en-US', { month: 'long' })
        const startDay = startDate.getDate()
        const endDay = endDate.getDate()
        const year = startDate.getFullYear()
        return `Week of ${startMonth} ${startDay}-${endDay}, ${year}`
      }

      return `${df.format(startDate)} - ${df.format(endDate)}`
    }
    return df.format(selectedDateRange.value.start.toDate(getLocalTimeZone()))
  }
  return 'Select weekdays'
})

const currentWeekSelection = computed(() => {
  if (!selectedDateRange.value?.start || !selectedDateRange.value?.end) {
    return null
  }

  const startDate = selectedDateRange.value.start.toDate(getLocalTimeZone())
  const endDate = selectedDateRange.value.end.toDate(getLocalTimeZone())

  // Check if it's a weekdays selection (Mon-Fri)
  if (isWeekdaysSelection(startDate, endDate)) {
    const currentWeek = getWeekdayRange(new Date())
    const lastWeek = getWeekdayRange(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
    const nextWeek = getWeekdayRange(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))

    // Compare dates
    if (startOfDay(startDate).getTime() === startOfDay(currentWeek.start).getTime()) {
      return 'current'
    } else if (startOfDay(startDate).getTime() === startOfDay(lastWeek.start).getTime()) {
      return 'last'
    } else if (startOfDay(startDate).getTime() === startOfDay(nextWeek.start).getTime()) {
      return 'next'
    }
  }

  return null
})

const formattedSelectedEntryDate = computed(() => {
  if (!selectedEntry.value?.entry_date) return ''
  const date = parseISO(selectedEntry.value.entry_date)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  const formattedDate = format(date, 'MMMM dd, yyyy')
  return `${dayName}, ${formattedDate}`
})

// Helper function to check if an entry belongs to a submitted weekly report
const isEntryFromSubmittedReport = (entry: Entry) => {
  return entry.weekly_report?.status === 'submitted'
}

// Check if any entries in current view are from submitted reports
const hasSubmittedEntries = computed(() => {
  return filteredEntries.value.some(entry => isEntryFromSubmittedReport(entry))
})


// Helper function to check if selection is weekdays only (Mon-Fri)
const isWeekdaysSelection = (start: Date, end: Date) => {
  const weekStart = startOfWeek(start, { weekStartsOn: 1 }) // Monday
  const weekdayEnd = new Date(weekStart)
  weekdayEnd.setDate(weekdayEnd.getDate() + 4) // Friday

  return startOfDay(start).getTime() === startOfDay(weekStart).getTime() &&
         endOfDay(end).getTime() === endOfDay(weekdayEnd).getTime()
}

// Helper function to get weekday range (Mon-Fri) for a given date
const getWeekdayRange = (date: Date) => {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }) // Monday
  const weekdayEnd = new Date(weekStart)
  weekdayEnd.setDate(weekdayEnd.getDate() + 4) // Friday

  return { start: weekStart, end: weekdayEnd }
}

// Initialize selectedDateRange with current weekdays
const getCurrentWeekdayRange = () => {
  const { start: weekdayStart, end: weekdayEnd } = getWeekdayRange(new Date())
  return {
    start: new CalendarDate(weekdayStart.getFullYear(), weekdayStart.getMonth() + 1, weekdayStart.getDate()),
    end: new CalendarDate(weekdayEnd.getFullYear(), weekdayEnd.getMonth() + 1, weekdayEnd.getDate())
  }
}

// Set initial date range to current weekdays (will be overridden by query params if present)
selectedDateRange.value = getCurrentWeekdayRange()

// Helper function to set date range from query parameters
const setDateRangeFromQuery = () => {
  const startDate = route.query.start_date as string
  const endDate = route.query.end_date as string

  if (startDate && endDate) {
    try {
      const start = parseISO(startDate)
      const end = parseISO(endDate)

      selectedDateRange.value = {
        start: new CalendarDate(start.getFullYear(), start.getMonth() + 1, start.getDate()),
        end: new CalendarDate(end.getFullYear(), end.getMonth() + 1, end.getDate())
      }
    } catch (error) {
      console.error('Invalid date format in query parameters:', error)
      // Keep default date range if query parameters are invalid
    }
  }
}

// Methods
const loadStatusOptions = async () => {
  loadingStatusOptions.value = true
  try {
    const response = await enumsService.getStatusOptions()
    if (response.success) {
      statusOptions.value = response.data
    }
  } catch (error) {
    console.error('Failed to load status options:', error)
    // Fallback to hardcoded values if API fails
    statusOptions.value = ['Accomplished', 'In Progress', 'Delayed', 'Others']
  } finally {
    loadingStatusOptions.value = false
  }
}

const loadEntries = async () => {
  loading.value = true
  try {
    // Set employee_id filter to current user
    const currentFilters = {
      ...filters,
      employee_id: authStore.user?.employee_id || authStore.user?.id?.toString()
    }

    if (selectedDateRange.value?.start && selectedDateRange.value?.end) {
      currentFilters.date_from = format(selectedDateRange.value.start.toDate(getLocalTimeZone()), 'yyyy-MM-dd')
      currentFilters.date_to = format(selectedDateRange.value.end.toDate(getLocalTimeZone()), 'yyyy-MM-dd')
    }

    const response = await entriesService.getEntries(currentFilters)
    if (response.success) {
      pagination.value = response.data
      entries.value = response.data.data
    }
  } catch (error) {
    console.error('Failed to load entries:', error)
  } finally {
    loading.value = false
  }
}

const addEntry = async () => {
  try {
    // Set employee_id to current user
    newEntry.employee_id = authStore.user?.employee_id || authStore.user?.id?.toString() || ''

    // Convert calendar date to string format for API
    newEntry.entry_date = format(selectedEntryDate.value!.toDate(), 'yyyy-MM-dd')

    const response = await entriesService.createEntry(newEntry)
    if (response.success) {
      showAddDialog.value = false
      resetForm()
      await loadEntries()
    }
  } catch (error) {
    console.error('Failed to create entry:', error)
  }
}

const deleteEntry = (id: number) => {
  pendingDeleteId.value = id
  showDeleteConfirmDialog.value = true
}

const confirmDelete = async () => {
  if (pendingDeleteId.value === null) return

  try {
    const response = await entriesService.deleteEntry(pendingDeleteId.value)
    if (response.success) {
      showDeleteConfirmDialog.value = false
      pendingDeleteId.value = null
      await loadEntries()
    }
  } catch (error) {
    console.error('Failed to delete entry:', error)
  }
}

const viewEntry = (entry: Entry) => {
  selectedEntry.value = entry
  showViewDialog.value = true
}

const openEditDialog = (entry: Entry) => {
  editingEntry.value = entry
  Object.assign(editEntry, {
    ppa: entry.ppa,
    kpi: entry.kpi,
    status: entry.status,
    status_comment: entry.status_comment || '',
    remarks: entry.remarks || ''
  })
  showEditDialog.value = true
}

const updateEntry = async () => {
  if (!editingEntry.value) return

  pendingUpdateData.value = { ...editEntry }
  showConfirmDialog.value = true
}

const confirmUpdate = async () => {
  if (!editingEntry.value || !pendingUpdateData.value) return

  try {
    const response = await entriesService.updateEntry(editingEntry.value.id, pendingUpdateData.value)
    if (response.success) {
      showConfirmDialog.value = false
      showEditDialog.value = false
      resetEditForm()
      await loadEntries()
    }
  } catch (error) {
    console.error('Failed to update entry:', error)
  }
}

const resetEditForm = () => {
  editingEntry.value = null
  pendingUpdateData.value = null
  Object.assign(editEntry, {
    ppa: '',
    kpi: '',
    status: '',
    status_comment: '',
    remarks: ''
  })
}

const resetForm = () => {
  selectedEntryDate.value = fromDate(new Date(), getLocalTimeZone())
  Object.assign(newEntry, {
    employee_id: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    ppa: '',
    kpi: '',
    status: 'In Progress',
    status_comment: '',
    remarks: ''
  })
}

const formatDate = (dateString: string) => {
  return format(parseISO(dateString), 'MMM dd, yyyy')
}

const getStatusColorClasses = (status: string) => {
  switch (status) {
    case 'Accomplished':
      return 'bg-green-100 text-green-900 border border-green-300 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
    case 'In Progress':
      return 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800'
    case 'Delayed':
      return 'bg-red-100 text-red-900 border border-red-300 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
    case 'Others':
      return 'bg-gray-100 text-gray-900 border border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600'
    default:
      return 'bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' // fallback
  }
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Accomplished':
      return Check
    case 'In Progress':
      return Clock
    case 'Delayed':
      return AlertTriangle
    case 'Planning':
      return ClipboardList
    default:
      return null
  }
}

// Set default status to "In Progress" when component mounts
const initializeNewEntry = () => {
  newEntry.status = 'In Progress'
}

const handleDateRangeSelect = (range: any) => {
  selectedDateRange.value = range
  if (range?.start && range?.end) {
    loadEntries()
  }
}

// Weekday selection helpers
const selectWeekdays = (date: Date) => {
  const { start: weekdayStart, end: weekdayEnd } = getWeekdayRange(date)

  selectedDateRange.value = {
    start: new CalendarDate(weekdayStart.getFullYear(), weekdayStart.getMonth() + 1, weekdayStart.getDate()),
    end: new CalendarDate(weekdayEnd.getFullYear(), weekdayEnd.getMonth() + 1, weekdayEnd.getDate())
  }

  loadEntries()
}

// Quick weekday selection presets
const selectCurrentWeekdays = () => {
  selectWeekdays(new Date())
}

const selectLastWeekdays = () => {
  const lastWeek = new Date()
  lastWeek.setDate(lastWeek.getDate() - 7)
  selectWeekdays(lastWeek)
}

const selectNextWeekdays = () => {
  const nextWeek = new Date()
  nextWeek.setDate(nextWeek.getDate() + 7)
  selectWeekdays(nextWeek)
}


const saveToWeeklyReport = async () => {
  if (filteredEntries.value.length === 0) {
    alert('No entries found in the current date range to save to weekly report.')
    return
  }

  // Check if any entries are from submitted reports
  const submittedEntries = filteredEntries.value.filter(entry => isEntryFromSubmittedReport(entry))
  if (submittedEntries.length > 0) {
    alert('Cannot modify weekly reports. Some entries in the current selection are already part of submitted weekly reports.')
    return
  }

  if (savingToWeeklyReport.value) {
    return // Prevent multiple clicks
  }

  savingToWeeklyReport.value = true
  try {
    await confirmSaveToWeeklyReport()
  } finally {
    savingToWeeklyReport.value = false
  }
}

const confirmSaveToWeeklyReport = async () => {
  try {
    const entryIds = filteredEntries.value.map(entry => entry.id)
    const startDate = selectedDateRange.value?.start?.toDate(getLocalTimeZone())
    const endDate = selectedDateRange.value?.end?.toDate(getLocalTimeZone())

    if (!startDate || !endDate) {
      alert('Please select a valid date range.')
      return
    }

    // Check if any entries are already assigned to a weekly report
    const assignedEntries = filteredEntries.value.filter(entry => entry.weekly_report_id)

    if (assignedEntries.length > 0) {
      // If entries are already assigned, update the existing weekly report
      const existingReportId = assignedEntries[0].weekly_report_id

      try {
        // Update the existing weekly report with all entries from the current date range
        const response = await weeklyReportsService.updateWeeklyReport(existingReportId!, {
          entry_ids: entryIds
        })

        if (response.success) {
          // Preview PDF after successful update
          try {
            const blob = await PdfService.previewWeeklyReportPdf(existingReportId!)
            PdfService.previewBlobInNewTab(blob)
          } catch (pdfError) {
            console.error('Failed to preview updated PDF:', pdfError)
            alert('Weekly report updated, but failed to preview PDF. You can access it from the Weekly Reports page.')
          }

          await loadEntries() // Reload to show updated entries
        } else {
          alert('Failed to update weekly report. Please try again.')
        }
      } catch (updateError) {
        console.error('Failed to update existing weekly report:', updateError)
        alert('Failed to update the existing weekly report. Please try again.')
      }
      return
    }

    // If no entries are assigned, create a new weekly report
    const response = await weeklyReportsService.createWeeklyReport({
      entry_ids: entryIds,
      period_start: format(startDate, 'yyyy-MM-dd'),
      period_end: format(endDate, 'yyyy-MM-dd')
    })

    if (response.success) {
      // Preview PDF after successful creation using PdfService
      const weeklyReportId = response.data.id
      if (weeklyReportId) {
        try {
          const blob = await PdfService.previewWeeklyReportPdf(weeklyReportId)
          PdfService.previewBlobInNewTab(blob)
        } catch (pdfError) {
          console.error('Failed to preview PDF:', pdfError)
          alert('Weekly report created, but failed to preview PDF. You can access it from the Weekly Reports page.')
        }
      }

      await loadEntries() // Reload to show updated entries with weekly_report_id
    } else {
      alert('Failed to create weekly report. Please try again.')
    }
  } catch (error) {
    console.error('Failed to save to weekly report:', error)
    alert('An error occurred while creating the weekly report. Please try again.')
  }
}

// Lifecycle
onMounted(async () => {
  // Check for query parameters first
  setDateRangeFromQuery()

  await loadStatusOptions()
  initializeNewEntry()
  loadEntries()
})

// Watch for query parameter changes
watch(() => route.query, () => {
  setDateRangeFromQuery()
  loadEntries()
}, { deep: true })
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-lg font-semibold mb-1">Weekly Entries</h1>
        <p class="text-base leading-relaxed text-muted-foreground">Track your weekly accomplishments by adding entries below</p>
      </div>

      <Dialog v-model:open="showAddDialog">
        <DialogTrigger as-child>
          <Button
            class="px-6 py-3 text-base font-medium"
            :class="hasSubmittedEntries
              ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
              : ''"
            :disabled="hasSubmittedEntries"
            :title="hasSubmittedEntries
              ? 'Cannot add entries when viewing date range with submitted reports'
              : 'Add New Accomplishment'"
          >
            <Plus class="h-4 w-4 mr-2" />
            Add New Accomplishment
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Add New Accomplishment</DialogTitle>
          </DialogHeader>
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
                        <component v-if="getStatusIcon(option)" :is="getStatusIcon(option)" class="h-4 w-4" />
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
                @click="showAddDialog = false"
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

      <!-- Edit Entry Dialog -->
      <Dialog v-model:open="showEditDialog">
        <DialogContent class="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Accomplishment</DialogTitle>
          </DialogHeader>
          <form @submit.prevent="updateEntry" class="space-y-6">
            <!-- Date Field (Read-only) -->
            <div class="space-y-3">
              <Label class="text-base font-semibold">Entry Date</Label>
              <div class="px-4 py-3 bg-muted rounded-md text-base text-muted-foreground h-12 flex items-center">
                {{ editingEntry ? formatDate(editingEntry.entry_date) : '' }}
              </div>
            </div>

            <!-- Project/Activity Field -->
            <div class="space-y-3">
              <Label for="edit_ppa" class="text-base font-semibold">Program/Project/Activity *</Label>
              <Textarea
                id="edit_ppa"
                v-model="editEntry.ppa"
                placeholder="e.g., Website redesign, Client meeting, Training session"
                class="min-h-[80px] px-4 py-3 text-base resize-none"
                required
              />
            </div>

            <!-- Key Results Field -->
            <div class="space-y-3">
              <Label for="edit_kpi" class="text-base font-semibold">Key Results *</Label>
              <Textarea
                id="edit_kpi"
                v-model="editEntry.kpi"
                placeholder="e.g., Completed 3 wireframes, Signed new contract worth $50k"
                class="min-h-[80px] px-4 py-3 text-base resize-none"
                required
              />
            </div>

            <!-- Status Section -->
            <div class="space-y-3">
              <Label for="edit_status" class="text-base font-semibold">Status *</Label>
              <div class="flex gap-3">
                <div class="flex-1 max-w-[35%]">
                  <Select v-model="editEntry.status" required>
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
                        <component v-if="getStatusIcon(option)" :is="getStatusIcon(option)" class="h-4 w-4" />
                        <span>{{ option }}</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex-1 max-w-[65%]">
                  <Input
                    id="edit_status_comment"
                    v-model="editEntry.status_comment"
                    placeholder="e.g., Waiting for approval, On track for Friday"
                    class="h-12 px-4 text-base"
                  />
                  <Label for="edit_status_comment" class="text-xs text-muted-foreground mt-1">Status notes (optional)</Label>
                </div>
              </div>
            </div>

            <!-- Remarks Field -->
            <div class="space-y-3">
              <Label for="edit_remarks" class="text-base font-semibold">Remarks (Optional)</Label>
              <Textarea
                id="edit_remarks"
                v-model="editEntry.remarks"
                placeholder="Additional context, notes, or next steps"
                class="min-h-[80px] px-4 py-3 text-base resize-none"
              />
            </div>

            <!-- Action Buttons -->
            <div class="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                @click="showEditDialog = false"
                class="h-12 px-6 text-base font-medium"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                :disabled="!editEntry.ppa || !editEntry.kpi || !editEntry.status"
                class="h-12 px-6 text-base font-medium bg-primary hover:bg-primary/90"
              >
                Update Accomplishment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <!-- Confirmation Dialog -->
      <Dialog v-model:open="showConfirmDialog">
        <DialogContent class="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Update</DialogTitle>
          </DialogHeader>
          <div class="py-4">
            <p class="text-sm text-muted-foreground">
              Are you sure you want to update this entry? This action cannot be undone.
            </p>
          </div>
          <div class="flex justify-end space-x-2">
            <Button type="button" variant="outline" @click="showConfirmDialog = false">
              Cancel
            </Button>
            <Button type="button" @click="confirmUpdate">
              Yes, Update
            </Button>
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
              Are you sure you want to delete this entry? This action cannot be undone.
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

      <!-- View Entry Dialog -->
      <Dialog v-model:open="showViewDialog">
        <DialogContent class="sm:max-w-[800px] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader class="pb-6 border-b">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <FileText class="h-6 w-6 text-primary" />
                <div>
                  <DialogTitle v-if="selectedEntry" class="text-xl font-bold text-foreground">
                    Entry Details
                  </DialogTitle>
                  <p v-if="selectedEntry" class="text-base text-muted-foreground mt-1 flex items-center gap-2">
                    <CalendarIcon class="h-4 w-4" />
                    {{ formattedSelectedEntryDate }}
                  </p>
                </div>
              </div>
              <div v-if="selectedEntry" class="flex items-center">
                <span :class="cn('inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold', getStatusColorClasses(selectedEntry.status))">
                  <component v-if="getStatusIcon(selectedEntry.status)" :is="getStatusIcon(selectedEntry.status)" class="h-4 w-4" />
                  {{ selectedEntry.status }}
                  <span v-if="selectedEntry.status_comment" class="text-xs opacity-75">
                    • {{ selectedEntry.status_comment }}
                  </span>
                </span>
              </div>
            </div>
          </DialogHeader>
          <div class="flex-1 overflow-auto pt-6">
            <div v-if="selectedEntry" class="space-y-8 px-1">

              <!-- Project/Activity Section -->
              <div class="space-y-4 pb-6 border-b border-border/50">
                <Label class="text-base font-semibold text-foreground">
                  PPA(Program/Project/Activity)
                </Label>
                <div class="p-4 bg-card border rounded-lg whitespace-pre-wrap text-base leading-relaxed shadow-sm">
                  {{ selectedEntry.ppa }}
                </div>
              </div>

              <!-- Key Results Section -->
              <div class="space-y-4 pb-6 border-b border-border/50">
                <Label class="text-base font-semibold text-foreground">
                  KPI(Key Performance Indicator)
                </Label>
                <div class="p-4 bg-card border rounded-lg whitespace-pre-wrap text-base leading-relaxed shadow-sm">
                  {{ selectedEntry.kpi }}
                </div>
              </div>

              <!-- Remarks Section -->
              <div class="space-y-4 pb-4">
                <Label class="text-base font-semibold text-foreground">
                  Remarks
                </Label>
                <div class="p-4 bg-card border rounded-lg whitespace-pre-wrap text-base leading-relaxed shadow-sm">
                  <span v-if="selectedEntry.remarks">{{ selectedEntry.remarks }}</span>
                  <span v-else class="text-muted-foreground italic">No remarks provided</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>

    <!-- Filters and Search -->
    <div class="flex items-center space-x-4">
      <div class="relative flex-1 max-w-sm">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          v-model="searchQuery"
          placeholder="Search reports..."
          class="pl-10"
        />
      </div>

      <div class="flex items-center space-x-2">
        <Popover>
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              :class="cn(
                'min-w-[280px] justify-start text-left font-normal',
                !selectedDateRange && 'text-muted-foreground',
              )"
            >
              <CalendarIcon class="mr-2 h-4 w-4" />
              {{ dateRangeText }}
            </Button>
          </PopoverTrigger>
        <PopoverContent class="w-auto p-0">
          <div class="p-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm font-semibold text-green-900">Quick Selection</span>
            </div>

            <!-- Quick weekday selection buttons -->
            <div class="grid grid-cols-3 gap-2">
              <Button
                :variant="currentWeekSelection === 'last' ? 'default' : 'outline'"
                size="sm"
                @click="selectLastWeekdays"
                :class="currentWeekSelection === 'last'
                  ? 'text-xs font-medium bg-green-600 hover:bg-green-700 shadow-md transform hover:scale-105 transition-all duration-200'
                  : 'text-xs font-medium border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm'"
              >
                Last Week
              </Button>
              <Button
                :variant="currentWeekSelection === 'current' ? 'default' : 'outline'"
                size="sm"
                @click="selectCurrentWeekdays"
                :class="currentWeekSelection === 'current'
                  ? 'text-xs font-medium bg-green-600 hover:bg-green-700 shadow-md transform hover:scale-105 transition-all duration-200'
                  : 'text-xs font-medium border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm'"
              >
                This Week
              </Button>
              <Button
                :variant="currentWeekSelection === 'next' ? 'default' : 'outline'"
                size="sm"
                @click="selectNextWeekdays"
                :class="currentWeekSelection === 'next'
                  ? 'text-xs font-medium bg-green-600 hover:bg-green-700 shadow-md transform hover:scale-105 transition-all duration-200'
                  : 'text-xs font-medium border-green-200 hover:bg-green-100 hover:border-green-300 transition-all duration-200 shadow-sm'"
              >
                Next Week
              </Button>
            </div>
          </div>
          <div class="weekday-calendar">
            <RangeCalendar
              v-model="selectedDateRange as any"
              initial-focus
              :number-of-months="2"
              @update:model-value="handleDateRangeSelect"
            />
          </div>
          <div class="p-3 border-t text-xs text-muted-foreground">
            💡 Click any day to select weekdays only (Monday-Friday)
          </div>
        </PopoverContent>
        </Popover>
      </div>



      <div class="flex items-center space-x-4">
        <Button
          @click="saveToWeeklyReport"
          :disabled="filteredEntries.length === 0 || savingToWeeklyReport || hasSubmittedEntries"
          :class="hasSubmittedEntries
            ? 'bg-gray-400 hover:bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700'"
          :title="hasSubmittedEntries
            ? 'Cannot modify weekly reports containing entries from submitted reports'
            : 'Save entries to weekly report'"
        >
          <Loader2 v-if="savingToWeeklyReport" class="h-4 w-4 mr-2 animate-spin" />
          {{ savingToWeeklyReport ? 'Processing...' : 'Save & Generate Weekly Report PDF' }}
        </Button>

        <div v-if="hasSubmittedEntries" class="text-sm text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-3 py-1 rounded-md border border-blue-200 dark:border-blue-800">
          📋 This report has already been submitted
        </div>
      </div>
    </div>

    <!-- Main Content Grid -->
    <div class="w-full">
      <!-- Entries Table -->
      <Card>
        <CardContent class="p-0">
          <div class="overflow-x-auto">
            <Table class="w-full min-w-[800px]">
            <TableHeader>
              <TableRow class="h-12 border-b-2 border-border">
                <TableHead class="w-24 text-base font-semibold text-left">Date</TableHead>
                <TableHead class="w-1/3 text-base font-semibold text-left">PPA(Program/Project/Activity)</TableHead>
                <TableHead class="w-1/3 text-base font-semibold text-left">KPI(Key Performance Indicator)</TableHead>
                <TableHead class="w-20 text-base font-semibold text-left">Status</TableHead>
                <TableHead class="w-1/6 text-base font-semibold text-left">Remarks</TableHead>
                <TableHead class="w-20 text-base font-semibold text-left">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="loading">
                <TableRow v-for="i in 5" :key="`skeleton-${i}`">
                  <TableCell>
                    <Skeleton class="h-4 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton class="h-4 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton class="h-4 w-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton class="h-6 w-16 rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton class="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <div class="flex items-center space-x-1">
                      <Skeleton class="h-6 w-6 rounded" />
                      <Skeleton class="h-6 w-6 rounded" />
                    </div>
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else-if="filteredEntries.length === 0">
                <TableCell colspan="6" class="text-center py-12 text-muted-foreground">
                  <div class="flex flex-col items-center space-y-3">
                    <div class="text-4xl">📝</div>
                    <div class="text-base font-medium">No accomplishment entries found</div>
                    <div class="text-sm text-muted-foreground/70">Create your first entry by clicking the "Add New Accomplishment" button above</div>
                  </div>
                </TableCell>
              </TableRow>
              <TableRow
                v-else
                v-for="(entry, index) in filteredEntries"
                :key="entry.id"
                @click="viewEntry(entry)"
                :class="cn(
                  'cursor-pointer hover:bg-muted/50 h-12 border-b border-border',
                  index % 2 === 1 ? 'bg-muted/25' : 'bg-background',
                  isEntryFromSubmittedReport(entry) ? 'bg-gray-50/50 dark:bg-gray-900/20' : ''
                )"
              >
                <TableCell class="font-medium text-base py-2 px-3">
                  {{ formatDate(entry.entry_date) }}
                </TableCell>
                <TableCell class="max-w-0 text-base py-2 px-3">
                  <HoverCard :open-delay="100" :close-delay="100">
                    <HoverCardTrigger as-child>
                      <div class="truncate cursor-pointer" :title="entry.ppa">
                        {{ entry.ppa }}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent class="w-96" side="top">
                      <div class="space-y-2">
                        <h4 class="text-sm font-semibold">Program/Project/Activity</h4>
                        <p class="text-sm text-muted-foreground">
                          {{ entry.ppa }}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell class="max-w-0 text-base py-2 px-3">
                  <HoverCard :open-delay="100" :close-delay="100">
                    <HoverCardTrigger as-child>
                      <div class="truncate cursor-pointer" :title="entry.kpi">
                        {{ entry.kpi }}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent class="w-96" side="top">
                      <div class="space-y-2">
                        <h4 class="text-sm font-semibold">KPI(Key Performance Indicator)</h4>
                        <p class="text-sm text-muted-foreground">
                          {{ entry.kpi }}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                </TableCell>
                <TableCell class="py-2 px-3">
                  <HoverCard v-if="entry.status_comment" :open-delay="100" :close-delay="100">
                    <HoverCardTrigger as-child>
                      <span :class="cn('inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium cursor-pointer', getStatusColorClasses(entry.status))">
                        <component v-if="getStatusIcon(entry.status)" :is="getStatusIcon(entry.status)" class="h-3 w-3" />
                        {{ entry.status }}
                      </span>
                    </HoverCardTrigger>
                    <HoverCardContent class="w-80" side="top">
                      <div class="space-y-2">
                        <h4 class="text-sm font-semibold">Status Comment</h4>
                        <p class="text-sm text-muted-foreground">
                          {{ entry.status_comment }}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <span v-else :class="cn('inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium', getStatusColorClasses(entry.status))">
                    <component v-if="getStatusIcon(entry.status)" :is="getStatusIcon(entry.status)" class="h-3 w-3" />
                    {{ entry.status }}
                  </span>
                </TableCell>
                <TableCell class="max-w-0 text-base py-2 px-3">
                  <HoverCard v-if="entry.remarks" :open-delay="100" :close-delay="100">
                    <HoverCardTrigger as-child>
                      <div class="truncate cursor-pointer" :title="entry.remarks">
                        {{ entry.remarks }}
                      </div>
                    </HoverCardTrigger>
                    <HoverCardContent class="w-96" side="top">
                      <div class="space-y-2">
                        <h4 class="text-sm font-semibold">Remarks</h4>
                        <p class="text-sm text-muted-foreground">
                          {{ entry.remarks }}
                        </p>
                      </div>
                    </HoverCardContent>
                  </HoverCard>
                  <span v-else class="text-muted-foreground">-</span>
                </TableCell>
                <TableCell @click.stop class="py-2 px-3">
                  <div class="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2"
                      :class="isEntryFromSubmittedReport(entry)
                        ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                        : 'hover:bg-accent'"
                      :disabled="isEntryFromSubmittedReport(entry)"
                      @click="openEditDialog(entry)"
                      :title="isEntryFromSubmittedReport(entry)
                        ? 'Cannot edit entries from submitted weekly reports'
                        : 'Edit entry'"
                    >
                      <Edit class="h-4 w-4 mr-1" />
                      <span class="text-xs">Edit</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      class="h-8 px-2"
                      :class="isEntryFromSubmittedReport(entry)
                        ? 'opacity-50 cursor-not-allowed text-muted-foreground'
                        : 'hover:bg-destructive/10 text-destructive hover:text-destructive'"
                      :disabled="isEntryFromSubmittedReport(entry)"
                      @click="deleteEntry(entry.id)"
                      :title="isEntryFromSubmittedReport(entry)
                        ? 'Cannot delete entries from submitted weekly reports'
                        : 'Delete entry'"
                    >
                      <Trash2 class="h-4 w-4 mr-1" />
                      <span class="text-xs">Delete</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Weekday calendar styling */
.weekday-calendar :deep(.reka-calendar-cell) {
  position: relative;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

/* Weekday hover effect - highlight Monday through Friday */
.weekday-calendar :deep(.reka-calendar-cell:hover) {
  background-color: rgba(34, 197, 94, 0.1);
}

/* Selected weekday range styling */
.weekday-calendar :deep(.reka-calendar-cell[data-selected="true"]) {
  background-color: rgba(34, 197, 94, 0.2);
}

/* Weekday range highlight effect */
.weekday-calendar :deep(.reka-calendar-cell.weekday-range) {
  background-color: rgba(34, 197, 94, 0.15);
  border-radius: 0;
}

.weekday-calendar :deep(.reka-calendar-cell.weekday-range:first-child) {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.weekday-calendar :deep(.reka-calendar-cell.weekday-range:last-child) {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
</style>