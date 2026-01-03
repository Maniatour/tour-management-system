import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 기존 UUID → 새로운 UUID 매핑
const UUID_MAPPING: Record<string, string> = {
  '3a842aec-a3c3-4516-b846-13fed5dd95b8': '478c70bb-08c3-4b49-8492-6a3367d1f5dd',
  '8aab7091-b636-4426-9c1e-df37ed7d6538': '982a5e11-7d81-42cc-9011-f2ec5a379899'
}

// Antelope X Canyon → Lower Antelope Canyon 매핑
// 3a842aec-a3c3-4516-b846-13fed5dd95b8 (Antelope X Canyon) → 8aab7091-b636-4426-9c1e-df37ed7d6538 (Lower Antelope Canyon)
const OPTION_ID_MIGRATION: Record<string, string> = {
  '3a842aec-a3c3-4516-b846-13fed5dd95b8': '8aab7091-b636-4426-9c1e-df37ed7d6538'
}

export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase configuration missing' },
        { status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Starting selected_options migration to reservation_choices...')

    // 먼저 choice_options 테이블에서 option_id -> choice_id 매핑 가져오기
    const { data: choiceOptionsData, error: coError } = await supabase
      .from('choice_options')
      .select('id, choice_id')
    
    if (coError) {
      console.error('Error fetching choice_options:', coError)
      return NextResponse.json(
        { success: false, message: `Error fetching choice_options: ${coError.message}` },
        { status: 500 }
      )
    }

    // option_id -> choice_id 매핑 생성
    const optionToChoiceMap = new Map<string, string>()
    if (choiceOptionsData) {
      for (const opt of choiceOptionsData) {
        optionToChoiceMap.set(opt.id, opt.choice_id)
      }
    }
    console.log(`Loaded ${optionToChoiceMap.size} option_id -> choice_id mappings`)

    let totalProcessed = 0
    let totalCreated = 0
    let totalSkipped = 0
    let totalErrors = 0
    const errorMessages: string[] = []
    const pageSize = 1000 // 한 번에 1000개씩 처리
    let hasMore = true
    let offset = 0

    while (hasMore) {
      // selected_options가 null이 아닌 예약들 조회
      const { data: reservations, error: fetchError } = await supabase
        .from('reservations')
        .select('id, selected_options')
        .not('selected_options', 'is', null)
        .range(offset, offset + pageSize - 1)

      if (fetchError) {
        console.error('Error fetching reservations:', fetchError)
        return NextResponse.json(
          { success: false, message: `Error fetching reservations: ${fetchError.message}` },
          { status: 500 }
        )
      }

      if (!reservations || reservations.length === 0) {
        hasMore = false
        break
      }

      console.log(`Processing batch ${Math.floor(offset / pageSize) + 1}: ${reservations.length} reservations`)

      // 각 예약의 selected_options를 reservation_choices로 변환
      for (const reservation of reservations) {
        totalProcessed++

        if (!reservation.selected_options || typeof reservation.selected_options !== 'object') {
          totalSkipped++
          continue
        }

        const selectedOptions = reservation.selected_options as Record<string, string[]>
        
        // 비어있는 selected_options 스킵
        const hasValues = Object.values(selectedOptions).some(arr => arr && arr.length > 0)
        if (!hasValues) {
          totalSkipped++
          continue
        }

        // 이미 reservation_choices가 있는지 확인
        const { data: existingChoices } = await supabase
          .from('reservation_choices')
          .select('id')
          .eq('reservation_id', reservation.id)
          .limit(1)

        if (existingChoices && existingChoices.length > 0) {
          // 이미 reservation_choices가 있으면 스킵
          totalSkipped++
          continue
        }

        // selected_options를 reservation_choices로 변환
        const choicesToInsert: Array<{
          reservation_id: string
          choice_id: string
          option_id: string
          quantity: number
          total_price: number
        }> = []

        for (const [, optionIds] of Object.entries(selectedOptions)) {
          if (!optionIds || optionIds.length === 0) continue

          for (const optionId of optionIds) {
            if (!optionId) continue

            // 옵션 ID 마이그레이션 적용 (Antelope X Canyon → Lower Antelope Canyon)
            let finalOptionId = optionId
            if (OPTION_ID_MIGRATION[optionId]) {
              finalOptionId = OPTION_ID_MIGRATION[optionId]
              console.log(`Migrating option_id ${optionId} to ${finalOptionId} for reservation ${reservation.id}`)
            }

            // option_id에 해당하는 choice_id 조회
            let choiceId = optionToChoiceMap.get(finalOptionId)
            
            // 마이그레이션된 ID로도 찾지 못하면 원본 ID로 시도
            if (!choiceId && finalOptionId !== optionId) {
              choiceId = optionToChoiceMap.get(optionId)
            }
            
            if (!choiceId) {
              // 매핑이 없으면 에러 로그
              if (errorMessages.length < 10) {
                errorMessages.push(`No choice_id found for option_id: ${optionId} (migrated to: ${finalOptionId}, reservation: ${reservation.id})`)
              }
              continue
            }

            choicesToInsert.push({
              reservation_id: reservation.id,
              choice_id: choiceId,
              option_id: finalOptionId, // 마이그레이션된 option_id 사용
              quantity: 1,
              total_price: 0
            })
          }
        }

        if (choicesToInsert.length === 0) {
          totalSkipped++
          continue
        }

        // reservation_choices에 삽입
        const { error: insertError } = await supabase
          .from('reservation_choices')
          .insert(choicesToInsert)

        if (insertError) {
          console.error(`Error inserting reservation_choices for ${reservation.id}:`, insertError)
          totalErrors++
          if (errorMessages.length < 10) {
            errorMessages.push(`Insert error for ${reservation.id}: ${insertError.message}`)
          }
        } else {
          totalCreated += choicesToInsert.length
        }
      }

      // 다음 페이지로
      offset += pageSize
      hasMore = reservations.length === pageSize

      // 진행 상황 로그
      console.log(`Progress: ${totalProcessed} processed, ${totalCreated} created, ${totalSkipped} skipped, ${totalErrors} errors`)
    }

    const result = {
      success: true,
      message: 'Selected options migration to reservation_choices completed',
      details: {
        totalProcessed,
        totalCreated,
        totalSkipped,
        totalErrors,
        errorMessages: errorMessages.length > 0 ? errorMessages : undefined
      }
    }

    console.log('Migration completed:', result)
    return NextResponse.json(result)

  } catch (error) {
    console.error('Selected options migration error:', error)
    return NextResponse.json(
      { success: false, message: `Migration failed: ${error}` },
      { status: 500 }
    )
  }
}

