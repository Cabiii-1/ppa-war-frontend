<script setup lang="ts">
import { ref } from 'vue'
import { PdfService } from '@/services/pdfService'
import type { WeeklyReport } from '@/services/weeklyReports'
import type { PdfGenerationStatus } from '@/types/pdf'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileDown, FileText, Loader2, ChevronDown } from 'lucide-vue-next'

interface Props {
  report: WeeklyReport
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'default' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'default',
  size: 'sm'
})

const loading = ref(false)
const error = ref<string | null>(null)

const downloadPdf = async () => {
  if (loading.value) return

  loading.value = true
  error.value = null

  try {
    const blob = await PdfService.downloadWeeklyReportPdf(props.report.id)
    const filename = PdfService.createPdfFilename(
      props.report.period_start,
      props.report.period_end
    )
    PdfService.downloadBlobAsFile(blob, filename)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to download PDF'
    console.error('PDF download error:', err)
  } finally {
    loading.value = false
  }
}

const previewPdf = async () => {
  if (loading.value) return

  loading.value = true
  error.value = null

  try {
    const blob = await PdfService.previewWeeklyReportPdf(props.report.id)
    PdfService.previewBlobInNewTab(blob)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to preview PDF'
    console.error('PDF preview error:', err)
  } finally {
    loading.value = false
  }
}

const generatePdf = async () => {
  if (loading.value) return

  loading.value = true
  error.value = null

  try {
    const response = await PdfService.generateWeeklyReportPdf(props.report.id)
    if (response.success) {
      // Auto-download after generation
      await downloadPdf()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to generate PDF'
    console.error('PDF generation error:', err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="relative">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          :variant="variant"
          :size="size"
          :disabled="loading"
          class="min-w-[100px]"
        >
          <Loader2 v-if="loading" class="h-3 w-3 animate-spin mr-1" />
          <FileText v-else class="h-3 w-3 mr-1" />
          PDF
          <ChevronDown class="h-3 w-3 ml-1" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="w-48">
        <DropdownMenuItem @click="previewPdf" :disabled="loading">
          <FileText class="h-4 w-4 mr-2" />
          Preview PDF
        </DropdownMenuItem>
        <DropdownMenuItem @click="downloadPdf" :disabled="loading">
          <FileDown class="h-4 w-4 mr-2" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem @click="generatePdf" :disabled="loading">
          <FileText class="h-4 w-4 mr-2" />
          Generate & Download
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>

    <!-- Error Toast -->
    <div
      v-if="error"
      class="absolute top-full left-0 right-0 mt-2 p-2 bg-red-100 border border-red-300 rounded-md text-red-700 text-xs z-50"
      @click="error = null"
    >
      <p>{{ error }}</p>
      <p class="text-red-500 cursor-pointer">Click to dismiss</p>
    </div>
  </div>
</template>