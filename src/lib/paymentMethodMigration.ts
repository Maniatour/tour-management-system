import { supabase } from '@/lib/supabase'

/**
 * 기존 테이블의 payment_method 값들을 payment_methods 테이블로 마이그레이션
 */
export class PaymentMethodMigration {
  
  /**
   * 모든 테이블에서 고유한 payment_method 값 수집
   */
  async collectExistingPaymentMethods(): Promise<string[]> {
    try {
      const tables = [
        'payment_records',
        'company_expenses', 
        'reservation_expenses',
        'tour_expenses'
      ]

      const allMethods = new Set<string>()

      for (const table of tables) {
        try {
          const { data, error } = await supabase
            .from(table)
            .select('payment_method')
            .not('payment_method', 'is', null)

          if (error) {
            console.warn(`테이블 ${table}에서 payment_method 조회 실패:`, error)
            continue
          }

          data?.forEach((row: any) => {
            if (row.payment_method && row.payment_method.trim() !== '') {
              allMethods.add(row.payment_method.trim())
            }
          })
        } catch (error) {
          console.warn(`테이블 ${table} 처리 중 오류:`, error)
        }
      }

      return Array.from(allMethods)
    } catch (error) {
      console.error('기존 payment_method 수집 오류:', error)
      return []
    }
  }

  /**
   * payment_method ID에서 method_type 자동 감지
   */
  private detectMethodType(methodId: string): string {
    const methodLower = methodId.toLowerCase()
    
    if (methodLower.includes('cash') || methodLower.includes('현금')) {
      return 'cash'
    } else if (methodLower.includes('card') || methodLower.includes('cc') || /^\d{4}$/.test(methodId)) {
      return 'card'
    } else if (methodLower.includes('transfer') || methodLower.includes('이체') || methodLower.includes('계좌')) {
      return 'transfer'
    } else if (methodLower.includes('mobile') || methodLower.includes('모바일')) {
      return 'mobile'
    } else {
      return 'other'
    }
  }

  /**
   * payment_method ID에서 method 이름 생성
   */
  private generateMethodName(methodId: string): string {
    const methodLower = methodId.toLowerCase()
    
    if (methodLower.includes('cash') || methodLower.includes('현금')) {
      return '현금'
    } else if (methodLower.includes('transfer') || methodLower.includes('이체') || methodLower.includes('계좌')) {
      return '계좌이체'
    } else if (methodId.startsWith('PAYM')) {
      // PAYM032 같은 형식은 그대로 사용
      return methodId
    } else {
      return methodId
    }
  }

  /**
   * 기존 payment_method 값들을 payment_methods 테이블에 생성
   */
  async migrateExistingPaymentMethods(): Promise<{
    success: boolean
    message: string
    total: number
    created: number
    skipped: number
    errors: string[]
  }> {
    try {
      // 1. 기존 payment_method 값들 수집
      const existingMethods = await this.collectExistingPaymentMethods()
      
      if (existingMethods.length === 0) {
        return {
          success: true,
          message: '마이그레이션할 payment_method가 없습니다.',
          total: 0,
          created: 0,
          skipped: 0,
          errors: []
        }
      }

      // 2. 이미 존재하는 payment_methods 확인
      const { data: existingPaymentMethods } = await supabase
        .from('payment_methods')
        .select('id')

      const existingIds = new Set(existingPaymentMethods?.map(pm => pm.id) || [])

      // 3. 새로운 payment_methods 생성
      let created = 0
      let skipped = 0
      const errors: string[] = []

      for (const methodId of existingMethods) {
        // 이미 존재하면 건너뛰기
        if (existingIds.has(methodId)) {
          skipped++
          continue
        }

        try {
          const methodType = this.detectMethodType(methodId)
          const methodName = this.generateMethodName(methodId)

          const { error: insertError } = await supabase
            .from('payment_methods')
            .insert({
              id: methodId,
              method: methodName,
              method_type: methodType,
              user_email: null, // 기존 데이터는 고객용으로 간주
              status: 'active',
              notes: '기존 시스템에서 자동 마이그레이션됨',
              current_month_usage: 0,
              current_day_usage: 0,
              assigned_date: new Date().toISOString().split('T')[0]
            })

          if (insertError) {
            errors.push(`${methodId}: ${insertError.message}`)
          } else {
            created++
          }
        } catch (error) {
          errors.push(`${methodId}: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
        }
      }

      return {
        success: true,
        message: `총 ${existingMethods.length}개의 payment_method 중 ${created}개 생성, ${skipped}개 건너뜀`,
        total: existingMethods.length,
        created,
        skipped,
        errors
      }
    } catch (error) {
      console.error('payment_method 마이그레이션 오류:', error)
      return {
        success: false,
        message: `마이그레이션 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`,
        total: 0,
        created: 0,
        skipped: 0,
        errors: []
      }
    }
  }

  /**
   * payment_method ID가 payment_methods 테이블에 존재하는지 확인
   */
  async validatePaymentMethodExists(methodId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('id', methodId)
        .single()

      if (error || !data) {
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  /**
   * payment_method ID를 payment_methods 테이블의 method 이름으로 변환
   */
  async resolvePaymentMethodName(methodId: string | null | undefined): Promise<string | null> {
    if (!methodId) return null

    try {
      const { data, error } = await supabase
        .from('payment_methods')
        .select('method')
        .eq('id', methodId)
        .single()

      if (error || !data) {
        // payment_methods에 없으면 원본 ID 반환
        return methodId
      }

      return data.method
    } catch (error) {
      return methodId
    }
  }
}

// 싱글톤 인스턴스
export const paymentMethodMigration = new PaymentMethodMigration()
