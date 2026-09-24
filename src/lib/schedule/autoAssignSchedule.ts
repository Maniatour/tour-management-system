import { canGuideProduct, guideLanguagePriorityScore, guideLanguagePrioritySummary, type GuideProductSkills } from '@/lib/guideProductSkills'
import { collectStaffScheduleLocales } from '@/lib/scheduleGuideLanguageMatch'
import { addDaysToYmd } from '@/utils/tourUtils'
import { isTourStatusForVehicleScheduleDayCount } from '@/utils/tourStatusUtils'

export const AUTO_ASSIGN_MAX_DAYS = 14

export type AutoAssignPreset = 'equal' | 'priority' | 'reviews'
export type AutoAssignExistingMode = 'keep' | 'reset'

export type AutoAssignRole = 'guide' | 'assistant'

export type AutoAssignTeamType = '1guide' | '2guide' | 'guide+driver'

export type AutoAssignUnfilledReason =
  | 'language'
  | 'off'
  | 'rest'
  | 'never_pair'
  | 'cdl'
  | 'product'
  | 'no_candidate'

export type AutoAssignMember = {
  email: string
  name: string
  nickName?: string | null
  nameKo?: string | null
  nameEn?: string | null
  languages?: string[] | null
  active: boolean
  cdl: boolean
  doNotTeamWith?: string[] | null
  avoidTeamWith?: string[] | null
  guideProductSkills?: GuideProductSkills | null
}

export type AutoAssignGuestPeople = { ko: number; ja: number; en: number }

export type AutoAssignTour = {
  id: string
  tourDate: string
  productId: string
  productName?: string | null
  teamType: AutoAssignTeamType
  tourStatus: string | null
  guideEmail: string | null
  assistantEmail: string | null
  guideLocked: boolean
  assistantLocked: boolean
  spanDays: number
  isGoblin: boolean
  guestPeople: AutoAssignGuestPeople
}

export type AutoAssignOff = {
  email: string
  date: string
}

export type AutoAssignReviewStat = {
  email: string
  avgRating: number | null
  reviewCount: number
  /** 지난달 투어일 기준 인원별 리뷰율. 후기 수 ÷ 배정 인원 × 100 */
  guestReviewRatePercent: number | null
}

export type AutoAssignInput = {
  startDate: string
  endDate: string
  preset: AutoAssignPreset
  members: AutoAssignMember[]
  tours: AutoAssignTour[]
  offs: AutoAssignOff[]
  /** null이면 후기 통계를 읽지 못한 것. 균등 배정으로 대체한다. */
  reviewStats?: AutoAssignReviewStat[] | null
  /** 0이면 기본 안. 올리면 같은 규칙 안에서 다른 배정 순서를 쓴다. */
  variant?: number
  /** keep이면 이미 들어간 배정을 두고 빈칸만 채운다. reset이면 잠긴 배정만 남기고 다시 나눈다. */
  existingMode?: AutoAssignExistingMode
}

export type AutoAssignSlotResult = {
  tourId: string
  role: AutoAssignRole
  email: string | null
  locked: boolean
  avoidPair: boolean
  unfilledReason: AutoAssignUnfilledReason | null
  reasonLines: string[]
}

export type AutoAssignTourAssignment = {
  tour_guide_id: string | null
  assistant_id: string | null
}

export type AutoAssignResult = {
  preset: AutoAssignPreset
  effectivePreset: AutoAssignPreset
  reviewStatsUnavailable: boolean
  variant: number
  /** 직전 안과 다른 배정을 찾지 못했다. */
  alternativeExhausted: boolean
  slots: AutoAssignSlotResult[]
  assignmentsByTourId: Record<string, AutoAssignTourAssignment>
}

export function assignmentSignature(assignments: Record<string, AutoAssignTourAssignment>): string {
  return Object.keys(assignments)
    .sort()
    .map((id) => `${id}:${assignments[id]?.tour_guide_id || ''}:${assignments[id]?.assistant_id || ''}`)
    .join('|')
}

export const AUTO_ASSIGN_PRESET_LABEL: Record<AutoAssignPreset, string> = {
  equal: '균등 배정',
  priority: '가이드 우선순위',
  reviews: '후기 순 배정',
}

export const AUTO_ASSIGN_EXISTING_LABEL: Record<AutoAssignExistingMode, string> = {
  keep: '기존 배정 유지',
  reset: '기존 배정 리셋',
}

