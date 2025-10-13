export interface SheetInfo {
  name: string
  rowCount: number
  sampleData: Record<string, unknown>[]
  columns: string[]
  error?: string
}

export interface SyncResult {
  success: boolean
  message: string
  data?: {
    inserted?: number
    updated?: number
    errors?: number
    errorDetails?: string[]
    mdgcSunriseXUpdated?: number
    mdgc1DXUpdated?: number
    mdgcSunriseUpdated?: number
    mdgc1DUpdated?: number
    totalUpdated?: number
    totalProcessed?: number
    productIds?: string[]
    updatedReservations?: number
    lowerAntelopeCount?: number
    antelopeXCount?: number
  }
  syncTime?: string
}

export interface TableInfo {
  name: string
  displayName: string
}

export interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  default: string | null
}

export interface ColumnMapping {
  [sheetColumn: string]: string
}

export interface CleanupStatus {
  reservations: Array<{ product_id: string; choices?: Record<string, unknown>; created_at: string }>
  products: Array<{ id: string; choices?: Record<string, unknown> }>
  summary: {
    totalReservations: number
    reservationsWithChoices: number
    productsWithChoices: number
  }
}

export interface RealTimeStats {
  processed: number
  inserted: number
  updated: number
  errors: number
}
