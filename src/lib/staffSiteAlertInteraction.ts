export const STAFF_SITE_ALERT_MAX_QUESTIONS = 12
export const STAFF_SITE_ALERT_MAX_OPTIONS = 8
export const STAFF_SITE_ALERT_MAX_PROMPT = 300
export const STAFF_SITE_ALERT_MAX_LABEL = 120
export const STAFF_SITE_ALERT_MAX_TEXT_ANSWER = 2000

export type StaffSiteAlertInteractionKind = 'none' | 'poll' | 'survey'
export type StaffSiteAlertQuestionType = 'single' | 'multiple' | 'text'

export type StaffSiteAlertInteractionErrorCode =
  | 'poll_needs_question'
  | 'poll_one_question'
  | 'poll_no_text'
  | 'survey_needs_question'
  | 'too_many_questions'
  | 'too_many_options'
  | 'prompt_required'
  | 'prompt_too_long'
  | 'options_min'
  | 'option_ko_required'
  | 'label_too_long'
  | 'answer_required'
  | 'invalid_option'
  | 'single_one_option'
  | 'text_too_long'
  | 'text_has_options'

export type StaffSiteAlertOptionInput = {
  clientId?: string
  labelKo: string
  labelEn: string
}

export type StaffSiteAlertQuestionInput = {
  clientId?: string
  promptKo: string
  promptEn: string
  questionType: StaffSiteAlertQuestionType
  required?: boolean
  options: StaffSiteAlertOptionInput[]
}

export type StaffSiteAlertInteractionInput = {
  kind: StaffSiteAlertInteractionKind
  anonymous: boolean
  showResults: boolean
  questions: StaffSiteAlertQuestionInput[]
}

export type NormalizedStaffSiteAlertOption = {
  labelKo: string
  labelEn: string
}

export type NormalizedStaffSiteAlertQuestion = {
  promptKo: string
  promptEn: string
  questionType: StaffSiteAlertQuestionType
  required: boolean
  options: NormalizedStaffSiteAlertOption[]
}

export type NormalizedStaffSiteAlertInteraction = {
  kind: StaffSiteAlertInteractionKind
  anonymous: boolean
  showResults: boolean
  questions: NormalizedStaffSiteAlertQuestion[]
}

export type StaffSiteAlertOptionRow = {
  id: string
  question_id: string
  sort_order: number
  label_ko: string
  label_en: string
}

export type StaffSiteAlertQuestionRow = {
  id: string
  alert_id: string
  sort_order: number
  prompt_ko: string
  prompt_en: string
  question_type: StaffSiteAlertQuestionType
  required: boolean
  options: StaffSiteAlertOptionRow[]
}

export type StaffSiteAlertAnswerInput = {
  questionId: string
  optionIds: string[]
  text: string
}

export type StaffSiteAlertResponseDraft = {
  question_id: string
  option_ids: string[]
  text_answer: string | null
}

export type StaffSiteAlertResponseForTally = {
  question_id: string
  option_ids?: string[] | null
  text_answer?: string | null
  voter_email?: string | null
}

export type StaffSiteAlertInteractionResultOption = {
  id: string
  label: string
  count: number
  percent: number
  voters: string[]
}

export type StaffSiteAlertInteractionResultText = {
  text: string
  voter: string | null
}

export type StaffSiteAlertInteractionResultQuestion = {
  id: string
  prompt: string
  questionType: StaffSiteAlertQuestionType
  responseCount: number
  options: StaffSiteAlertInteractionResultOption[]
  textAnswers: StaffSiteAlertInteractionResultText[]
}

const ERROR_KO: Record<StaffSiteAlertInteractionErrorCode, string> = {
  poll_needs_question: '투표 문항을 입력해 주세요.',
  poll_one_question: '투표는 문항 하나만 사용할 수 있습니다.',
  poll_no_text: '투표 문항은 객관식만 사용할 수 있습니다.',
  survey_needs_question: '설문 문항을 하나 이상 입력해 주세요.',
  too_many_questions: `설문 문항은 ${STAFF_SITE_ALERT_MAX_QUESTIONS}개까지 추가할 수 있습니다.`,
  too_many_options: `보기는 문항당 ${STAFF_SITE_ALERT_MAX_OPTIONS}개까지 추가할 수 있습니다.`,
  prompt_required: '문항 내용을 입력해 주세요.',
  prompt_too_long: `문항은 ${STAFF_SITE_ALERT_MAX_PROMPT}자까지 입력할 수 있습니다.`,
  options_min: '객관식 문항에는 보기가 2개 이상 필요합니다.',
  option_ko_required: '보기 한글을 입력해 주세요.',
  label_too_long: `보기는 ${STAFF_SITE_ALERT_MAX_LABEL}자까지 입력할 수 있습니다.`,
  answer_required: '필수 문항에 응답해 주세요.',
  invalid_option: '선택할 수 없는 보기가 포함되어 있습니다.',
  single_one_option: '단일 선택 문항은 보기를 하나만 고를 수 있습니다.',
  text_too_long: `주관식 답변은 ${STAFF_SITE_ALERT_MAX_TEXT_ANSWER}자까지 입력할 수 있습니다.`,
  text_has_options: '주관식 문항에는 보기를 넣을 수 없습니다.',
}