/** 지난달 평점에 인원별 리뷰율(후기 ÷ 배정 인원)을 곱한다. 후기 1개의 5점은 배정 인원 대비 비율이 낮으면 뒤로 간다. */
export function reviewPriorityScore(
  stat: { avgRating: number | null; guestReviewRatePercent?: number | null } | undefined,
): number {
  const rate = stat?.guestReviewRatePercent
  const rating = stat?.avgRating
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 0
  if (rating == null || !Number.isFinite(rating) || rating <= 0) return 0
  return Math.min(5, rating) * rate
}

export function previousCalendarMonth(now: Date): { year: number; month: number } {
  const monthIndex = now.getMonth()
  if (monthIndex === 0) return { year: now.getFullYear() - 1, month: 12 }
  return { year: now.getFullYear(), month: monthIndex }
}

export function guestReviewRatePercentOf(cell: {
  reviewCount: number
  totalTourGuests: number
  guestReviewRatePercent: number | null
}): number | null {
  if (cell.totalTourGuests <= 0) return null
  if (typeof cell.guestReviewRatePercent === 'number' && Number.isFinite(cell.guestReviewRatePercent)) {
    return cell.guestReviewRatePercent
  }
  return (Math.max(0, cell.reviewCount) / cell.totalTourGuests) * 100
}

export const AUTO_ASSIGN_UNFILLED_LABEL: Record<AutoAssignUnfilledReason, string> = {
  language: '언어가 맞는 사람이 없습니다',
  off: '오프라 배정할 수 없습니다',
  rest: '밤도깨비 휴식 때문에 배정할 수 없습니다',
  never_pair: '절대 금지 조합이라 배정할 수 없습니다',
  cdl: 'CDL 드라이버가 없습니다',
  product: '이 상품을 진행할 수 있는 가이드가 없습니다',
  no_candidate: '배정할 수 있는 사람이 없습니다',
}

export const AUTO_ASSIGN_RULE_LINES = [
  '고객의 한국어·영어·일본어는 가이드와 어시스턴트 언어를 합쳐 맞춰야 합니다.',
  '오프인 날은 배정하지 않습니다.',
  '밤도깨비는 이틀 연속으로 가지 않습니다. 전날 일정이 있으면 그날은 쉬고 다음날 후보가 됩니다. 밤도깨비 다음날은 다른 투어도 쉬어 갑니다.',
  '절대 금지는 팀을 만들지 않습니다. 기피는 다른 조합이 없을 때만 쓰고, 그때는 경고를 남깁니다.',
  '고객이 지정해 잠긴 배정은 바꾸지 않습니다.',
  '한 사람은 같은 날 한 투어만 갑니다. 멀티데이는 끝나는 날까지 점유합니다.',
  '가이드+드라이버의 드라이버는 CDL이 있어야 합니다.',
  '진행 가능으로 체크된 가이드를 먼저 배정하고, 손님 언어 우선순위는 상, 중, 하 순입니다. 기존 배정 리셋에서 그 날짜에 체크된 사람이 없으면 언어와 오프가 맞는 다른 사람을 배정합니다.',
  'Joey와 채드는 우선순위에서 빼고, 다른 사람이 불가할 때만 배정합니다.',
  '날마다 앞에서 채우지 않고, 기간 전체 슬롯과 가능한 날을 보고 나눕니다.',
]

export const AUTO_ASSIGN_LATER_LINES = [
  '연속 근무 상한, 주말만 따로 나누기, 공항 픽업·샌딩과 당일 투어 겹침 금지는 아직 쓰지 않습니다.',
  '차량 배차는 아직 쓰지 않습니다.',
]

type RejectCode =
  | 'inactive'
  | 'off'
  | 'occupied'
  | 'rest'
  | 'goblin_prev'
  | 'cdl'
  | 'language'
  | 'product'
  | 'never'
  | 'same_person'

type PersonState = {
  email: string
  key: string
  member: AutoAssignMember
  priorityIndex: number
  owner: boolean
  occupied: Set<string>
  off: Set<string>
  goblinDates: Set<string>
  restDates: Set<string>
  assignedInRange: number
  target: number
}

function emailKey(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase()
}

export function isAutoAssignPriorityExcluded(member: {
  email: string
  name?: string | null
  nickName?: string | null
  nameKo?: string | null
  nameEn?: string | null
}): boolean {
  const blob = [member.email, member.name, member.nickName, member.nameKo, member.nameEn]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
  if (/\bjoey\b/i.test(blob) || /\bchad\b/i.test(blob)) return true
  if (blob.includes('채드')) return true
  return false
}