// GET 요청으로 현재 상태 확인
export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { success: false, message: 'Supabase configuration missing' },
        { status: 500 }
      )
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let needsMigration = 0
    let alreadyMigrated = 0
    let noSelectedOptions = 0

    // 전체 예약 수 확인
    const { count: totalCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })

    // selected_options가 null인 예약 수
    const { count: nullCount } = await supabase
      .from('reservations')
      .select('id', { count: 'exact', head: true })
      .is('selected_options', null)

    noSelectedOptions = nullCount || 0

    // reservation_choices가 있는 예약 수 (distinct reservation_id)
    const { data: reservationIdsWithChoices } = await supabase
      .from('reservation_choices')
      .select('reservation_id')
    
    const uniqueReservationIds = new Set(reservationIdsWithChoices?.map(r => r.reservation_id) || [])
    alreadyMigrated = uniqueReservationIds.size

    // selected_options가 있지만 reservation_choices가 없는 예약 수 확인 (샘플)
    const { data: sampleReservations } = await supabase
      .from('reservations')
      .select('id, selected_options')
      .not('selected_options', 'is', null)
      .limit(1000)

    if (sampleReservations) {
      for (const reservation of sampleReservations) {
        if (!reservation.selected_options) continue
        
        const selectedOptions = reservation.selected_options as Record<string, string[]>
        const hasValues = Object.values(selectedOptions).some(arr => arr && arr.length > 0)
        
        if (!hasValues) continue

        // 이미 reservation_choices가 있는지 확인
        if (!uniqueReservationIds.has(reservation.id)) {
          needsMigration++
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalReservations: totalCount || 0,
        noSelectedOptions,
        sampleSize: sampleReservations?.length || 0,
        needsMigration,
        alreadyMigrated,
        note: 'reservation_choices 테이블 기준입니다. "마이그레이션 필요"는 샘플 1000개 기준 추정치입니다.'
      }
    })

  } catch (error) {
    console.error('Error checking migration status:', error)
    return NextResponse.json(
      { success: false, message: `Error: ${error}` },
      { status: 500 }
    )
  }
}