const ERROR_EN: Record<StaffSiteAlertInteractionErrorCode, string> = {
  poll_needs_question: 'Enter the poll question.',
  poll_one_question: 'A poll can have only one question.',
  poll_no_text: 'Poll questions must be multiple choice.',
  survey_needs_question: 'Add at least one survey question.',
  too_many_questions: `Surveys can have up to ${STAFF_SITE_ALERT_MAX_QUESTIONS} questions.`,
  too_many_options: `Each question can have up to ${STAFF_SITE_ALERT_MAX_OPTIONS} choices.`,
  prompt_required: 'Enter the question text.',
  prompt_too_long: `Questions can be up to ${STAFF_SITE_ALERT_MAX_PROMPT} characters.`,
  options_min: 'Choice questions need at least two options.',
  option_ko_required: 'Enter the Korean label for each choice.',
  label_too_long: `Choices can be up to ${STAFF_SITE_ALERT_MAX_LABEL} characters.`,
  answer_required: 'Please answer every required question.',
  invalid_option: 'One of the selected choices is not valid.',
  single_one_option: 'Select only one choice for this question.',
  text_too_long: `Written answers can be up to ${STAFF_SITE_ALERT_MAX_TEXT_ANSWER} characters.`,
  text_has_options: 'Written questions cannot include choices.',
}

export function staffSiteAlertInteractionErrorMessage(
  code: StaffSiteAlertInteractionErrorCode,
  locale: string
): string {
  return locale.startsWith('ko') ? ERROR_KO[code] : ERROR_EN[code]
}

export function staffSiteAlertHasInteraction(kind: string | null | undefined): boolean {
  return kind === 'poll' || kind === 'survey'
}

export function createStaffSiteAlertOptionInput(): StaffSiteAlertOptionInput {
  return {
    clientId: crypto.randomUUID(),
    labelKo: '',
    labelEn: '',
  }
}

export function createStaffSiteAlertQuestionInput(
  questionType: StaffSiteAlertQuestionType = 'single'
): StaffSiteAlertQuestionInput {
  return {
    clientId: crypto.randomUUID(),
    promptKo: '',
    promptEn: '',
    questionType,
    required: true,
    options:
      questionType === 'text'
        ? []
        : [createStaffSiteAlertOptionInput(), createStaffSiteAlertOptionInput()],
  }
}

export function emptyStaffSiteAlertInteraction(): StaffSiteAlertInteractionInput {
  return {
    kind: 'none',
    anonymous: false,
    showResults: true,
    questions: [],
  }
}

export function staffSiteAlertInteractionForKind(
  kind: StaffSiteAlertInteractionKind,
  prev: StaffSiteAlertInteractionInput
): StaffSiteAlertInteractionInput {
  if (kind === 'none') {
    return { kind: 'none', anonymous: false, showResults: true, questions: [] }
  }
  if (kind === 'poll') {
    const existing = prev.kind === 'poll' ? prev.questions[0] : undefined
    const question = existing
      ? {
          ...existing,
          questionType: existing.questionType === 'text' ? 'single' : existing.questionType,
          required: true,
          options:
            existing.options.filter((option) => option.labelKo.trim() || option.labelEn.trim()).length > 0
              ? existing.options
              : [createStaffSiteAlertOptionInput(), createStaffSiteAlertOptionInput()],
        }
      : createStaffSiteAlertQuestionInput('single')
    return {
      kind: 'poll',
      anonymous: prev.anonymous,
      showResults: prev.kind === 'none' ? true : prev.showResults,
      questions: [question],
    }
  }
  const questions =
    prev.kind === 'survey' && prev.questions.length > 0
      ? prev.questions
      : [createStaffSiteAlertQuestionInput('single')]
  return {
    kind: 'survey',
    anonymous: prev.anonymous,
    showResults: prev.showResults,
    questions,
  }
}

function fail(code: StaffSiteAlertInteractionErrorCode) {
  return { ok: false as const, error: code }
}

