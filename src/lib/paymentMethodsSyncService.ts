import { supabase } from '@/lib/supabase'
import { readSheetData } from '@/lib/googleSheets'

interface PaymentMethodData {
  ID: string
  Method: string
  User: string
  Limit: number
  Status: string
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
}

export class PaymentMethodsSyncService {
  private validatePaymentMethodData(data: PaymentMethodData): ValidationResult {
    const errors: string[] = []

    // 필수 필드 검증
    if (!data.ID || data.ID.toString().trim() === '') {
      errors.push('ID는 필수입니다.')
    }

    if (!data.Method || data.Method.toString().trim() === '') {
      errors.push('Method는 필수입니다.')
    }

    if (!data.User || data.User.toString().trim() === '') {
      errors.push('User는 필수입니다.')
    }

    // 한도 검증
    const limit = parseFloat(data.Limit?.toString() || '0')
    if (isNaN(limit) || limit < 0) {
      errors.push('Limit은 유효한 양수여야 합니다.')
    }

    // 상태 검증
    const validStatuses = ['active', 'inactive', 'suspended', 'expired']
    if (data.Status && !validStatuses.includes(data.Status.toString().toLowerCase())) {
      errors.push(`Status는 다음 중 하나여야 합니다: ${validStatuses.join(', ')}`)
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private transformGoogleSheetData(data: Record<string, unknown>[]): PaymentMethodData[] {
    return data.map(row => ({
      ID: row['ID']?.toString() || '',
      Method: row['Method']?.toString() || '',
      User: row['User']?.toString() || '',
      Limit: parseFloat(row['Limit']?.toString() || '0'),
      Status: row['Status']?.toString() || 'active'
    }))
  }

  private async insertPaymentMethod(data: PaymentMethodData): Promise<void> {
    try {
      // 기존 데이터 확인
      const { data: existing } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('id', data.ID)
        .single()

      if (existing) {
        console.log(`결제 방법 ID ${data.ID}는 이미 존재합니다. 업데이트를 건너뜁니다.`)
        return
      }

      // 새 데이터 삽입
      const insertData = {
        id: data.ID,
        method: data.Method,
        method_type: this.detectMethodType(data.Method),
        user_email: data.User,
        limit_amount: data.Limit,
        status: (data.Status || 'active').toLowerCase(),
        // 카드 정보 자동 감지
        card_number_last4: this.extractCardLast4(data.Method),
        card_type: this.detectCardType(data.Method),
        // 기본값 설정
        current_month_usage: 0,
        current_day_usage: 0,
        assigned_date: new Date().toISOString().split('T')[0]
      }

      const { error } = await supabase
        .from('payment_methods')
        .insert(insertData)

      if (error) {
        console.error(`결제 방법 삽입 오류 (ID: ${data.ID}):`, error)
        throw error
      }

      console.log(`결제 방법 삽입 성공: ${data.ID}`)
    } catch (error) {
      console.error(`결제 방법 삽입 실패 (ID: ${data.ID}):`, error)
      throw error
    }
  }

  private detectMethodType(method: string): string {
    const methodLower = method.toLowerCase()
    
    if (methodLower.includes('cc') || methodLower.includes('card') || /\d{4}/.test(method)) {
      return 'card'
    } else if (methodLower.includes('cash') || methodLower.includes('현금')) {
      return 'cash'
    } else if (methodLower.includes('transfer') || methodLower.includes('계좌') || methodLower.includes('이체')) {
      return 'transfer'
    } else if (methodLower.includes('mobile') || methodLower.includes('모바일')) {
      return 'mobile'
    } else {
      return 'other'
    }
  }

  private extractCardLast4(method: string): string | null {
    // 카드 번호 패턴 찾기 (4자리 숫자)
    const match = method.match(/\b(\d{4})\b/)
    return match ? match[1] : null
  }

  private detectCardType(method: string): string | null {
    const methodLower = method.toLowerCase()
    
    if (methodLower.includes('visa')) return 'visa'
    if (methodLower.includes('master') || methodLower.includes('mastercard')) return 'mastercard'
    if (methodLower.includes('amex') || methodLower.includes('american express')) return 'amex'
    if (methodLower.includes('discover')) return 'discover'
    if (methodLower.includes('jcb')) return 'jcb'
    
    return null
  }

  async syncFromGoogleSheet(
    spreadsheetId: string, 
    sheetName: string,
    onProgress?: (event: { type: string; message: string; processed?: number; total?: number }) => void
  ): Promise<{ success: boolean; message: string; stats: any }> {
    try {
      onProgress?.({ type: 'info', message: '구글 시트에서 결제 방법 데이터를 읽는 중...' })
      
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
      
      onProgress?.({ type: 'info', message: `총 ${transformedData.length}개의 결제 방법 데이터를 처리합니다.` })

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
            const validation = this.validatePaymentMethodData(data)
            if (!validation.isValid) {
              errorCount++
              errors.push(`ID ${data.ID}: ${validation.errors.join(', ')}`)
              continue
            }

            // 데이터베이스에 삽입
            await this.insertPaymentMethod(data)
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
        message: `결제 방법 동기화 완료: ${processedCount}/${transformedData.length}개 처리됨 (오류: ${errorCount}개)`,
        stats
      }

    } catch (error) {
      console.error('결제 방법 동기화 오류:', error)
      return {
        success: false,
        message: `결제 방법 동기화 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        stats: { processed: 0, total: 0, errors: 1 }
      }
    }
  }

  async getSyncStats(): Promise<{ 
    total: number
    active: number
    inactive: number
    suspended: number
    expired: number
    byType: Record<string, number>
    totalLimit: number
    totalUsage: number
  }> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('status, method_type, limit_amount, current_month_usage')

      if (error) throw error

      const stats = {
        total: data?.length || 0,
        active: data?.filter(item => item.status === 'active').length || 0,
        inactive: data?.filter(item => item.status === 'inactive').length || 0,
        suspended: data?.filter(item => item.status === 'suspended').length || 0,
        expired: data?.filter(item => item.status === 'expired').length || 0,
        byType: {
          card: data?.filter(item => item.method_type === 'card').length || 0,
          cash: data?.filter(item => item.method_type === 'cash').length || 0,
          transfer: data?.filter(item => item.method_type === 'transfer').length || 0,
          mobile: data?.filter(item => item.method_type === 'mobile').length || 0,
          other: data?.filter(item => !['card', 'cash', 'transfer', 'mobile'].includes(item.method_type)).length || 0
        },
        totalLimit: data?.reduce((sum, item) => sum + (item.limit_amount || 0), 0) || 0,
        totalUsage: data?.reduce((sum, item) => sum + (item.current_month_usage || 0), 0) || 0
      }

      return stats
    } catch (error) {
      console.error('결제 방법 통계 조회 오류:', error)
      return { 
        total: 0, 
        active: 0, 
        inactive: 0, 
        suspended: 0, 
        expired: 0,
        byType: { card: 0, cash: 0, transfer: 0, mobile: 0, other: 0 },
        totalLimit: 0,
        totalUsage: 0
      }
    }
  }

  // 사용량 업데이트 (다른 시스템에서 호출)
  async updateUsage(methodId: string, amount: number): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('update_payment_method_usage', {
        p_method_id: methodId,
        p_amount: amount
      })

      if (error) throw error
      return true
    } catch (error) {
      console.error('사용량 업데이트 오류:', error)
      return false
    }
  }

  // 월별/일별 사용량 리셋
  async resetUsage(resetType: 'monthly' | 'daily'): Promise<boolean> {
    try {
      const functionName = resetType === 'monthly' ? 'reset_monthly_usage' : 'reset_daily_usage'
      const { error } = await supabase.rpc(functionName)

      if (error) throw error
      return true
    } catch (error) {
      console.error(`${resetType} 사용량 리셋 오류:`, error)
      return false
    }
  }
}

// 싱글톤 인스턴스
export const paymentMethodsSyncService = new PaymentMethodsSyncService()
