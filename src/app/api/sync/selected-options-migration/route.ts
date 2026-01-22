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

    // 먼저 choice_options 테이블에서 option_key -> choice_id, option_id 매핑 가져오기
    const { data: choiceOptionsData, error: coError } = await supabase
      .from('choice_options')
      .select('id, choice_id, option_key')
    
    if (coError) {
      console.error('Error fetching choice_options:', coError)
      return NextResponse.json(
        { success: false, message: `Error fetching choice_options: ${coError.message}` },
        { status: 500 }
      )
    }

    // option_key -> choice_id, option_id 매핑 생성
    // selected_options의 키는 option_key이므로 이를 사용
    const optionKeyToChoiceMap = new Map<string, { choiceId: string; optionId: string }>()
    const optionIdToChoiceMap = new Map<string, string>() // 백업용: option_id -> choice_id
    
    if (choiceOptionsData) {
      for (const opt of choiceOptionsData) {
        if (opt.option_key) {
          optionKeyToChoiceMap.set(opt.option_key, {
            choiceId: opt.choice_id,
            optionId: opt.id
          })
        }
        // option_id로도 매핑 생성 (값 배열의 option_id를 위해)
        optionIdToChoiceMap.set(opt.id, opt.choice_id)
      }
    }
    console.log(`Loaded ${optionKeyToChoiceMap.size} option_key -> choice_id mappings, ${optionIdToChoiceMap.size} option_id -> choice_id mappings`)

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

      // 배치로 이미 마이그레이션된 reservation_id 조회 (한 번에)
      const reservationIds = reservations.map(r => r.id)
      const { data: existingChoicesData } = await supabase
        .from('reservation_choices')
        .select('reservation_id')
        .in('reservation_id', reservationIds)
      
      const migratedReservationIds = new Set(
        existingChoicesData?.map(c => c.reservation_id) || []
      )

      // 배치로 모든 choices를 모아서 한 번에 insert
      const allChoicesToInsert: Array<{
        reservation_id: string
        choice_id: string
        option_id: string
        quantity: number
        total_price: number
      }> = []

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

        // 이미 reservation_choices가 있으면 스킵 (배치 조회 결과 사용)
        if (migratedReservationIds.has(reservation.id)) {
          totalSkipped++
          continue
        }

        // selected_options를 reservation_choices로 변환
        // selected_options의 키는 option_key, 값은 option_id 배열
        for (const [optionKey, optionIds] of Object.entries(selectedOptions)) {
          if (!optionKey) continue
          
          // option_key로 choice_id 찾기 (selected_options의 키가 option_key)
          let choiceMapping = optionKeyToChoiceMap.get(optionKey)
          
          // option_key로 찾지 못하면, 값 배열의 첫 번째 option_id로도 시도 (백업)
          // 키와 값이 같은 경우가 있을 수 있음 (option_key == option_id)
          if (!choiceMapping && optionIds && optionIds.length > 0) {
            const firstOptionId = optionIds[0]
            if (firstOptionId) {
              // option_id로 choice_id 찾기
              const choiceId = optionIdToChoiceMap.get(firstOptionId)
              if (choiceId) {
                // option_id를 option_key로 사용하는 경우도 있으므로 매핑 생성
                choiceMapping = {
                  choiceId: choiceId,
                  optionId: firstOptionId
                }
              }
            }
          }
          
          if (!choiceMapping) {
            // option_key로 찾지 못하면 에러 로그 (최대 10개만)
            if (errorMessages.length < 10) {
              errorMessages.push(`No choice_id found for option_key: ${optionKey} (reservation: ${reservation.id})`)
            }
            continue
          }

          // optionIds 배열이 비어있으면 스킵 (선택하지 않은 옵션)
          if (!optionIds || optionIds.length === 0) {
            continue
          }

          // 각 option_id에 대해 reservation_choice 생성
          // 값 배열의 요소는 option_id일 수도 있고 option_key일 수도 있음
          for (const optionValue of optionIds) {
            if (!optionValue) continue

            let finalOptionId: string | undefined
            let finalChoiceId: string | undefined

            // 1차 시도: option_key로 조회 (값이 option_key일 수 있음)
            const optionKeyMapping = optionKeyToChoiceMap.get(optionValue)
            if (optionKeyMapping) {
              finalChoiceId = optionKeyMapping.choiceId
              finalOptionId = optionKeyMapping.optionId
            } else {
              // 2차 시도: option_id로 조회
              let testOptionId = optionValue
              
              // 옵션 ID 마이그레이션 적용
              if (OPTION_ID_MIGRATION[testOptionId]) {
                testOptionId = OPTION_ID_MIGRATION[testOptionId]
              }

              const optionChoiceId = optionIdToChoiceMap.get(testOptionId)
              if (optionChoiceId) {
                finalChoiceId = optionChoiceId
                finalOptionId = testOptionId
              } else {
                // 마이그레이션된 ID로도 찾지 못하면 원본 ID로 시도
                const originalChoiceId = optionIdToChoiceMap.get(optionValue)
                if (originalChoiceId) {
                  finalChoiceId = originalChoiceId
                  finalOptionId = optionValue
                }
              }
            }

            // 둘 다 실패하면 choiceMapping의 choice_id를 사용하고 option_id는 값 그대로 사용
            if (!finalChoiceId) {
              // option_key로 찾은 choice_id 사용 (같은 choice 그룹 내의 옵션들이므로)
              finalChoiceId = choiceMapping.choiceId
              
              // option_id는 값 그대로 사용 (나중에 수정될 수 있음)
              finalOptionId = optionValue
            }

            if (!finalChoiceId) {
              if (errorMessages.length < 10) {
                errorMessages.push(`No choice_id found for option_key: ${optionKey}, option_value: ${optionValue} (reservation: ${reservation.id})`)
              }
              continue
            }

            if (!finalOptionId) {
              finalOptionId = optionValue
            }

            allChoicesToInsert.push({
              reservation_id: reservation.id,
              choice_id: finalChoiceId,
              option_id: finalOptionId,
              quantity: 1,
              total_price: 0
            })
          }
        }
      }

      // 배치로 한 번에 insert (빈 배열이 아닐 때만)
      if (allChoicesToInsert.length > 0) {
        // 큰 배치를 더 작은 청크로 나누어 insert (Supabase 제한 고려)
        const insertChunkSize = 500
        for (let i = 0; i < allChoicesToInsert.length; i += insertChunkSize) {
          const chunk = allChoicesToInsert.slice(i, i + insertChunkSize)
          const { error: insertError } = await supabase
            .from('reservation_choices')
            .insert(chunk)

          if (insertError) {
            console.error(`Error inserting reservation_choices batch:`, insertError)
            totalErrors += chunk.length
            if (errorMessages.length < 10) {
              errorMessages.push(`Insert error: ${insertError.message}`)
            }
          } else {
            totalCreated += chunk.length
          }
        }
      } else {
        // choicesToInsert가 비어있으면 모두 스킵된 것
        totalSkipped += reservations.length
      }

      // 다음 페이지로
      offset += pageSize
      hasMore = reservations.length === pageSize

      // 진행 상황 로그 (배치마다만 출력)
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

