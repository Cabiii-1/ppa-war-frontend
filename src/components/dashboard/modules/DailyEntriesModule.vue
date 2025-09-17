<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { format, parseISO } from 'date-fns'
import { CalendarDate, DateFormatter, getLocalTimeZone } from '@internationalized/date'
import type { DateRange } from 'reka-ui'
import { useAuthStore } from '@/stores/auth'
import { entriesService } from '@/services/entries'
import type { Entry, CreateEntryData, EntryFilters, PaginatedEntries } from '@/types/entry'
import { cn } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { RangeCalendar } from '@/components/ui/range-calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Search, Filter, Calendar as CalendarIcon, MoreHorizontal, Edit, Trash2 } from 'lucide-vue-next'

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
const selectedDateRange = ref<DateRange>({
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
      return `${df.format(selectedDateRange.value.start.toDate(getLocalTimeZone()))} - ${df.format(selectedDateRange.value.end.toDate(getLocalTimeZone()))}`
    }
    return df.format(selectedDateRange.value.start.toDate(getLocalTimeZone()))
  }
  return 'Pick a date range'
})

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
                <Input
                  id="entry_date"
                  v-model="newEntry.entry_date"
                  type="date"
                  required
                />
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
          <RangeCalendar
            v-model="selectedDateRange"
            initial-focus
            :number-of-months="2"
            @update:start-value="(startDate) => selectedDateRange && (selectedDateRange.start = startDate)"
            @update:model-value="handleDateRangeSelect"
          />
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