<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { format, parseISO, startOfWeek, endOfWeek, startOfDay, endOfDay } from 'date-fns'
import { CalendarDate, DateFormatter, getLocalTimeZone, fromDate, toCalendarDate } from '@internationalized/date'
import type { DateRange, DateValue } from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import { entriesService } from '@/services/entries'
import type { Entry, CreateEntryData, EntryFilters, PaginatedEntries } from '@/types/entry'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Calendar } from '@/components/ui/calendar'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Search, Filter, Calendar as CalendarIcon, Edit, Trash2 } from 'lucide-vue-next'

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
const selectedEntryDate = ref<DateValue>(fromDate(new Date(), getLocalTimeZone()))
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

const deleteEntry = async (id: number) => {
  if (confirm('Are you sure you want to delete this entry?')) {
    try {
      const response = await entriesService.deleteEntry(id)
      if (response.success) {
        await loadEntries()
      }
    } catch (error) {
      console.error('Failed to delete entry:', error)
    }
  }
}

const resetForm = () => {
  selectedEntryDate.value = fromDate(new Date(), getLocalTimeZone())
  Object.assign(newEntry, {
    employee_id: '',
    entry_date: format(new Date(), 'yyyy-MM-dd'),
    ppa: '',
    kpi: '',
    status: '',
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
        <h1 class="text-2xl font-bold tracking-tight">Daily Entries</h1>
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
                <Label for="status">Status</Label>
                <Input
                  id="status"
                  v-model="newEntry.status"
                  placeholder="e.g., Completed, In Progress"
                  required
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
              <Label for="remarks">Remarks (Optional)</Label>
              <Textarea
                id="remarks"
                v-model="newEntry.remarks"
                placeholder="Additional notes or comments"
              />
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
                @click="selectCurrentWeekdays"
                class="text-xs"
              >
                This Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                @click="selectLastWeekdays"
                class="text-xs"
              >
                Last Week
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

      <Button variant="outline">
        <Filter class="h-4 w-4 mr-2" />
        Filter
      </Button>
    </div>

    <!-- Main Content Grid -->
    <div class="w-full">
      <!-- Entries Table -->
      <Card>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-[120px]">Date</TableHead>
                <TableHead class="w-[30%]">PPA</TableHead>
                <TableHead class="w-[30%]">KPI</TableHead>
                <TableHead class="w-[120px]">Status</TableHead>
                <TableHead class="w-[20%]">Remarks</TableHead>
                <TableHead class="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-if="loading">
                <TableCell colspan="6" class="text-center py-8">
                  Loading...
                </TableCell>
              </TableRow>
              <TableRow v-else-if="filteredEntries.length === 0">
                <TableCell colspan="6" class="text-center py-8 text-muted-foreground">
                  No entries found
                </TableCell>
              </TableRow>
              <TableRow v-else v-for="entry in filteredEntries" :key="entry.id">
                <TableCell class="font-medium">
                  {{ formatDate(entry.entry_date) }}
                </TableCell>
                <TableCell class="break-words">
                  {{ entry.ppa }}
                </TableCell>
                <TableCell class="break-words">
                  {{ entry.kpi }}
                </TableCell>
                <TableCell>
                  <span class="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                    {{ entry.status }}
                  </span>
                </TableCell>
                <TableCell class="break-words">
                  {{ entry.remarks || '-' }}
                </TableCell>
                <TableCell>
                  <div class="flex items-center space-x-1">
                    <Button variant="ghost" size="sm">
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