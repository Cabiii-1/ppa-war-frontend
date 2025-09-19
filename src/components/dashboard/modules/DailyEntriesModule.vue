<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { format, parseISO, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns'
import { CalendarDate, DateFormatter, getLocalTimeZone, fromDate, toCalendarDate } from '@internationalized/date'
import type { DateRange, DateValue } from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import { entriesService } from '@/services/entries'
import { weeklyReportsService } from '@/services/weeklyReports'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Filter, Calendar as CalendarIcon, Edit, Trash2 } from 'lucide-vue-next'
import { Skeleton } from '@/components/ui/skeleton'

const authStore = useAuthStore()

// Date formatter
const df = new DateFormatter('en-US', {
  dateStyle: 'medium',
})

// State
const entries = ref<Entry[]>([])
const pagination = ref<PaginatedEntries | null>(null)
const loading = ref(false)
const searchQuery = ref('')
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showConfirmDialog = ref(false)
const showDeleteConfirmDialog = ref(false)
const selectedEntryDate = ref<DateValue>(fromDate(new Date(), getLocalTimeZone()))
const editingEntry = ref<Entry | null>(null)
const pendingUpdateData = ref<any>(null)
const pendingDeleteId = ref<number | null>(null)
const selectedDateRange = ref<DateRange>({
  start: new CalendarDate(2025, 9, 1),
  end: new CalendarDate(2025, 9, 17)
})
const hoveredWeekdays = ref<{ start: Date, end: Date } | null>(null)

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
  if (selectedDateRange.value.start) {
    if (selectedDateRange.value.end) {
      const startDate = selectedDateRange.value.start.toDate(getLocalTimeZone())
      const endDate = selectedDateRange.value.end.toDate(getLocalTimeZone())

      // Check if it's a weekdays selection (Mon-Fri)
      if (isWeekdaysSelection(startDate, endDate)) {
        return `Weekdays of ${df.format(startDate)}`
      }

      return `${df.format(startDate)} - ${df.format(endDate)}`
    }
    return df.format(selectedDateRange.value.start.toDate(getLocalTimeZone()))
  }
  return 'Select weekdays'
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

// Set initial date range to current weekdays
selectedDateRange.value = getCurrentWeekdayRange()

// Methods
const loadEntries = async () => {
  loading.value = true
  try {
    // Set employee_id filter to current user
    const currentFilters = {
      ...filters,
      employee_id: authStore.user?.employee_id || authStore.user?.id?.toString()
    }

    if (selectedDateRange.value.start && selectedDateRange.value.end) {
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
    newEntry.entry_date = format(selectedEntryDate.value.toDate(getLocalTimeZone()), 'yyyy-MM-dd')

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
    status: '',
    status_comment: '',
    remarks: ''
  })
}

const formatDate = (dateString: string) => {
  return format(parseISO(dateString), 'MMM dd, yyyy')
}