export function clampAutoAssignRange(startDate: string, endDate: string): { startDate: string; endDate: string } {
  const start = String(startDate || '').slice(0, 10)
  let end = String(endDate || '').slice(0, 10)
  if (!start || !end || end < start) return { startDate: start, endDate: start }
  const maxEnd = addDaysToYmd(start, AUTO_ASSIGN_MAX_DAYS - 1)
  if (maxEnd && end > maxEnd) end = maxEnd
  return { startDate: start, endDate: end }
}

export function defaultAutoAssignRange(
  visibleUntil: string | null | undefined,
  today: string,
): { startDate: string; endDate: string } {
  const until = String(visibleUntil || '').slice(0, 10)
  const start = /^\d{4}-\d{2}-\d{2}$/.test(until) ? addDaysToYmd(until, 1) : addDaysToYmd(today, 1)
  return clampAutoAssignRange(start, addDaysToYmd(start, AUTO_ASSIGN_MAX_DAYS - 1))
}

export function eachAutoAssignDate(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  let cursor = startDate
  while (cursor && cursor <= endDate && dates.length <= AUTO_ASSIGN_MAX_DAYS + 2) {
    dates.push(cursor)
    cursor = addDaysToYmd(cursor, 1)
  }
  return dates
}

function spanDates(tour: AutoAssignTour): string[] {
  const span = Math.max(1, tour.spanDays || 1)
  const dates: string[] = []
  let cursor = tour.tourDate
  for (let i = 0; i < span && cursor; i += 1) {
    dates.push(cursor)
    cursor = addDaysToYmd(cursor, 1)
  }
  return dates
}

function needsAssistant(tour: AutoAssignTour): boolean {
  if (tour.spanDays > 1) return false
  return tour.teamType === '2guide' || tour.teamType === 'guide+driver'
}

function isInRange(tour: AutoAssignTour, startDate: string, endDate: string): boolean {
  return tour.tourDate >= startDate && tour.tourDate <= endDate
}

function normalizePairEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase()
}

function pairListHas(list: string[] | null | undefined, email: string): boolean {
  return (list || []).some((item) => normalizePairEmail(item) === email)
}

/** teamDoNotTeamWith.getTeamPairRestriction 과 동일: never > avoid, 양방향 */
function pairRestriction(
  emailA: string | null | undefined,
  emailB: string | null | undefined,
  people: PersonState[],
): 'never' | 'avoid' | null {
  const a = normalizePairEmail(emailA)
  const b = normalizePairEmail(emailB)
  if (!a || !b || a === b) return null
  const memberA = people.find((person) => person.key === a)?.member
  const memberB = people.find((person) => person.key === b)?.member
  if (pairListHas(memberA?.doNotTeamWith, b) || pairListHas(memberB?.doNotTeamWith, a)) return 'never'
  if (pairListHas(memberA?.avoidTeamWith, b) || pairListHas(memberB?.avoidTeamWith, a)) return 'avoid'
  return null
}

function requiredGuestLocales(people: AutoAssignGuestPeople): Array<'ko' | 'ja' | 'en'> {
  return (['ko', 'ja', 'en'] as const).filter((locale) => people[locale] > 0)
}

function guestLocaleLabel(locale: 'ko' | 'ja' | 'en'): string {
  if (locale === 'ko') return '한국어'
  if (locale === 'ja') return '일본어'
  return '영어'
}

function languageCovered(
  emails: Array<string | null | undefined>,
  peopleByKey: Map<string, PersonState>,
  required: Array<'ko' | 'ja' | 'en'>,
): boolean {
  if (required.length === 0) return true
  const locales = collectStaffScheduleLocales(
    emails.map((email) => peopleByKey.get(emailKey(email))?.member ?? null),
  )
  return required.every((locale) => locales.includes(locale))
}