function normalizeOption(option: StaffSiteAlertOptionInput): NormalizedStaffSiteAlertOption | StaffSiteAlertInteractionErrorCode | null {
  const labelKo = String(option?.labelKo ?? '').trim()
  const labelEn = String(option?.labelEn ?? '').trim()
  if (!labelKo && !labelEn) return null
  if (!labelKo) return 'option_ko_required'
  if (labelKo.length > STAFF_SITE_ALERT_MAX_LABEL || labelEn.length > STAFF_SITE_ALERT_MAX_LABEL) {
    return 'label_too_long'
  }
  return { labelKo, labelEn }
}

function normalizeQuestion(
  question: StaffSiteAlertQuestionInput,
  forceRequired: boolean
): { ok: true; value: NormalizedStaffSiteAlertQuestion } | { ok: false; error: StaffSiteAlertInteractionErrorCode } {
  const promptKo = String(question?.promptKo ?? '').trim()
  const promptEn = String(question?.promptEn ?? '').trim()
  if (!promptKo) return fail('prompt_required')
  if (promptKo.length > STAFF_SITE_ALERT_MAX_PROMPT || promptEn.length > STAFF_SITE_ALERT_MAX_PROMPT) {
    return fail('prompt_too_long')
  }
  if (question.questionType === 'text') {
    return {
      ok: true,
      value: {
        promptKo,
        promptEn,
        questionType: 'text',
        required: forceRequired || question.required !== false,
        options: [],
      },
    }
  }
  const optionInputs = Array.isArray(question.options) ? question.options : []
  if (optionInputs.length > STAFF_SITE_ALERT_MAX_OPTIONS) return fail('too_many_options')
  const options: NormalizedStaffSiteAlertOption[] = []
  for (const option of optionInputs) {
    const normalized = normalizeOption(option)
    if (normalized === null) continue
    if (typeof normalized === 'string') return fail(normalized)
    options.push(normalized)
  }
  if (options.length < 2) return fail('options_min')
  return {
    ok: true,
    value: {
      promptKo,
      promptEn,
      questionType: question.questionType === 'multiple' ? 'multiple' : 'single',
      required: forceRequired || question.required !== false,
      options,
    },
  }
}

export function normalizeStaffSiteAlertInteraction(
  input: StaffSiteAlertInteractionInput | null | undefined
): { ok: true; value: NormalizedStaffSiteAlertInteraction } | { ok: false; error: StaffSiteAlertInteractionErrorCode } {
  const kind = input?.kind === 'poll' || input?.kind === 'survey' ? input.kind : 'none'
  if (kind === 'none') {
    return {
      ok: true,
      value: { kind: 'none', anonymous: false, showResults: true, questions: [] },
    }
  }
  const questions = Array.isArray(input?.questions) ? input.questions : []
  if (kind === 'poll') {
    if (questions.length === 0) return fail('poll_needs_question')
    if (questions.length !== 1) return fail('poll_one_question')
    if (questions[0]?.questionType === 'text') return fail('poll_no_text')
  } else if (questions.length === 0) {
    return fail('survey_needs_question')
  }
  if (questions.length > STAFF_SITE_ALERT_MAX_QUESTIONS) return fail('too_many_questions')

  const normalized: NormalizedStaffSiteAlertQuestion[] = []
  for (const question of questions) {
    const result = normalizeQuestion(question, kind === 'poll')
    if (!result.ok) return result
    normalized.push(result.value)
  }
  return {
    ok: true,
    value: {
      kind,
      anonymous: Boolean(input?.anonymous),
      showResults: input?.showResults !== false,
      questions: normalized,
    },
  }
}

export function staffSiteAlertQuestionPrompt(
  question: { prompt_ko: string; prompt_en: string },
  locale: string
): string {
  if (locale.startsWith('ko')) return question.prompt_ko
  const en = question.prompt_en.trim()
  return en || question.prompt_ko
}

export function staffSiteAlertOptionLabel(
  option: { label_ko: string; label_en: string },
  locale: string
): string {
  if (locale.startsWith('ko')) return option.label_ko
  const en = option.label_en.trim()
  return en || option.label_ko
}

export function parseStaffSiteAlertQuestionRows(input: unknown): StaffSiteAlertQuestionRow[] {
  if (!Array.isArray(input)) return []
  const rows: StaffSiteAlertQuestionRow[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const questionType = row.question_type
    if (questionType !== 'single' && questionType !== 'multiple' && questionType !== 'text') continue
    const id = String(row.id ?? '')
    if (!id) continue
    const nested = row.staff_site_alert_options ?? row.options
    const options = parseOptionRows(nested, id)
    rows.push({
      id,
      alert_id: String(row.alert_id ?? ''),
      sort_order: Number(row.sort_order ?? 0),
      prompt_ko: String(row.prompt_ko ?? ''),
      prompt_en: String(row.prompt_en ?? ''),
      question_type: questionType,
      required: row.required !== false,
      options,
    })
  }
  rows.sort((a, b) => a.sort_order - b.sort_order)
  return rows
}

