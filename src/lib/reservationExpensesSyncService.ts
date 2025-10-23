import { supabase } from '@/lib/supabase'
import { readSheetData } from '@/lib/googleSheets'

interface ReservationExpenseData {
  ID: string
  'Submit on': string
  'Submitted by': string
  'Paid to': string
  'Paid for': string
  Amount: number
  'Payment Method': string
  Note: string
  Image: string
  File: string
  Status: string
  'Reservation ID': string
  'Event ID': string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export class ReservationExpensesSyncService {
  private validateReservationExpenseData(data: ReservationExpenseData): ValidationResult {
    const errors: string[] = []

    // 필수 필드 검증
    if (!data.ID || data.ID.toString().trim() === '') {
      errors.push('ID는 필수입니다.')
    }

    if (!data['Submitted by'] || data['Submitted by'].toString().trim() === '') {
      errors.push('Submitted by는 필수입니다.')
    }

    if (!data['Paid to'] || data['Paid to'].toString().trim() === '') {
      errors.push('Paid to는 필수입니다.')
    }

    if (!data['Paid for'] || data['Paid for'].toString().trim() === '') {
      errors.push('Paid for는 필수입니다.')
    }

    // 금액 검증
    const amount = parseFloat(data.Amount?.toString() || '0')
    if (isNaN(amount) || amount <= 0) {
      errors.push('Amount는 유효한 양수여야 합니다.')
    }

    // 상태 검증
    const validStatuses = ['pending', 'approved', 'rejected']
    if (data.Status && !validStatuses.includes(data.Status.toString().toLowerCase())) {
      errors.push(`Status는 다음 중 하나여야 합니다: ${validStatuses.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private transformGoogleSheetData(data: Record<string, unknown>[]): ReservationExpenseData[] {
    return data.map(row => ({
      ID: row['ID']?.toString() || '',
      'Submit on': row['Submit on']?.toString() || '',
      'Submitted by': row['Submitted by']?.toString() || '',
      'Paid to': row['Paid to']?.toString() || '',
      'Paid for': row['Paid for']?.toString() || '',
      Amount: parseFloat(row['Amount']?.toString() || '0'),
      'Payment Method': row['Payment Method']?.toString() || '',
      Note: row['Note']?.toString() || '',
      Image: row['Image']?.toString() || '',
      File: row['File']?.toString() || '',
      Status: row['Status']?.toString() || 'pending',
      'Reservation ID': row['Reservation ID']?.toString() || '',
      'Event ID': row['Event ID']?.toString() || ''
    }))
  }

  private async insertReservationExpense(data: ReservationExpenseData): Promise<void> {
    try {
      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('reservation_expenses')
        .select('id')
        .eq('id', data.ID)
        .single()

      if (existing) {
        console.log(`예약 지출 ID ${data.ID}는 이미 존재합니다. 업데이트를 건너뜁니다.`)
        return
      }

      // 새 데이터 삽입
      const insertData = {
        id: data.ID,
        submit_on: data['Submit on'] ? new Date(data['Submit on']).toISOString() : new Date().toISOString(),
        submitted_by: data['Submitted by'],
        paid_to: data['Paid to'],
        paid_for: data['Paid for'],
        amount: data.Amount,
        payment_method: data['Payment Method'] || null,
        note: data.Note || null,
        image_url: data.Image || null,
        file_path: data.File || null,
        status: (data.Status || 'pending').toLowerCase() as 'pending' | 'approved' | 'rejected',
        reservation_id: data['Reservation ID'] || null,
        event_id: data['Event ID'] || null
      }

      const { error } = await supabase
        .from('reservation_expenses')
        .insert(insertData)

      if (error) {
        console.error(`예약 지출 삽입 오류 (ID: ${data.ID}):`, error)
        throw error
      }

      console.log(`예약 지출 삽입 성공: ${data.ID}`)
    } catch (error) {
      console.error(`예약 지출 삽입 실패 (ID: ${data.ID}):`, error)
      throw error
    }
  }

  async syncFromGoogleSheet(
    spreadsheetId: string, 
    sheetName: string,
    onProgress?: (event: { type: string; message: string; processed?: number; total?: number }) => void
  ): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      onProgress?.({ type: 'info', message: '구글 시트에서 예약 지출 데이터를 읽는 중...' })
      
      // 구글 시트에서 데이터 읽기
      const rawData = await readSheetData(spreadsheetId, sheetName)
      
      if (!rawData || rawData.length === 0) {
        return {
          success: false,
          message: '구글 시트에서 데이터를 찾을 수 없습니다.',
          stats: { processed: 0, total: 0, errors: 0 }
        }
      }

      onProgress?.({ type: 'info', message: '데이터 변환 중...' })
      
      // 데이터 변환
      const transformedData = this.transformGoogleSheetData(rawData)
      
      onProgress?.({ type: 'info', message: `총 ${transformedData.length}개의 예약 지출 데이터를 처리합니다.` })

      let processedCount = 0
      let errorCount = 0
      const errors: string[] = []

      // 배치 처리 (한 번에 10개씩)
      const batchSize = 10
      for (let i = 0; i < transformedData.length; i += batchSize) {
        const batch = transformedData.slice(i, i + batchSize)
        
        for (const data of batch) {
          try {
            // 데이터 검증
            const validation = this.validateReservationExpenseData(data)
            if (!validation.isValid) {
              errorCount++
              errors.push(`ID ${data.ID}: ${validation.errors.join(', ')}`)
              continue
            }

            // 데이터베이스에 삽입
            await this.insertReservationExpense(data)
            processedCount++
            
            onProgress?.({ 
              type: 'progress', 
              message: `처리 중...`, 
              processed: processedCount, 
              total: transformedData.length 
            })
            
          } catch (error) {
            errorCount++
            errors.push(`ID ${data.ID}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
          }
        }

        // 배치 간 잠시 대기 (API 제한 방지)
        if (i + batchSize < transformedData.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      const stats = {
        processed: processedCount,
        total: transformedData.length,
        errors: errorCount,
        errorDetails: errors
      }

      return {
        success: true,
        message: `예약 지출 동기화 완료: ${processedCount}/${transformedData.length}개 처리됨 (오류: ${errorCount}개)`,
        stats
      }

    } catch (error) {
      console.error('예약 지출 동기화 오류:', error)
      return {
        success: false,
        message: `예약 지출 동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        stats: { processed: 0, total: 0, errors: 1 }
      }
    }
  }

  async getSyncStats(): Promise<{ total: number; pending: number; approved: number; rejected: number }> {
    try {
      const { data, error } = await supabase
        .from('reservation_expenses')
        .select('status')

      if (error) throw error

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(item => item.status === 'pending').length || 0,
        approved: data?.filter(item => item.status === 'approved').length || 0,
        rejected: data?.filter(item => item.status === 'rejected').length || 0
      }

      return stats
    } catch (error) {
      console.error('예약 지출 통계 조회 오류:', error)
      return { total: 0, pending: 0, approved: 0, rejected: 0 }
    }
  }
}

// 싱글톤 인스턴스
export const reservationExpensesSyncService = new ReservationExpensesSyncService()