function rejection(args: {
  person: PersonState
  tour: AutoAssignTour
  role: AutoAssignRole
  partner: PersonState | null
  language: 'complete' | 'skip'
  peopleByKey: Map<string, PersonState>
  people: PersonState[]
  required: Array<'ko' | 'ja' | 'en'>
  skipProduct?: boolean
}): RejectCode | null {
  const { person, tour, role, partner } = args
  if (!person.member.active && !person.owner) {
    // owners who are inactive are still last-resort only if active flag is true; inactive never
  }
  if (!person.member.active) return 'inactive'
  if (partner && person.key === partner.key) return 'same_person'
  if (role === 'assistant' && tour.teamType === 'guide+driver' && !person.member.cdl) return 'cdl'
  if (
    role === 'guide' &&
    !args.skipProduct &&
    !canGuideProduct(person.member.guideProductSkills, tour.productId)
  ) {
    return 'product'
  }

  const days = spanDates(tour)
  for (const day of days) {
    if (person.off.has(day)) return 'off'
    if (person.occupied.has(day) || person.restDates.has(day)) return person.restDates.has(day) ? 'rest' : 'occupied'
    const next = addDaysToYmd(day, 1)
    if (person.goblinDates.has(next)) return 'goblin_prev'
  }

  if (tour.isGoblin) {
    const prev = addDaysToYmd(tour.tourDate, -1)
    if (person.occupied.has(prev)) return 'goblin_prev'
    const end = days[days.length - 1]
    const rest = addDaysToYmd(end, 1)
    if (person.occupied.has(rest) || person.goblinDates.has(rest) || person.goblinDates.has(prev)) return 'rest'
  }

  if (partner) {
    const level = pairRestriction(person.email, partner.email, args.people)
    if (level === 'never') return 'never'
  }

  if (args.language === 'complete') {
    const emails = [person.email, partner?.email]
    if (!languageCovered(emails, args.peopleByKey, args.required)) return 'language'
  }
  return null
}

function commitAssignment(person: PersonState, tour: AutoAssignTour, inRange: boolean) {
  for (const day of spanDates(tour)) person.occupied.add(day)
  if (tour.isGoblin) {
    person.goblinDates.add(tour.tourDate)
    const days = spanDates(tour)
    const rest = addDaysToYmd(days[days.length - 1], 1)
    if (rest) person.restDates.add(rest)
  }
  if (inRange) person.assignedInRange += 1
}

function deficit(person: PersonState): number {
  return person.target - person.assignedInRange
}

function unfilledFromCounts(counts: Map<RejectCode, number>): AutoAssignUnfilledReason {
  const mapped: Array<[AutoAssignUnfilledReason, number]> = [
    ['cdl', counts.get('cdl') || 0],
    ['product', counts.get('product') || 0],
    ['language', counts.get('language') || 0],
    ['never_pair', counts.get('never') || 0],
    ['rest', (counts.get('rest') || 0) + (counts.get('goblin_prev') || 0)],
    ['off', counts.get('off') || 0],
    ['no_candidate', (counts.get('occupied') || 0) + (counts.get('same_person') || 0) + (counts.get('inactive') || 0)],
  ]
  mapped.sort((a, b) => b[1] - a[1])
  const top = mapped.find((entry) => entry[1] > 0)
  return top ? top[0] : 'no_candidate'
}

function roleLabel(tour: AutoAssignTour, role: AutoAssignRole): string {
  if (role === 'guide') return '가이드'
  return tour.teamType === 'guide+driver' ? '드라이버' : '어시스턴트'
}

function reasonForAssignment(args: {
  preset: AutoAssignPreset
  person: PersonState
  tour: AutoAssignTour
  role: AutoAssignRole
  avoidPair: boolean
  uncheckedProduct?: boolean
  required: Array<'ko' | 'ja' | 'en'>
  review: AutoAssignReviewStat | undefined
}): string[] {
  const lines = [`${AUTO_ASSIGN_PRESET_LABEL[args.preset]} · ${roleLabel(args.tour, args.role)}`]
  if (args.person.owner) {
    lines.push('다른 사람이 불가해 Joey·채드를 마지막 후보로 배정')
  } else if (args.preset === 'priority') {
    lines.push(`가이드 표 ${args.person.priorityIndex + 1}번째 우선 · 이번 구간 ${args.person.assignedInRange}건`)
  } else if (args.preset === 'reviews') {
    const rating = args.review?.avgRating
    const rate = args.review?.guestReviewRatePercent
    lines.push(
      `지난달 평점 ${rating == null ? '없음' : rating.toFixed(1)} · 인원별 리뷰율 ${rate == null || !Number.isFinite(rate) ? '없음' : `${rate.toFixed(1)}%`} · 이번 구간 ${args.person.assignedInRange}건`,
    )
  } else {
    lines.push(`목표 ${args.person.target.toFixed(1)}건 중 이번 구간 ${args.person.assignedInRange}건`)
  }
  if (args.required.length > 0) {
    const labels = args.required.map((locale) => guestLocaleLabel(locale))
    lines.push(`${labels.join('·')} 손님 언어를 맞춤`)
  }
  if (args.role === 'guide') {
    const summary = guideLanguagePrioritySummary(args.person.member.guideProductSkills, args.tour.productId, args.required)
    if (summary) lines.push(summary)
  }
  if (args.role === 'assistant' && args.tour.teamType === 'guide+driver') lines.push('CDL 드라이버')
  if (args.uncheckedProduct) lines.push('진행 가능으로 체크된 사람이 없어 다른 조건으로 배정')
  if (args.avoidPair) lines.push('기피 조합이지만 다른 후보가 없어 배정')
  return lines
}

