export type ExtractedQuoteFields = {
  reference?: string
  /** Euro amount formatted for the existing quote form, e.g. "1250.50". */
  amount?: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  /** Explicit validity date only. The document date is never a sending date. */
  expiresAt?: string
}

export type PreparedQuoteDocument = {
  pdf: File
  preview: Blob
  fields: ExtractedQuoteFields
  warnings: string[]
}

export type DocumentPreparationOptions = {
  signal?: AbortSignal
  onProgress?: (value: { progress: number; label: string }) => void
}

export const MAX_QUOTE_DOCUMENT_BYTES = 10 * 1024 * 1024
export const MAX_QUOTE_DOCUMENT_PAGES = 10
