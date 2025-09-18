export interface PdfGenerationResponse {
  success: boolean
  message: string
  size?: number
  error?: string
}

export interface PdfOptions {
  format?: 'a4' | 'letter' | 'a3'
  orientation?: 'portrait' | 'landscape'
  margins?: {
    top?: number
    right?: number
    bottom?: number
    left?: number
  }
  quality?: number
  enableLocalFileAccess?: boolean
  printMediaType?: boolean
  disableSmartShrinking?: boolean
}

export interface PdfDownloadOptions {
  filename?: string
  autoOpen?: boolean
}

export interface PdfPreviewOptions {
  openInNewTab?: boolean
  fallbackToDownload?: boolean
}

export interface PdfError {
  code: string
  message: string
  details?: unknown
}

export type PdfGenerationStatus = 'idle' | 'generating' | 'downloading' | 'previewing' | 'error'

export interface PdfState {
  status: PdfGenerationStatus
  error: PdfError | null
  progress?: number
}