function setTargets(people: PersonState[], slots: number, preset: AutoAssignPreset, reviews: Map<string, AutoAssignReviewStat>, rangeDays: string[]) {
  const available = (person: PersonState) => {
    let count = 0
    for (const day of rangeDays) {
      if (person.off.has(day) || person.occupied.has(day) || person.restDates.has(day)) continue
      count += 1
    }
    return count
  }
  const pool = people.filter((person) => person.member.active && !person.owner && available(person) > 0)
  const weightOf = (person: PersonState) => {
    const days = available(person)
    if (preset === 'priority') {
      const rank = Math.max(1, pool.length - person.priorityIndex)
      return rank * rank
    }
    if (preset === 'reviews') return reviewPriorityScore(reviews.get(person.key))
    return Math.max(1, days)
  }
  let weights = pool.map((person) => ({ person, weight: weightOf(person), days: available(person) }))
  let total = weights.reduce((sum, row) => sum + row.weight, 0)
  if (total <= 0) {
    weights = pool.map((person) => ({ person, weight: Math.max(1, available(person)), days: available(person) }))
    total = weights.reduce((sum, row) => sum + row.weight, 0)
  }
  for (const person of people) person.target = 0
  if (total <= 0 || slots <= 0) return
  for (const row of weights) {
    row.person.target = Math.min(row.days, (slots * row.weight) / total)
  }
}

