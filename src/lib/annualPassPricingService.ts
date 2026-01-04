/**
 * 애뉴얼 패스 관련 가격 계산 서비스
 * 
 * 애뉴얼 패스 구매 시:
 * - 구매자: $250
 * - 동행자: $0 (최대 3명, 구매자 포함 최대 4인까지)
 * - 다중 캐년: 애뉴얼 패스 1개로 모든 캐년 커버
 */

export interface SelectedChoice {
  choiceId: string
  choiceGroup: string
  optionId: string
  optionKey: string
  price?: number
  participantType?: 'adult' | 'child' | 'infant'
}

export interface AnnualPassPricingResult {
  totalPrice: number
  annualPassBuyers: number
  companions: number
  coveredPeople: number
  individualFees: number
  breakdown: {
    annualPassPrice: number
    companionPrice: number
    individualFeePrice: number
  }
}

/**
 * 국립공원 입장료 가격 계산 (애뉴얼 패스 로직 포함)
 * 
 * @param selectedChoices 선택된 초이스 목록
 * @param adults 성인 수
 * @param children 아동 수
 * @param infants 유아 수
 * @returns 가격 계산 결과
 */
export function calculateNationalParkFees(
  selectedChoices: SelectedChoice[],
  adults: number = 0,
  children: number = 0,
  infants: number = 0
): AnnualPassPricingResult {
  // 애뉴얼 패스 관련 옵션 키
  const ANNUAL_PASS_BUYER_KEY = 'annual_pass_buyer'
  const ANNUAL_PASS_COMPANION_KEY = 'annual_pass_companion'
  const US_RESIDENT_KEY = 'us_resident'
  const NON_RESIDENT_KEY = 'non_resident'

  // 애뉴얼 패스 구매자 찾기
  const annualPassBuyers = selectedChoices.filter(
    c => c.optionKey === ANNUAL_PASS_BUYER_KEY
  )

  // 애뉴얼 패스 동행자 찾기
  const companions = selectedChoices.filter(
    c => c.optionKey === ANNUAL_PASS_COMPANION_KEY
  )

  // 일반 입장료 옵션 찾기
  const individualFees = selectedChoices.filter(
    c => c.optionKey === US_RESIDENT_KEY || c.optionKey === NON_RESIDENT_KEY
  )

  // 애뉴얼 패스 모드인지 확인
  const isAnnualPassMode = annualPassBuyers.length > 0

  if (isAnnualPassMode) {
    // 애뉴얼 패스 모드
    const annualPassCount = annualPassBuyers.length
    const companionCount = companions.length
    
    // 구매자당 최대 3명 동행 가능 (구매자 포함 최대 4인)
    const maxCompanionsPerPass = 3
    const maxTotalCompanions = annualPassCount * maxCompanionsPerPass
    const validCompanions = Math.min(companionCount, maxTotalCompanions)

    // 애뉴얼 패스 가격: $250 per pass
    const annualPassPrice = annualPassCount * 250
    
    // 동행자 가격: $0
    const companionPrice = 0

    // 커버된 인원 수 (구매자 + 동행자)
    const coveredPeople = annualPassCount + validCompanions

    return {
      totalPrice: annualPassPrice + companionPrice,
      annualPassBuyers: annualPassCount,
      companions: validCompanions,
      coveredPeople,
      individualFees: 0,
      breakdown: {
        annualPassPrice,
        companionPrice,
        individualFeePrice: 0
      }
    }
  } else {
    // 일반 입장료 모드
    let individualFeePrice = 0

    individualFees.forEach(choice => {
      if (choice.optionKey === US_RESIDENT_KEY) {
        // 미국 거주자: $8 per person
        individualFeePrice += 8 * (adults + children + infants)
      } else if (choice.optionKey === NON_RESIDENT_KEY) {
        // 비 거주자: $100 per person
        individualFeePrice += 100 * (adults + children + infants)
      } else if (choice.price) {
        // 동적 가격이 있는 경우
        individualFeePrice += choice.price * (adults + children + infants)
      }
    })

    return {
      totalPrice: individualFeePrice,
      annualPassBuyers: 0,
      companions: 0,
      coveredPeople: 0,
      individualFees: individualFees.length,
      breakdown: {
        annualPassPrice: 0,
        companionPrice: 0,
        individualFeePrice
      }
    }
  }
}

/**
 * 다중 캐년 통합 가격 계산
 * 
 * 여러 캐년에서 애뉴얼 패스가 적용되는 경우:
 * - 애뉴얼 패스 1개로 모든 캐년 커버
 * - 각 캐년별로 개별 입장료를 내거나 애뉴얼 패스로 통합 커버
 * 
 * @param canyonChoices 각 캐년별 선택된 초이스 (그룹별로 분리)
 * @param adults 성인 수
 * @param children 아동 수
 * @param infants 유아 수
 * @returns 가격 계산 결과
 */
