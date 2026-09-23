'use client'

import {
  STAFF_SITE_ALERT_MAX_TEXT_ANSWER,
  staffSiteAlertOptionLabel,
  staffSiteAlertQuestionPrompt,
  type StaffSiteAlertAnswerInput,
  type StaffSiteAlertQuestionRow,
} from '@/lib/staffSiteAlertInteraction'

type StaffSiteAlertInteractionFormProps = {
  locale: string
  questions: StaffSiteAlertQuestionRow[]
  answers: StaffSiteAlertAnswerInput[]
  onChange: (next: StaffSiteAlertAnswerInput[]) => void
}

export function StaffSiteAlertInteractionForm({
  locale,
  questions,
  answers,
  onChange,
}: StaffSiteAlertInteractionFormProps) {
  const isKo = locale.startsWith('ko')

  const answerFor = (questionId: string): StaffSiteAlertAnswerInput =>
    answers.find((answer) => answer.questionId === questionId) ?? {
      questionId,
      optionIds: [],
      text: '',
    }

  const replace = (questionId: string, next: StaffSiteAlertAnswerInput) => {
    const rest = answers.filter((answer) => answer.questionId !== questionId)
    onChange([...rest, next])
  }

  return (
    <div className="space-y-3">
      {questions.map((question, index) => {
        const answer = answerFor(question.id)
        const prompt = staffSiteAlertQuestionPrompt(question, locale)
        return (
          <fieldset key={question.id} className="space-y-2 rounded-xl border border-gray-200 p-3">
            <legend className="px-1 text-sm font-medium text-gray-900">
              {questions.length > 1 ? `${index + 1}. ` : ''}
              {prompt}
              {question.required ? <span className="ml-1 text-red-500">*</span> : null}
            </legend>

            {question.question_type === 'text' ? (
              <textarea
                value={answer.text}
                maxLength={STAFF_SITE_ALERT_MAX_TEXT_ANSWER}
                rows={3}
                onChange={(event) =>
                  replace(question.id, { ...answer, questionId: question.id, text: event.target.value })
                }
                placeholder={isKo ? '답변을 입력해 주세요' : 'Write your answer'}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            ) : (
              <div className="space-y-1.5">
                {question.options.map((option) => {
                  const selected = answer.optionIds.includes(option.id)
                  return (
                    <label
                      key={option.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                        selected
                          ? 'border-primary bg-blue-50 text-gray-900'
                          : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type={question.question_type === 'single' ? 'radio' : 'checkbox'}
                        name={`staff-alert-${question.id}`}
                        checked={selected}
                        onChange={() => {
                          const optionIds =
                            question.question_type === 'single'
                              ? [option.id]
                              : selected
                                ? answer.optionIds.filter((id) => id !== option.id)
                                : [...answer.optionIds, option.id]
                          replace(question.id, { ...answer, questionId: question.id, optionIds })
                        }}
                      />
                      <span>{staffSiteAlertOptionLabel(option, locale)}</span>
                    </label>
                  )
                })}
              </div>
            )}
          </fieldset>
        )
      })}
    </div>
  )
}