export function autoAssignSchedule(input: AutoAssignInput): AutoAssignResult {
  const variant = Math.max(0, Math.floor(input.variant ?? 0))
  const existingMode: AutoAssignExistingMode = input.existingMode === 'keep' ? 'keep' : 'reset'
  const keepsExisting = (email: string | null | undefined, locked: boolean) =>
    Boolean(emailKey(email)) && (locked || existingMode === 'keep')
  const guideHeld = (tour: AutoAssignTour) => keepsExisting(tour.guideEmail, tour.guideLocked)
  const assistantHeld = (tour: AutoAssignTour) => keepsExisting(tour.assistantEmail, tour.assistantLocked)
  const { startDate, endDate } = clampAutoAssignRange(input.startDate, input.endDate)
  const reviewStatsUnavailable = input.preset === 'reviews' && input.reviewStats == null
  const effectivePreset: AutoAssignPreset = reviewStatsUnavailable ? 'equal' : input.preset
  const rangeDays = eachAutoAssignDate(startDate, endDate)
  const reviews = new Map<string, AutoAssignReviewStat>()
  for (const stat of input.reviewStats || []) {
    const key = emailKey(stat.email)
    if (key) reviews.set(key, stat)
  }

  const people: PersonState[] = []
  const peopleByKey = new Map<string, PersonState>()
  let priorityCursor = 0
  input.members.forEach((member, index) => {
    const key = emailKey(member.email)
    if (!key || peopleByKey.has(key)) return
    const owner = isAutoAssignPriorityExcluded(member)
    const person: PersonState = {
      email: member.email.trim(),
      key,
      member,
      priorityIndex: owner ? 1000 + index : priorityCursor,
      owner,
      occupied: new Set(),
      off: new Set(),
      goblinDates: new Set(),
      restDates: new Set(),
      assignedInRange: 0,
      target: 0,
    }
    if (!owner) priorityCursor += 1
    people.push(person)
    peopleByKey.set(key, person)
  })

  const ensurePerson = (email: string | null | undefined): PersonState | null => {
    const key = emailKey(email)
    if (!key) return null
    const existing = peopleByKey.get(key)
    if (existing) return existing
    const person: PersonState = {
      email: String(email).trim(),
      key,
      member: {
        email: String(email).trim(),
        name: String(email).trim(),
        active: false,
        cdl: false,
      },
      priorityIndex: 5000 + people.length,
      owner: false,
      occupied: new Set(),
      off: new Set(),
      goblinDates: new Set(),
      restDates: new Set(),
      assignedInRange: 0,
      target: 0,
    }
    people.push(person)
    peopleByKey.set(key, person)
    return person
  }

  for (const off of input.offs) {
    const person = peopleByKey.get(emailKey(off.email))
    const date = String(off.date || '').slice(0, 10)
    if (person && date) person.off.add(date)
  }

  const assignableTours = input.tours.filter(
    (tour) => tour.tourDate && isTourStatusForVehicleScheduleDayCount(tour.tourStatus),
  )
  const windowTours = assignableTours.filter((tour) => isInRange(tour, startDate, endDate))

  const occupyFixed = (email: string | null | undefined, tour: AutoAssignTour, countInRange: boolean) => {
    const person = ensurePerson(email)
    if (!person || !emailKey(email)) return
    const before = person.assignedInRange
    commitAssignment(person, tour, countInRange)
    if (!countInRange) person.assignedInRange = before
  }

  for (const tour of assignableTours) {
    const inRange = isInRange(tour, startDate, endDate)
    if (!inRange) {
      occupyFixed(tour.guideEmail, tour, false)
      occupyFixed(tour.assistantEmail, tour, false)
      continue
    }
    if (guideHeld(tour)) occupyFixed(tour.guideEmail, tour, true)
    if (assistantHeld(tour)) occupyFixed(tour.assistantEmail, tour, true)
  }

  const openSlotCount = windowTours.reduce((sum, tour) => {
    let count = guideHeld(tour) ? 0 : 1
    if (needsAssistant(tour) && !assistantHeld(tour)) count += 1
    return sum + count
  }, 0)
  setTargets(people, openSlotCount, effectivePreset, reviews, rangeDays)

  const slots: AutoAssignSlotResult[] = []
  const assignmentsByTourId: Record<string, AutoAssignTourAssignment> = {}

  const tieSpan = Math.max(1, people.filter((person) => !person.owner).length)
  const tieRank = (person: PersonState) => (person.priorityIndex + variant) % tieSpan

  const ordered = [...windowTours].sort((a, b) => {
    const scarcity = candidateCount(a) - candidateCount(b)
    if (scarcity !== 0) return scarcity
    if (a.tourDate !== b.tourDate) return a.tourDate < b.tourDate ? -1 : 1
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })

  function candidateCount(tour: AutoAssignTour): number {
    const required = requiredGuestLocales(tour.guestPeople)
    const guideHeldPerson = guideHeld(tour) ? peopleByKey.get(emailKey(tour.guideEmail)) || null : null
    const assistantHeldPerson = assistantHeld(tour) ? peopleByKey.get(emailKey(tour.assistantEmail)) || null : null
    let count = 0
    for (const guide of people) {
      if (guide.owner || !guide.member.active) continue
      if (guideHeld(tour)) {
        if (!guideHeldPerson || guide.key !== guideHeldPerson.key) continue
      } else if (
        rejection({
          person: guide,
          tour,
          role: 'guide',
          partner: assistantHeldPerson,
          language: needsAssistant(tour) && !assistantHeld(tour) ? 'skip' : 'complete',
          peopleByKey,
          people,
          required,
        })
      ) {
        continue
      }
      if (!needsAssistant(tour) || assistantHeld(tour)) {
        count += 1
        continue
      }
      for (const assistant of people) {
        if (assistant.owner || !assistant.member.active || assistant.key === guide.key) continue
        if (
          rejection({
            person: assistant,
            tour,
            role: 'assistant',
            partner: guide,
            language: 'skip',
            peopleByKey,
            people,
            required,
          })
        ) {
          continue
        }
        if (pairRestriction(guide.email, assistant.email, people) === 'never') continue
        if (!languageCovered([guide.email, assistant.email], peopleByKey, required)) continue
        count += 1
      }
    }
    return count
  }

  for (const tour of ordered) {
    const required = requiredGuestLocales(tour.guestPeople)
    const guideHeldPerson = guideHeld(tour) ? ensurePerson(tour.guideEmail) : null
    const assistantHeldPerson = assistantHeld(tour) ? ensurePerson(tour.assistantEmail) : null
    let guideEmail = guideHeld(tour) ? guideHeldPerson?.email || tour.guideEmail : null
    let assistantEmail = assistantHeld(tour) ? assistantHeldPerson?.email || tour.assistantEmail : null
    const heldReason = (locked: boolean) => (locked ? '고객 지정 잠금으로 유지' : '기존 배정을 유지')

    if (guideHeld(tour) && guideHeldPerson) {
      slots.push({
        tourId: tour.id,
        role: 'guide',
        email: guideHeldPerson.email,
        locked: tour.guideLocked,
        avoidPair: false,
        unfilledReason: null,
        reasonLines: [heldReason(tour.guideLocked)],
      })
    }
    if (assistantHeld(tour) && assistantHeldPerson && (needsAssistant(tour) || tour.assistantEmail)) {
      slots.push({
        tourId: tour.id,
        role: 'assistant',
        email: assistantHeldPerson.email,
        locked: tour.assistantLocked,
        avoidPair: false,
        unfilledReason: null,
        reasonLines: [heldReason(tour.assistantLocked)],
      })
    }

    const guideOpen = !guideHeld(tour)
    const assistantOpen = needsAssistant(tour) && !assistantHeld(tour)

    if (guideOpen && assistantOpen) {
      const placed = placePair(tour, required, false)
      guideEmail = placed.guide
      assistantEmail = placed.assistant
    } else if (guideOpen) {
      guideEmail = placeSingle(tour, 'guide', assistantHeldPerson, required, false)
    } else if (assistantOpen) {
      assistantEmail = placeSingle(tour, 'assistant', guideHeldPerson, required, false)
    }

    assignmentsByTourId[tour.id] = {
      tour_guide_id: guideEmail,
      assistant_id: assistantHeld(tour) || needsAssistant(tour) ? assistantEmail : null,
    }
  }

  return {
    preset: input.preset,
    effectivePreset,
    reviewStatsUnavailable,
    variant,
    alternativeExhausted: false,
    slots,
    assignmentsByTourId,
  }

  function placeSingle(
    tour: AutoAssignTour,
    role: AutoAssignRole,
    partner: PersonState | null,
    required: Array<'ko' | 'ja' | 'en'>,
    relaxProduct: boolean,
  ): string | null {
    const counts = new Map<RejectCode, number>()
    const preferred: PersonState[] = []
    const avoiders: PersonState[] = []
    for (const person of people) {
      const code = rejection({
        person,
        tour,
        role,
        partner,
        language: 'complete',
        peopleByKey,
        people,
        required,
        skipProduct: relaxProduct,
      })
      if (code) {
        counts.set(code, (counts.get(code) || 0) + 1)
        continue
      }
      const level = partner ? pairRestriction(person.email, partner.email, people) : null
      if (level === 'avoid') avoiders.push(person)
      else preferred.push(person)
    }
    const pool = preferred.length > 0 ? preferred : avoiders
    const chosen = pickPerson(pool, tour, role)
    if (!chosen && !relaxProduct && existingMode === 'reset' && role === 'guide') {
      return placeSingle(tour, role, partner, required, true)
    }
    if (!chosen) {
      slots.push({
        tourId: tour.id,
        role,
        email: null,
        locked: false,
        avoidPair: false,
        unfilledReason: unfilledFromCounts(counts),
        reasonLines: [AUTO_ASSIGN_UNFILLED_LABEL[unfilledFromCounts(counts)]],
      })
      return null
    }
    const avoidPair = preferred.length === 0 && avoiders.length > 0
    commitAssignment(chosen, tour, true)
    slots.push({
      tourId: tour.id,
      role,
      email: chosen.email,
      locked: false,
      avoidPair,
      unfilledReason: null,
      reasonLines: reasonForAssignment({
        preset: effectivePreset,
        person: chosen,
        tour,
        role,
        avoidPair,
        uncheckedProduct: relaxProduct,
        required,
        review: reviews.get(chosen.key),
      }),
    })
    return chosen.email
  }

  function placePair(
    tour: AutoAssignTour,
    required: Array<'ko' | 'ja' | 'en'>,
    relaxProduct: boolean,
  ): { guide: string | null; assistant: string | null } {
    type Pair = { guide: PersonState; assistant: PersonState; avoid: boolean }
    const pairs: Pair[] = []
    const counts = new Map<RejectCode, number>()
    for (const guide of people) {
      const guideCode = rejection({
        person: guide,
        tour,
        role: 'guide',
        partner: null,
        language: 'skip',
        peopleByKey,
        people,
        required,
        skipProduct: relaxProduct,
      })
      if (guideCode) {
        counts.set(guideCode, (counts.get(guideCode) || 0) + 1)
        continue
      }
      for (const assistant of people) {
        if (assistant.key === guide.key) continue
        const assistantCode = rejection({
          person: assistant,
          tour,
          role: 'assistant',
          partner: guide,
          language: 'skip',
          peopleByKey,
          people,
          required,
        })
        if (assistantCode) {
          counts.set(assistantCode, (counts.get(assistantCode) || 0) + 1)
          continue
        }
        if (pairRestriction(guide.email, assistant.email, people) === 'never') {
          counts.set('never', (counts.get('never') || 0) + 1)
          continue
        }
        if (!languageCovered([guide.email, assistant.email], peopleByKey, required)) {
          counts.set('language', (counts.get('language') || 0) + 1)
          continue
        }
        pairs.push({
          guide,
          assistant,
          avoid: pairRestriction(guide.email, assistant.email, people) === 'avoid',
        })
      }
    }
    const nonOwner = pairs.filter((pair) => !pair.guide.owner && !pair.assistant.owner)
    const ownerPool = nonOwner.length > 0 ? nonOwner : pairs
    const preferred = ownerPool.filter((pair) => !pair.avoid)
    const pool = preferred.length > 0 ? preferred : ownerPool
    const bestScore = pool.reduce((best, pair) => Math.max(best, deficit(pair.guide) + deficit(pair.assistant)), Number.NEGATIVE_INFINITY)
    const near =
      variant > 0
        ? pool.filter((pair) => bestScore - (deficit(pair.guide) + deficit(pair.assistant)) <= 1)
        : pool
    near.sort((a, b) => {
      const rating =
        guideLanguagePriorityScore(b.guide.member.guideProductSkills, tour.productId, required) -
        guideLanguagePriorityScore(a.guide.member.guideProductSkills, tour.productId, required)
      if (rating !== 0) return rating
      if (variant > 0) {
        const rank = tieRank(a.guide) + tieRank(a.assistant) - (tieRank(b.guide) + tieRank(b.assistant))
        if (rank !== 0) return rank
      }
      const score = deficit(b.guide) + deficit(b.assistant) - (deficit(a.guide) + deficit(a.assistant))
      if (Math.abs(score) > 1e-9) return score
      return a.guide.priorityIndex + a.assistant.priorityIndex - (b.guide.priorityIndex + b.assistant.priorityIndex)
    })
    const chosen = near[0]
    if (!chosen && !relaxProduct && existingMode === 'reset') {
      return placePair(tour, required, true)
    }
    if (!chosen) {
      const reason = unfilledFromCounts(counts)
      slots.push({
        tourId: tour.id,
        role: 'guide',
        email: null,
        locked: false,
        avoidPair: false,
        unfilledReason: reason,
        reasonLines: [AUTO_ASSIGN_UNFILLED_LABEL[reason]],
      })
      slots.push({
        tourId: tour.id,
        role: 'assistant',
        email: null,
        locked: false,
        avoidPair: false,
        unfilledReason: reason,
        reasonLines: [AUTO_ASSIGN_UNFILLED_LABEL[reason]],
      })
      return { guide: null, assistant: null }
    }
    commitAssignment(chosen.guide, tour, true)
    commitAssignment(chosen.assistant, tour, true)
    const avoidPair = chosen.avoid
    for (const role of ['guide', 'assistant'] as const) {
      const person = role === 'guide' ? chosen.guide : chosen.assistant
      slots.push({
        tourId: tour.id,
        role,
        email: person.email,
        locked: false,
        avoidPair,
        unfilledReason: null,
        reasonLines: reasonForAssignment({
          preset: effectivePreset,
          person,
          tour,
          role,
          avoidPair,
          uncheckedProduct: relaxProduct && role === 'guide',
          required,
          review: reviews.get(person.key),
        }),
      })
    }
    return { guide: chosen.guide.email, assistant: chosen.assistant.email }
  }

  function pickPerson(candidates: PersonState[], tour: AutoAssignTour, role: AutoAssignRole): PersonState | null {
    const primary = candidates.filter((person) => !person.owner)
    const pool = primary.length > 0 ? primary : candidates.filter((person) => person.owner)
    if (pool.length === 0) return null
    const best = pool.reduce((max, person) => Math.max(max, deficit(person)), Number.NEGATIVE_INFINITY)
    const near = variant > 0 ? pool.filter((person) => best - deficit(person) <= 1) : pool
    return [...near].sort((a, b) => {
      if (role === 'guide') {
        const rating =
          guideLanguagePriorityScore(b.member.guideProductSkills, tour.productId, requiredGuestLocales(tour.guestPeople)) -
          guideLanguagePriorityScore(a.member.guideProductSkills, tour.productId, requiredGuestLocales(tour.guestPeople))
        if (rating !== 0) return rating
      }
      if (variant > 0) {
        const rankGap = tieRank(a) - tieRank(b)
        if (rankGap !== 0) return rankGap
      }
      const gap = deficit(b) - deficit(a)
      if (Math.abs(gap) > 1e-9) return gap
      return a.priorityIndex - b.priorityIndex
    })[0]
  }
}
