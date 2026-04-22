/** 표준 리프 선택 시 유사 항목 혼동 방지를 위한 재확인 대상 id */
export const STANDARD_LEAF_IDS_REQUIRING_DOUBLE_CHECK = [
  'CAT024-001',
  'CAT002-001',
  'CAT002-003',
] as const

export type StandardLeafDoubleCheckId = (typeof STANDARD_LEAF_IDS_REQUIRING_DOUBLE_CHECK)[number]

export function standardLeafRequiresDoubleCheck(leafId: string): leafId is StandardLeafDoubleCheckId {
  return (STANDARD_LEAF_IDS_REQUIRING_DOUBLE_CHECK as readonly string[]).includes(leafId)
}

/** next-intl 키: companyExpense.standardLeafDoubleCheck.<key> */
export function standardLeafDoubleCheckMessageKeys(leafId: StandardLeafDoubleCheckId): {
  titleKey: 'bentoCogsTitle' | 'guideBusinessMealsTitle' | 'tourCustomerMealsTitle'
  bodyKey: 'bentoCogsBody' | 'guideBusinessMealsBody' | 'tourCustomerMealsBody'
} {
  switch (leafId) {
    case 'CAT024-001':
      return { titleKey: 'bentoCogsTitle', bodyKey: 'bentoCogsBody' }
    case 'CAT002-001':
      return { titleKey: 'guideBusinessMealsTitle', bodyKey: 'guideBusinessMealsBody' }
    case 'CAT002-003':
      return { titleKey: 'tourCustomerMealsTitle', bodyKey: 'tourCustomerMealsBody' }
  }
}
