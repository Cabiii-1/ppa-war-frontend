import { authFetch } from './auth'
import type { PdfGenerationResponse } from '@/types/pdf'

export class PdfService {
  private static readonly BASE_URL = '/weekly-reports'

  static async downloadWeeklyReportPdf(reportId: number): Promise<Blob> {
    const response = await authFetch(`${this.BASE_URL}/${reportId}/pdf/download`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(errorData.message || `Failed to download PDF: ${response.status}`)
    }

    return await response.blob()
  }

  static async previewWeeklyReportPdf(reportId: number): Promise<Blob> {
    const response = await authFetch(`${this.BASE_URL}/${reportId}/pdf/preview`, {
      method: 'GET',
      headers: {
        'Accept': 'application/pdf',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(errorData.message || `Failed to preview PDF: ${response.status}`)
    }

    return await response.blob()
  }

  static async generateWeeklyReportPdf(reportId: number): Promise<PdfGenerationResponse> {
    const response = await authFetch(`${this.BASE_URL}/${reportId}/pdf/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(errorData.message || `Failed to generate PDF: ${response.status}`)
    }

    return await response.json()
  }

  static downloadBlobAsFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  static previewBlobInNewTab(blob: Blob): void {
    const url = window.URL.createObjectURL(blob)
    const newWindow = window.open(url, '_blank')
    if (!newWindow) {
      // Fallback if popup is blocked
      const link = document.createElement('a')
      link.href = url
      link.target = '_blank'
      link.click()
    }
  }

  static createPdfFilename(reportStartDate: string, reportEndDate: string): string {
    const startDate = new Date(reportStartDate).toISOString().split('T')[0]
    const endDate = new Date(reportEndDate).toISOString().split('T')[0]
    return `weekly_report_${startDate}_to_${endDate}.pdf`
  }
}