function parseOptionRows(input: unknown, questionId: string): StaffSiteAlertOptionRow[] {
  if (!Array.isArray(input)) return []
  const options: StaffSiteAlertOptionRow[] = []
  for (const raw of input) {
    if (!raw || typeof raw !== 'object') continue
    const row = raw as Record<string, unknown>
    const id = String(row.id ?? '')
    if (!id) continue
    options.push({
      id,
      question_id: String(row.question_id ?? questionId),
      sort_order: Number(row.sort_order ?? 0),
      label_ko: String(row.label_ko ?? ''),
      label_en: String(row.label_en ?? ''),
    })
  }
  options.sort((a, b) => a.sort_order - b.sort_order)
  return options
}

export function emptyStaffSiteAlertAnswer(questionId: string): StaffSiteAlertAnswerInput {
  return { questionId, optionIds: [], text: '' }
}

export function validateStaffSiteAlertAnswers(
  questions: StaffSiteAlertQuestionRow[],
  answers: StaffSiteAlertAnswerInput[]
): { ok: true; rows: StaffSiteAlertResponseDraft[] } | { ok: false; error: StaffSiteAlertInteractionErrorCode } {
  const byId = new Map(answers.map((answer) => [answer.questionId, answer]))
  const rows: StaffSiteAlertResponseDraft[] = []

  for (const question of questions) {
    const answer = byId.get(question.id) ?? emptyStaffSiteAlertAnswer(question.id)
    const optionIds = [...new Set((answer.optionIds ?? []).map((id) => id.trim()).filter(Boolean))]
    const text = (answer.text ?? '').trim()
    const allowed = new Set(question.options.map((option) => option.id))

    if (question.question_type === 'text') {
      if (optionIds.length > 0) return fail('text_has_options')
      if (!text) {
        if (question.required) return fail('answer_required')
        continue
      }
      if (text.length > STAFF_SITE_ALERT_MAX_TEXT_ANSWER) return fail('text_too_long')
      rows.push({ question_id: question.id, option_ids: [], text_answer: text })
      continue
    }

    if (optionIds.some((id) => !allowed.has(id))) return fail('invalid_option')
    if (question.question_type === 'single' && optionIds.length > 1) return fail('single_one_option')
    if (optionIds.length === 0) {
      if (question.required) return fail('answer_required')
      continue
    }
    rows.push({ question_id: question.id, option_ids: optionIds, text_answer: null })
  }

  return { ok: true, rows }
}

export function staffSiteAlertAnswersComplete(
  questions: StaffSiteAlertQuestionRow[],
  answers: StaffSiteAlertAnswerInput[]
): boolean {
  return validateStaffSiteAlertAnswers(questions, answers).ok
}

export function buildStaffSiteAlertInteractionResults(args: {
  questions: StaffSiteAlertQuestionRow[]
  responses: StaffSiteAlertResponseForTally[]
  locale: string
  includeVoters: boolean
  includeTextAnswers: boolean
}): StaffSiteAlertInteractionResultQuestion[] {
  return args.questions.map((question) => {
    const related = args.responses.filter((response) => response.question_id === question.id)
    const responseCount = related.length
    const options = question.options.map((option) => {
      const voters = related
        .filter((response) => (response.option_ids ?? []).includes(option.id))
        .map((response) => (response.voter_email || '').trim())
        .filter(Boolean)
      const count = related.filter((response) => (response.option_ids ?? []).includes(option.id)).length
      return {
        id: option.id,
        label: staffSiteAlertOptionLabel(option, args.locale),
        count,
        percent: responseCount === 0 ? 0 : Math.round((count / responseCount) * 100),
        voters: args.includeVoters ? [...new Set(voters)] : [],
      }
    })
    const textAnswers = args.includeTextAnswers
      ? related
          .map((response) => ({
            text: (response.text_answer || '').trim(),
            voter: args.includeVoters ? (response.voter_email || '').trim() || null : null,
          }))
          .filter((answer) => answer.text)
      : []
    return {
      id: question.id,
      prompt: staffSiteAlertQuestionPrompt(question, args.locale),
      questionType: question.question_type,
      responseCount,
      options,
      textAnswers,
    }
  })
}

export function isStaffSiteAlertSignatureDataUrl(value: string): boolean {
  return /^data:image\/png;base64,/i.test(value) && value.length > 32 && value.length <= 500_000
}
