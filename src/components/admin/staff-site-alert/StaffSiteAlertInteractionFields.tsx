'use client'

import { BarChart3, ClipboardList, Plus, Trash2 } from 'lucide-react'
import {
  STAFF_SITE_ALERT_MAX_LABEL,
  STAFF_SITE_ALERT_MAX_OPTIONS,
  STAFF_SITE_ALERT_MAX_PROMPT,
  STAFF_SITE_ALERT_MAX_QUESTIONS,
  createStaffSiteAlertOptionInput,
  createStaffSiteAlertQuestionInput,
  staffSiteAlertInteractionForKind,
  type StaffSiteAlertInteractionInput,
  type StaffSiteAlertInteractionKind,
  type StaffSiteAlertQuestionInput,
  type StaffSiteAlertQuestionType,
} from '@/lib/staffSiteAlertInteraction'

type StaffSiteAlertInteractionFieldsProps = {
  locale: string
  value: StaffSiteAlertInteractionInput
  onChange: (next: StaffSiteAlertInteractionInput) => void
}

const KINDS: Array<{ id: StaffSiteAlertInteractionKind; ko: string; en: string }> = [
  { id: 'none', ko: '일반 알림', en: 'Notice' },
  { id: 'poll', ko: '투표', en: 'Poll' },
  { id: 'survey', ko: '설문', en: 'Survey' },
]

