export interface Entry {
  id: number
  employee_id: string
  entry_date: string
  ppa: string
  kpi: string
  status: string
  remarks?: string
  weekly_report_id?: number
  created_at: string
  updated_at: string
  weekly_report?: WeeklyReport
}

export interface WeeklyReport {
  id: number
  title: string
  start_date: string
  end_date: string
  created_at: string
  updated_at: string
}

export interface CreateEntryData {
  employee_id: string
  entry_date: string
  ppa: string
  kpi: string
  status: string
  remarks?: string
  weekly_report_id?: number
}

export interface UpdateEntryData extends Partial<CreateEntryData> {}

export interface EntryFilters {
  employee_id?: string
  entry_date?: string
  status?: string
  date_from?: string
  date_to?: string
  per_page?: number
}

export interface PaginatedEntries {
  data: Entry[]
  current_page: number
  last_page: number
  per_page: number
  total: number
  from: number
  to: number
}