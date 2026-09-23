import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildStaffSiteAlertInteractionResults,
  normalizeStaffSiteAlertInteraction,
  parseStaffSiteAlertQuestionRows,
  validateStaffSiteAlertAnswers,
  type StaffSiteAlertInteractionInput,
  type StaffSiteAlertQuestionRow,
} from './staffSiteAlertInteraction'

function poll(overrides: Partial<StaffSiteAlertInteractionInput> = {}): StaffSiteAlertInteractionInput {
  return {
    kind: 'poll',
    anonymous: false,
    showResults: true,
    questions: [
      {
        promptKo: '내일 모임 참석?',
        promptEn: 'Join tomorrow?',
        questionType: 'single',
        required: true,
        options: [
          { labelKo: '참석', labelEn: 'Yes' },
          { labelKo: '불참', labelEn: 'No' },
        ],
      },
    ],
    ...overrides,
  }
}

const questions: StaffSiteAlertQuestionRow[] = [
  {
    id: 'q1',
    alert_id: 'a1',
    sort_order: 0,
    prompt_ko: '내일 모임 참석?',
    prompt_en: '',
    question_type: 'single',
    required: true,
    options: [
      { id: 'o1', question_id: 'q1', sort_order: 0, label_ko: '참석', label_en: 'Yes' },
      { id: 'o2', question_id: 'q1', sort_order: 1, label_ko: '불참', label_en: 'No' },
    ],
  },
  {
    id: 'q2',
    alert_id: 'a1',
    sort_order: 1,
    prompt_ko: '의견',
    prompt_en: '',
    question_type: 'text',
    required: false,
    options: [],
  },
]

test('poll normalizes one choice question and drops blank options', () => {
  const result = normalizeStaffSiteAlertInteraction(
    poll({
      questions: [
        {
          promptKo: '  내일 모임 참석?  ',
          promptEn: '',
          questionType: 'single',
          options: [
            { labelKo: '참석', labelEn: '' },
            { labelKo: '  ', labelEn: '' },
            { labelKo: '불참', labelEn: 'No' },
          ],
        },
      ],
    })
  )
  assert.equal(result.ok, true)
  if (!result.ok) return
  assert.equal(result.value.questions.length, 1)
  assert.equal(result.value.questions[0]?.required, true)
  assert.deepEqual(
    result.value.questions[0]?.options.map((option) => option.labelKo),
    ['참석', '불참']
  )
})

test('poll rejects text questions and extra questions', () => {
  const textPoll = normalizeStaffSiteAlertInteraction(
    poll({
      questions: [
        {
          promptKo: '이유',
          promptEn: '',
          questionType: 'text',
          options: [],
        },
      ],
    })
  )
  assert.equal(textPoll.ok, false)
  if (!textPoll.ok) assert.equal(textPoll.error, 'poll_no_text')

  const two = normalizeStaffSiteAlertInteraction(
    poll({
      questions: [
        ...(poll().questions),
        {
          promptKo: '두번째',
          promptEn: '',
          questionType: 'single',
          options: [
            { labelKo: 'A', labelEn: '' },
            { labelKo: 'B', labelEn: '' },
          ],
        },
      ],
    })
  )
  assert.equal(two.ok, false)
  if (!two.ok) assert.equal(two.error, 'poll_one_question')
})

test('survey accepts mixed questions and rejects a single choice option', () => {
  const ok = normalizeStaffSiteAlertInteraction({
    kind: 'survey',
    anonymous: true,
    showResults: false,
    questions: [
      {
        promptKo: '식사',
        promptEn: '',
        questionType: 'multiple',
        required: true,
        options: [
          { labelKo: '한식', labelEn: '' },
          { labelKo: '양식', labelEn: '' },
        ],
      },
      {
        promptKo: '메모',
        promptEn: 'Note',
        questionType: 'text',
        required: false,
        options: [],
      },
    ],
  })
  assert.equal(ok.ok, true)
  if (ok.ok) {
    assert.equal(ok.value.anonymous, true)
    assert.equal(ok.value.showResults, false)
    assert.equal(ok.value.questions[1]?.questionType, 'text')
  }

  const missing = normalizeStaffSiteAlertInteraction({
    kind: 'survey',
    anonymous: false,
    showResults: true,
    questions: [
      {
        promptKo: '하나만',
        promptEn: '',
        questionType: 'single',
        options: [{ labelKo: 'A', labelEn: '' }],
      },
    ],
  })
  assert.equal(missing.ok, false)
  if (!missing.ok) assert.equal(missing.error, 'options_min')
})

test('plain alerts ignore interaction questions', () => {
  const result = normalizeStaffSiteAlertInteraction({
    kind: 'none',
    anonymous: true,
    showResults: false,
    questions: poll().questions,
  })
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.value.kind, 'none')
    assert.equal(result.value.questions.length, 0)
  }
})

test('answers must match question type', () => {
  const missing = validateStaffSiteAlertAnswers(questions, [])
  assert.equal(missing.ok, false)

  const picked = validateStaffSiteAlertAnswers(questions, [
    { questionId: 'q1', optionIds: ['o1'], text: '' },
    { questionId: 'q2', optionIds: [], text: '  좋습니다  ' },
  ])
  assert.equal(picked.ok, true)
  if (picked.ok) {
    assert.equal(picked.rows[0]?.option_ids[0], 'o1')
    assert.equal(picked.rows[1]?.text_answer, '좋습니다')
  }

  const two = validateStaffSiteAlertAnswers(questions, [
    { questionId: 'q1', optionIds: ['o1', 'o2'], text: '' },
  ])
  assert.equal(two.ok, false)
  if (!two.ok) assert.equal(two.error, 'single_one_option')
})

test('results hide voter names unless requested', () => {
  const parsed = parseStaffSiteAlertQuestionRows([
    {
      id: 'q1',
      alert_id: 'a1',
      sort_order: 1,
      prompt_ko: '참석?',
      prompt_en: 'Join?',
      question_type: 'single',
      required: true,
      staff_site_alert_options: [
        { id: 'o2', question_id: 'q1', sort_order: 1, label_ko: '불참', label_en: 'No' },
        { id: 'o1', question_id: 'q1', sort_order: 0, label_ko: '참석', label_en: 'Yes' },
      ],
    },
  ])
  assert.equal(parsed[0]?.options[0]?.id, 'o1')

  const hidden = buildStaffSiteAlertInteractionResults({
    questions: parsed,
    locale: 'ko',
    includeVoters: false,
    includeTextAnswers: false,
    responses: [
      { question_id: 'q1', option_ids: ['o1'], voter_email: 'a@kovegas.com' },
      { question_id: 'q1', option_ids: ['o1'], voter_email: 'b@kovegas.com' },
      { question_id: 'q1', option_ids: ['o2'], voter_email: 'c@kovegas.com' },
    ],
  })
  assert.equal(hidden[0]?.options[0]?.count, 2)
  assert.equal(hidden[0]?.options[0]?.percent, 67)
  assert.deepEqual(hidden[0]?.options[0]?.voters, [])

  const named = buildStaffSiteAlertInteractionResults({
    questions: parsed,
    locale: 'en',
    includeVoters: true,
    includeTextAnswers: false,
    responses: [{ question_id: 'q1', option_ids: ['o1'], voter_email: 'a@kovegas.com' }],
  })
  assert.equal(named[0]?.options[0]?.label, 'Yes')
  assert.deepEqual(named[0]?.options[0]?.voters, ['a@kovegas.com'])
})