export function StaffSiteAlertInteractionFields({
  locale,
  value,
  onChange,
}: StaffSiteAlertInteractionFieldsProps) {
  const isKo = locale.startsWith('ko')

  const updateQuestion = (index: number, next: StaffSiteAlertQuestionInput) => {
    onChange({
      ...value,
      questions: value.questions.map((question, questionIndex) =>
        questionIndex === index ? next : question
      ),
    })
  }

  return (
    <section className="space-y-3 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <div>
        <h4 className="text-sm font-semibold text-gray-900">
          {isKo ? '응답 방식' : 'Response'}
        </h4>
        <p className="mt-1 text-xs leading-5 text-gray-600">
          {isKo
            ? '투표는 문항 하나, 설문은 여러 문항입니다. 수신자는 응답해야 알림을 닫을 수 있습니다.'
            : 'A poll has one question. A survey can have several. Recipients answer before dismissing.'}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {KINDS.map((kind) => {
          const selected = value.kind === kind.id
          return (
            <button
              key={kind.id}
              type="button"
              onClick={() => onChange(staffSiteAlertInteractionForKind(kind.id, value))}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {kind.id === 'poll' ? <BarChart3 className="h-3.5 w-3.5" /> : null}
              {kind.id === 'survey' ? <ClipboardList className="h-3.5 w-3.5" /> : null}
              {isKo ? kind.ko : kind.en}
            </button>
          )
        })}
      </div>

      {value.kind !== 'none' ? (
        <div className="space-y-3">
          {value.questions.map((question, index) => (
            <QuestionEditor
              key={question.clientId || index}
              locale={locale}
              index={index}
              question={question}
              lockType={value.kind === 'poll'}
              canRemove={value.kind === 'survey' && value.questions.length > 1}
              onChange={(next) => updateQuestion(index, next)}
              onRemove={() =>
                onChange({
                  ...value,
                  questions: value.questions.filter((_, questionIndex) => questionIndex !== index),
                })
              }
            />
          ))}

          {value.kind === 'survey' && value.questions.length < STAFF_SITE_ALERT_MAX_QUESTIONS ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...value,
                  questions: [...value.questions, createStaffSiteAlertQuestionInput('single')],
                })
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Plus className="h-4 w-4" />
              {isKo ? '문항 추가' : 'Add question'}
            </button>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={value.anonymous}
                onChange={(event) => onChange({ ...value, anonymous: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {isKo ? '익명 집계' : 'Hide names'}
                </span>
                <span className="text-xs text-gray-600">
                  {isKo
                    ? '발송 내역에는 이름 없이 결과만 표시됩니다.'
                    : 'History shows totals without respondent names.'}
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={value.showResults}
                onChange={(event) => onChange({ ...value, showResults: event.target.checked })}
              />
              <span>
                <span className="block text-sm font-medium text-gray-900">
                  {isKo ? '응답 후 집계 공개' : 'Show totals after answering'}
                </span>
                <span className="text-xs text-gray-600">
                  {isKo
                    ? '수신자에게 객관식 득표만 보여 줍니다. 주관식 내용은 발송 내역에서만 봅니다.'
                    : 'Recipients see choice totals only. Written answers stay in history.'}
                </span>
              </span>
            </label>
          </div>
        </div>
      ) : null}
    </section>
  )
}

function QuestionEditor({
  locale,
  index,
  question,
  lockType,
  canRemove,
  onChange,
  onRemove,
}: {
  locale: string
  index: number
  question: StaffSiteAlertQuestionInput
  lockType: boolean
  canRemove: boolean
  onChange: (next: StaffSiteAlertQuestionInput) => void
  onRemove: () => void
}) {
  const isKo = locale.startsWith('ko')
  const isText = question.questionType === 'text'

  const setType = (questionType: StaffSiteAlertQuestionType) => {
    if (questionType === 'text') {
      onChange({ ...question, questionType, options: [] })
      return
    }
    onChange({
      ...question,
      questionType,
      options:
        question.options.length >= 2
          ? question.options
          : [createStaffSiteAlertOptionInput(), createStaffSiteAlertOptionInput()],
    })
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          {isKo ? `문항 ${index + 1}` : `Question ${index + 1}`}
        </p>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {isKo ? '삭제' : 'Remove'}
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          value={question.promptKo}
          maxLength={STAFF_SITE_ALERT_MAX_PROMPT}
          onChange={(event) => onChange({ ...question, promptKo: event.target.value })}
          placeholder={isKo ? '문항 (한글)' : 'Question (Korean)'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={question.promptEn}
          maxLength={STAFF_SITE_ALERT_MAX_PROMPT}
          onChange={(event) => onChange({ ...question, promptEn: event.target.value })}
          placeholder={isKo ? '문항 (영문, 선택)' : 'Question (English, optional)'}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {lockType ? (
          <>
            <TypeButton
              active={question.questionType !== 'multiple'}
              label={isKo ? '하나만 선택' : 'Single choice'}
              onClick={() => setType('single')}
            />
            <TypeButton
              active={question.questionType === 'multiple'}
              label={isKo ? '여러 개 선택' : 'Multiple choice'}
              onClick={() => setType('multiple')}
            />
          </>
        ) : (
          <>
            <TypeButton
              active={question.questionType === 'single'}
              label={isKo ? '단일 선택' : 'Single'}
              onClick={() => setType('single')}
            />
            <TypeButton
              active={question.questionType === 'multiple'}
              label={isKo ? '복수 선택' : 'Multiple'}
              onClick={() => setType('multiple')}
            />
            <TypeButton
              active={question.questionType === 'text'}
              label={isKo ? '주관식' : 'Written'}
              onClick={() => setType('text')}
            />
            <label className="ml-auto inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={question.required !== false}
                onChange={(event) => onChange({ ...question, required: event.target.checked })}
              />
              {isKo ? '필수' : 'Required'}
            </label>
          </>
        )}
      </div>

      {isText ? null : (
        <div className="space-y-2">
          {question.options.map((option, optionIndex) => (
            <div key={option.clientId || optionIndex} className="flex items-start gap-2">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
                <input
                  value={option.labelKo}
                  maxLength={STAFF_SITE_ALERT_MAX_LABEL}
                  onChange={(event) =>
                    onChange({
                      ...question,
                      options: question.options.map((item, itemIndex) =>
                        itemIndex === optionIndex ? { ...item, labelKo: event.target.value } : item
                      ),
                    })
                  }
                  placeholder={isKo ? `보기 ${optionIndex + 1} (한글)` : `Choice ${optionIndex + 1} (Korean)`}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  value={option.labelEn}
                  maxLength={STAFF_SITE_ALERT_MAX_LABEL}
                  onChange={(event) =>
                    onChange({
                      ...question,
                      options: question.options.map((item, itemIndex) =>
                        itemIndex === optionIndex ? { ...item, labelEn: event.target.value } : item
                      ),
                    })
                  }
                  placeholder={isKo ? '영문 (선택)' : 'English (optional)'}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                type="button"
                aria-label={isKo ? '보기 삭제' : 'Remove choice'}
                disabled={question.options.length <= 2}
                onClick={() =>
                  onChange({
                    ...question,
                    options: question.options.filter((_, itemIndex) => itemIndex !== optionIndex),
                  })
                }
                className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          {question.options.length < STAFF_SITE_ALERT_MAX_OPTIONS ? (
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...question,
                  options: [...question.options, createStaffSiteAlertOptionInput()],
                })
              }
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              {isKo ? '보기 추가' : 'Add choice'}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function TypeButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
        active ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  )
}