export function calculateMultiCanyonFees(
  canyonChoices: Record<string, SelectedChoice[]>,
  adults: number = 0,
  children: number = 0,
  infants: number = 0
): AnnualPassPricingResult {
  const canyonNames = Object.keys(canyonChoices)
  
  // 모든 캐년에서 애뉴얼 패스 구매자 찾기
  let annualPassBuyers: SelectedChoice[] = []
  let companions: SelectedChoice[] = []
  let individualFees: SelectedChoice[] = []

  canyonNames.forEach(canyonName => {
    const choices = canyonChoices[canyonName] || []
    annualPassBuyers.push(...choices.filter(c => c.optionKey === 'annual_pass_buyer'))
    companions.push(...choices.filter(c => c.optionKey === 'annual_pass_companion'))
    individualFees.push(...choices.filter(c => 
      c.optionKey === 'us_resident' || c.optionKey === 'non_resident'
    ))
  })

  // 애뉴얼 패스 모드인지 확인
  const isAnnualPassMode = annualPassBuyers.length > 0

  if (isAnnualPassMode) {
    // 애뉴얼 패스 모드: 1개로 모든 캐년 커버
    // 중복 제거 (같은 사람이 여러 캐년에서 선택한 경우)
    const uniqueAnnualPassBuyers = annualPassBuyers.filter(
      (buyer, index, self) => 
        index === self.findIndex(b => b.optionId === buyer.optionId)
    )
    
    const uniqueCompanions = companions.filter(
      (companion, index, self) => 
        index === self.findIndex(c => c.optionId === companion.optionId)
    )

    const annualPassCount = uniqueAnnualPassBuyers.length
    const companionCount = uniqueCompanions.length
    
    // 구매자당 최대 3명 동행 가능
    const maxCompanionsPerPass = 3
    const maxTotalCompanions = annualPassCount * maxCompanionsPerPass
    const validCompanions = Math.min(companionCount, maxTotalCompanions)

    // 애뉴얼 패스 가격: $250 per pass (모든 캐년 커버)
    const annualPassPrice = annualPassCount * 250
    
    // 동행자 가격: $0 (모든 캐년 커버)
    const companionPrice = 0

    // 커버된 인원 수
    const coveredPeople = annualPassCount + validCompanions

    return {
      totalPrice: annualPassPrice + companionPrice,
      annualPassBuyers: annualPassCount,
      companions: validCompanions,
      coveredPeople,
      individualFees: 0,
      breakdown: {
        annualPassPrice,
        companionPrice,
        individualFeePrice: 0
      }
    }
  } else {
    // 일반 입장료 모드: 각 캐년별로 개별 계산
    let totalIndividualFeePrice = 0

    canyonNames.forEach(canyonName => {
      const choices = canyonChoices[canyonName] || []
      const canyonFees = calculateNationalParkFees(choices, adults, children, infants)
      totalIndividualFeePrice += canyonFees.totalPrice
    })

    return {
      totalPrice: totalIndividualFeePrice,
      annualPassBuyers: 0,
      companions: 0,
      coveredPeople: 0,
      individualFees: individualFees.length,
      breakdown: {
        annualPassPrice: 0,
        companionPrice: 0,
        individualFeePrice: totalIndividualFeePrice
      }
    }
  }
}

/**
 * 초이스 선택 검증
 * 
 * @param selectedChoices 선택된 초이스 목록
 * @param totalPeople 총 인원 수
 * @returns 검증 결과
 */
export function validateAnnualPassSelection(
  selectedChoices: SelectedChoice[],
  totalPeople: number
): { valid: boolean; error?: string } {
  const annualPassBuyers = selectedChoices.filter(
    c => c.optionKey === 'annual_pass_buyer'
  )
  const companions = selectedChoices.filter(
    c => c.optionKey === 'annual_pass_companion'
  )
  const individualFees = selectedChoices.filter(
    c => c.optionKey === 'us_resident' || c.optionKey === 'non_resident'
  )

  // 애뉴얼 패스 모드인지 확인
  if (annualPassBuyers.length > 0) {
    // 애뉴얼 패스 구매자가 있으면 일반 입장료는 선택 불가
    if (individualFees.length > 0) {
      return {
        valid: false,
        error: '애뉴얼 패스 구매자와 일반 입장료를 동시에 선택할 수 없습니다.'
      }
    }

    // 동행자 수량 검증
    const maxCompanions = annualPassBuyers.length * 3
    if (companions.length > maxCompanions) {
      return {
        valid: false,
        error: `애뉴얼 패스 구매자 ${annualPassBuyers.length}명당 최대 ${maxCompanions}명의 동행자가 가능합니다.`
      }
    }

    // 총 인원 수 검증 (구매자 + 동행자)
    const totalCovered = annualPassBuyers.length + companions.length
    if (totalCovered > totalPeople) {
      return {
        valid: false,
        error: `선택한 인원 수(${totalCovered}명)가 총 인원 수(${totalPeople}명)를 초과합니다.`
      }
    }
  } else {
    // 일반 입장료 모드: 애뉴얼 패스 동행자는 선택 불가
    if (companions.length > 0) {
      return {
        valid: false,
        error: '애뉴얼 패스 구매자 없이는 동행자 옵션을 선택할 수 없습니다.'
      }
    }
  }

  return { valid: true }
}

/**
 * 초이스 그룹이 국립공원 입장료인지 확인
 * 
 * @param choiceGroup 초이스 그룹 이름
 * @returns 국립공원 입장료 여부
 */
export function isNationalParkFeeGroup(choiceGroup: string): boolean {
  const nationalParkFeeGroups = [
    'national_park_fee',
    'grand_canyon_fee',
    'zion_canyon_fee',
    'bryce_canyon_fee',
    'grand_canyon',
    'zion_canyon',
    'bryce_canyon'
  ]
  
  return nationalParkFeeGroups.some(group => 
    choiceGroup.toLowerCase().includes(group.toLowerCase())
  )
}



