// Tour Expenses Sync Service with Foreign Key Validation
// This service handles tour_expenses synchronization with proper foreign key validation

import { createClient } from '@supabase/supabase-js'
import { readSheetDataDynamic } from './googleSheets'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

interface TourExpenseData {
  id?: string
  tour_id?: string
  product_id?: string
  submit_on?: string
  paid_to?: string | null
  paid_for: string
  amount: number
  payment_method?: string | null
  note?: string | null
  tour_date: string
  submitted_by: string
  image_url?: string | null
  file_path?: string | null
  audited_by?: string | null
  checked_by?: string | null
  checked_on?: string | null
  status?: 'pending' | 'approved' | 'rejected'
  created_at?: string
  updated_at?: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  validTourIds: Set<string>
  validProductIds: Set<string>
}

// Validate foreign key references before inserting
async function validateForeignKeys(data: TourExpenseData[]): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Extract unique tour_ids and product_ids from the data
  const tourIds = new Set(data.map(d => d.tour_id).filter(Boolean))
  const productIds = new Set(data.map(d => d.product_id).filter(Boolean))
  
  // Check if tour_ids exist in tours table
  let validTourIds = new Set<string>()
  if (tourIds.size > 0) {
    const { data: existingTours, error: tourError } = await supabase
      .from('tours')
      .select('id')
      .in('id', Array.from(tourIds))
    
    if (tourError) {
      errors.push(`투어 테이블 조회 오류: ${tourError.message}`)
    } else {
      validTourIds = new Set(existingTours?.map(t => t.id) || [])
      const invalidTourIds = Array.from(tourIds).filter(id => !validTourIds.has(id))
      if (invalidTourIds.length > 0) {
        warnings.push(`존재하지 않는 투어 ID들: ${invalidTourIds.join(', ')}`)
      }
    }
  }
  
  // Check if product_ids exist in products table
  let validProductIds = new Set<string>()
  if (productIds.size > 0) {
    const { data: existingProducts, error: productError } = await supabase
      .from('products')
      .select('id')
      .in('id', Array.from(productIds))
    
    if (productError) {
      errors.push(`상품 테이블 조회 오류: ${productError.message}`)
    } else {
      validProductIds = new Set(existingProducts?.map(p => p.id) || [])
      const invalidProductIds = Array.from(productIds).filter(id => !validProductIds.has(id))
      if (invalidProductIds.length > 0) {
        warnings.push(`존재하지 않는 상품 ID들: ${invalidProductIds.join(', ')}`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    validTourIds,
    validProductIds
  }
}

// Clean and validate tour expenses data
function cleanTourExpensesData(data: any[]): TourExpenseData[] {
  return data.map((row, index) => {
    const cleaned: TourExpenseData = {
      id: row.id || undefined,
      tour_id: row.tour_id || undefined,
      product_id: row.product_id || undefined,
      submit_on: row.submit_on ? new Date(row.submit_on).toISOString() : undefined,
      paid_to: row.paid_to || null,
      paid_for: row.paid_for || '',
      amount: parseFloat(row.amount) || 0,
      payment_method: row.payment_method || null,
      note: row.note || null,
      tour_date: row.tour_date || '',
      submitted_by: row.submitted_by || '',
      image_url: row.image_url || null,
      file_path: row.file_path || null,
      audited_by: row.audited_by || null,
      checked_by: row.checked_by || null,
      checked_on: row.checked_on ? new Date(row.checked_on).toISOString() : null,
      status: row.status || 'pending',
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString()
    }
    
    // Validate required fields
    if (!cleaned.paid_for) {
      console.warn(`Row ${index + 1}: paid_for is required`)
    }
    if (!cleaned.amount || cleaned.amount <= 0) {
      console.warn(`Row ${index + 1}: amount must be greater than 0`)
    }
    if (!cleaned.tour_date) {
      console.warn(`Row ${index + 1}: tour_date is required`)
    }
    if (!cleaned.submitted_by) {
      console.warn(`Row ${index + 1}: submitted_by is required`)
    }
    
    return cleaned
  })
}

// Sync tour expenses with foreign key validation
export async function syncTourExpenses(
  spreadsheetId: string,
  sheetName: string,
  onProgress?: (event: {
    type: 'start' | 'progress' | 'complete' | 'info' | 'warn' | 'error'
    message?: string
    total?: number
    processed?: number
    inserted?: number
    updated?: number
    errors?: number
  }) => void
) {
  try {
    onProgress?.({ type: 'info', message: '투어 지출 동기화 시작' })
    
    // Read data from Google Sheets
    onProgress?.({ type: 'info', message: '구글 시트에서 데이터 읽는 중...' })
    const sheetData = await readSheetDataDynamic(spreadsheetId, sheetName)
    console.log(`Read ${sheetData.length} rows from Google Sheet`)
    
    if (sheetData.length === 0) {
      onProgress?.({ type: 'warn', message: '동기화할 데이터가 없습니다.' })
      return { success: true, message: 'No data to sync', count: 0 }
    }
    
    // Clean and validate data
    onProgress?.({ type: 'info', message: '데이터 정리 및 검증 중...' })
    const cleanedData = cleanTourExpensesData(sheetData)
    
    // Validate foreign keys
    onProgress?.({ type: 'info', message: '외래 키 참조 검증 중...' })
    const validation = await validateForeignKeys(cleanedData)
    
    if (!validation.isValid) {
      onProgress?.({ type: 'error', message: `검증 실패: ${validation.errors.join(', ')}` })
      return { 
        success: false, 
        message: 'Validation failed', 
        errors: validation.errors,
        warnings: validation.warnings
      }
    }
    
    // Show warnings if any
    if (validation.warnings.length > 0) {
      onProgress?.({ type: 'warn', message: `경고: ${validation.warnings.join(', ')}` })
    }
    
    // Filter out records with invalid foreign keys
    const validData = cleanedData.filter(row => {
      if (row.tour_id && !validation.validTourIds.has(row.tour_id)) {
        console.warn(`Skipping record with invalid tour_id: ${row.tour_id}`)
        return false
      }
      if (row.product_id && !validation.validProductIds.has(row.product_id)) {
        console.warn(`Skipping record with invalid product_id: ${row.product_id}`)
        return false
      }
      return true
    })
    
    onProgress?.({ 
      type: 'info', 
      message: `검증 완료: ${validData.length}/${cleanedData.length}개 레코드가 유효합니다.` 
    })
    
    if (validData.length === 0) {
      onProgress?.({ type: 'warn', message: '유효한 데이터가 없습니다.' })
      return { success: true, message: 'No valid data to sync', count: 0 }
    }
    
    // Insert/update data in batches
    const results = {
      inserted: 0,
      updated: 0,
      errors: 0,
      errorDetails: [] as string[]
    }
    
    const batchSize = 100
    const totalRows = validData.length
    onProgress?.({ type: 'start', total: totalRows })
    
    for (let i = 0; i < validData.length; i += batchSize) {
      const batch = validData.slice(i, i + batchSize)
      
      try {
        const { error } = await supabase
          .from('tour_expenses')
          .upsert(batch, { onConflict: 'id' })
        
        if (error) {
          console.error('Batch upsert error:', error)
          results.errors += batch.length
          results.errorDetails.push(`배치 처리 실패 (${batch.length}개 행): ${error.message}`)
          onProgress?.({ type: 'error', message: `배치 처리 실패: ${error.message}` })
        } else {
          results.updated += batch.length
          onProgress?.({ 
            type: 'progress', 
            processed: Math.min(i + batchSize, totalRows),
            total: totalRows,
            message: `${Math.min(i + batchSize, totalRows)}/${totalRows}개 행 처리 완료`
          })
        }
      } catch (err) {
        console.error('Batch upsert exception:', err)
        results.errors += batch.length
        const errorMsg = `배치 처리 예외 (${batch.length}개 행): ${String(err)}`
        results.errorDetails.push(errorMsg)
        onProgress?.({ type: 'error', message: errorMsg })
      }
    }
    
    onProgress?.({ 
      type: 'complete', 
      message: `동기화 완료: ${results.updated}개 업데이트, ${results.errors}개 오류` 
    })
    
    return {
      success: results.errors === 0,
      message: `동기화 완료: ${results.updated}개 업데이트, ${results.errors}개 오류`,
      count: results.updated,
      errors: results.errors,
      errorDetails: results.errorDetails,
      warnings: validation.warnings
    }
    
  } catch (error) {
    console.error('Tour expenses sync error:', error)
    onProgress?.({ type: 'error', message: `동기화 오류: ${String(error)}` })
    return {
      success: false,
      message: `동기화 오류: ${String(error)}`,
      count: 0
    }
  }
}
