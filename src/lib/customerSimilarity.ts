/** 이름·연락처 매칭에 쓰는 최소 필드 */
export type SimilarCustomerMatchRow = {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
}

/** OTA 머천트 공용 이메일 — 유사 고객 매칭·표시에서 제외 */
const IGNORED_SIMILAR_CUSTOMER_EMAILS = new Set(['merchant@klook.com'])

export function isIgnoredSimilarCustomerEmail(email?: string | null): boolean {
  const normalized = email?.trim().toLowerCase()
  return !!normalized && IGNORED_SIMILAR_CUSTOMER_EMAILS.has(normalized)
}

/** 유사 고객 결과에 포함할지 (머천트 공용 이메일 고객 제외, 편집 중 고객은 유지) */
export function shouldIncludeInSimilarCustomerResults(
  customer: SimilarCustomerMatchRow,
  anchorId?: string
): boolean {
  if (anchorId && customer.id === anchorId) return true
  return !isIgnoredSimilarCustomerEmail(customer.email)
}

/** 이름 부분 일치 최소 길이 (JS `"x".includes("") === true` 로 인한 전원 매칭 방지) */
const MIN_NAME_SUBSTR_LEN = 2
/** 숫자만 비교할 때 최소 자릿수 (너무 짧은 번호 오탐 방지) */
const MIN_PHONE_DIGITS_MATCH = 8

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '')
}

/**
 * 새 고객 저장 전 기존 고객 목록과의 유사·중복 검사.
 * - DB에 이름이 비어 있는 행이 있어도 `includes("")` 로 전원 매칭되지 않도록 처리
 * - 전화번호는 포맷(하이픈 등)과 무관하게 숫자만 비교
 */
export function findSimilarCustomersInList<T extends SimilarCustomerMatchRow>(
  customers: T[],
  name: string,
  email?: string,
  phone?: string
): T[] {
  if (!name.trim()) return []

  const nameLower = name.toLowerCase().trim()
  const similarCustomers: T[] = []
  const emailTrim = email?.trim()
  const emailLower = emailTrim && !isIgnoredSimilarCustomerEmail(emailTrim) ? emailTrim.toLowerCase() : ''
  const inputPhoneDigits = phone ? digitsOnly(phone) : ''

  for (const c of customers) {
    if (!shouldIncludeInSimilarCustomerResults(c)) continue

    const customerNameLower = (c.name ?? '').toLowerCase().trim()

    if (customerNameLower && customerNameLower === nameLower) {
      similarCustomers.push(c)
      continue
    }

    if (
      customerNameLower.length >= MIN_NAME_SUBSTR_LEN &&
      nameLower.length >= MIN_NAME_SUBSTR_LEN &&
      (customerNameLower.includes(nameLower) || nameLower.includes(customerNameLower))
    ) {
      if (!similarCustomers.find((sc) => sc.id === c.id)) {
        similarCustomers.push(c)
      }
      continue
    }

    if (
      emailLower &&
      c.email?.trim() &&
      !isIgnoredSimilarCustomerEmail(c.email) &&
      c.email.toLowerCase() === emailLower
    ) {
      if (!similarCustomers.find((sc) => sc.id === c.id)) {
        similarCustomers.push(c)
      }
      continue
    }

    if (inputPhoneDigits.length >= MIN_PHONE_DIGITS_MATCH && c.phone) {
      const cd = digitsOnly(c.phone)
      if (cd.length >= MIN_PHONE_DIGITS_MATCH && cd === inputPhoneDigits) {
        if (!similarCustomers.find((sc) => sc.id === c.id)) {
          similarCustomers.push(c)
        }
      }
    }
  }

  return similarCustomers
}