const handleDateRangeSelect = (range: DateRange) => {
  selectedDateRange.value = range
  if (range.start && range.end) {
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

// Handle calendar cell hover for weekday highlighting
const handleCalendarCellHover = (date: Date | null) => {
  if (date) {
    const { start: weekdayStart, end: weekdayEnd } = getWeekdayRange(date)
    hoveredWeekdays.value = { start: weekdayStart, end: weekdayEnd }
  } else {
    hoveredWeekdays.value = null
  }
}

// Handle calendar cell click for weekday selection
const handleCalendarCellClick = (date: Date) => {
  selectWeekdays(date)
}

const saveToWeeklyReport = async () => {
  if (filteredEntries.value.length === 0) {
    alert('No entries found in the current date range to save to weekly report.')
    return
  }
  await confirmSaveToWeeklyReport()
}

const confirmSaveToWeeklyReport = async () => {
  try {
    const entryIds = filteredEntries.value.map(entry => entry.id)
    const startDate = selectedDateRange.value.start?.toDate(getLocalTimeZone())
    const endDate = selectedDateRange.value.end?.toDate(getLocalTimeZone())

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
        const response = await weeklyReportsService.updateWeeklyReport(existingReportId, {
          entry_ids: entryIds
        })

        if (response.success) {
          // Preview PDF after successful update
          try {
            const blob = await PdfService.previewWeeklyReportPdf(existingReportId)
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
onMounted(() => {
  loadEntries()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <p class="text-muted-foreground">Manage your daily accomplishment reports</p>
      </div>

      <Dialog v-model:open="showAddDialog">
        <DialogTrigger as-child>
          <Button>
            <Plus class="h-4 w-4 mr-2" />
            Add Entry
          </Button>
        </DialogTrigger>
        <DialogContent class="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Add New Entry</DialogTitle>
          </DialogHeader>
          <form @submit.prevent="addEntry" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label for="entry_date">Date</Label>
                <Popover>
                  <PopoverTrigger as-child>
                    <Button
                      variant="outline"
                      :class="cn(
                        'w-full justify-start text-left font-normal',
                        !selectedEntryDate && 'text-muted-foreground'
                      )"
                    >
                      <CalendarIcon class="mr-2 h-4 w-4" />
                      {{ selectedEntryDate ? df.format(selectedEntryDate.toDate(getLocalTimeZone())) : 'Select date' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar
                      v-model="selectedEntryDate"
                      initial-focus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div class="space-y-2">
                <Label for="remarks">Remarks (Optional)</Label>
                <Textarea
                  id="remarks"
                  v-model="newEntry.remarks"
                  placeholder="Additional notes or comments"
                  class="min-h-[40px]"
                />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="ppa">PPA (Program/Project/Activity)</Label>
              <Textarea
                id="ppa"
                v-model="newEntry.ppa"
                placeholder="Describe the program, project, or activity"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="kpi">KPI (Key Performance Indicator)</Label>
              <Textarea
                id="kpi"
                v-model="newEntry.kpi"
                placeholder="Describe the key performance indicators"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="status">Status</Label>
              <div class="grid grid-cols-3 gap-2">
                <Select v-model="newEntry.status" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                    <SelectItem value="Accomplished">Accomplished</SelectItem>
                    <SelectItem value="Delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
               <Input
                  id="edit_status_comment"
                  v-model="newEntry.status_comment"
                  placeholder="Comment (optional)"
                  class="text-sm col-span-2"
                />
              </div>
            </div>

            <div class="flex justify-end space-x-2">
              <Button type="button" variant="outline" @click="showAddDialog = false">
                Cancel
              </Button>
              <Button type="submit">
                Add Entry
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <!-- Edit Entry Dialog -->
      <Dialog v-model:open="showEditDialog">
        <DialogContent class="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>Edit Entry</DialogTitle>
          </DialogHeader>
          <form @submit.prevent="updateEntry" class="space-y-4">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2">
                <Label>Entry Date</Label>
                <div class="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                  {{ editingEntry ? formatDate(editingEntry.entry_date) : '' }}
                </div>
              </div>
              <div class="space-y-2">
                <Label for="edit_remarks">Remarks (Optional)</Label>
                <Textarea
                  id="edit_remarks"
                  v-model="editEntry.remarks"
                  placeholder="Additional notes or comments"
                  class="min-h-[40px]"
                />
              </div>
            </div>

            <div class="space-y-2">
              <Label for="edit_ppa">PPA (Program/Project/Activity)</Label>
              <Textarea
                id="edit_ppa"
                v-model="editEntry.ppa"
                placeholder="Describe the program, project, or activity"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="edit_kpi">KPI (Key Performance Indicator)</Label>
              <Textarea
                id="edit_kpi"
                v-model="editEntry.kpi"
                placeholder="Describe the key performance indicators"
                required
              />
            </div>

            <div class="space-y-2">
              <Label for="edit_status">Status</Label>
              <div class="grid grid-cols-3 gap-2">
                <Select v-model="editEntry.status" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ongoing">Ongoing</SelectItem>
                    <SelectItem value="Accomplished">Accomplished</SelectItem>
                    <SelectItem value="Delayed">Delayed</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="edit_status_comment"
                  v-model="editEntry.status_comment"
                  placeholder="Comment (optional)"
                  class="text-sm col-span-2"
                />
              </div>
            </div>

            <div class="flex justify-end space-x-2">
              <Button type="button" variant="outline" @click="showEditDialog = false">
                Cancel
              </Button>
              <Button type="submit">
                Update Entry
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

      <Popover>
        <PopoverTrigger as-child>
          <Button
            variant="outline"
            :class="cn(
              'w-[280px] justify-start text-left font-normal',
              !selectedDateRange && 'text-muted-foreground',
            )"
          >
            <CalendarIcon class="mr-2 h-4 w-4" />
            {{ dateRangeText }}
          </Button>
        </PopoverTrigger>
        <PopoverContent class="w-auto p-0">
          <div class="p-3 border-b space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Quick Selection</span>
            </div>

            <!-- Quick weekday selection buttons -->
            <div class="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                @click="selectLastWeekdays"
                class="text-xs"
              >
                Last Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="selectCurrentWeekdays"
                class="text-xs"
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="selectNextWeekdays"
                class="text-xs"
              >
                Next Week
              </Button>
            </div>
          </div>
          <div class="weekday-calendar">
            <RangeCalendar
              v-model="selectedDateRange"
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



      <Button
        @click="saveToWeeklyReport"
        :disabled="filteredEntries.length === 0"
        class="bg-green-600 hover:bg-green-700"
      >
        Generate Weekly Report PDF
      </Button>
    </div>

    <!-- Main Content Grid -->
    <div class="w-full">
      <!-- Entries Table -->
      <Card>
        <CardContent class="p-0">
          <div class="overflow-x-auto">
            <Table class="w-full">
            <TableHeader>
              <TableRow>
                <TableHead class="w-24">Date</TableHead>
                <TableHead class="w-1/3">PPA</TableHead>
                <TableHead class="w-1/3">KPI</TableHead>
                <TableHead class="w-20">Status</TableHead>
                <TableHead class="w-1/6">Remarks</TableHead>
                <TableHead class="w-16">Actions</TableHead>
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
                <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
                  No entries found
                </TableCell>
              </TableRow>
              <TableRow v-else v-for="entry in filteredEntries" :key="entry.id">
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
                <TableCell>
                  <div class="flex items-center space-x-1">
                    <Button variant="ghost" size="sm" @click="openEditDialog(entry)">
                      <Edit class="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" @click="deleteEntry(entry.id)">
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