'use client'

import type { StaffSiteAlertInteractionResultQuestion } from '@/lib/staffSiteAlertInteraction'

type StaffSiteAlertInteractionResultsProps = {
  locale: string
  kind: 'poll' | 'survey' | string
  results: StaffSiteAlertInteractionResultQuestion[]
}

export function StaffSiteAlertInteractionResults({
  locale,
  kind,
  results,
}: StaffSiteAlertInteractionResultsProps) {
  const isKo = locale.startsWith('ko')
  const title =
    kind === 'poll' ? (isKo ? '투표 결과' : 'Poll results') : isKo ? '설문 결과' : 'Survey results'

  if (results.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        {isKo ? '아직 집계할 응답이 없습니다.' : 'No responses to summarize yet.'}
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {results.map((question) => (
        <div key={question.id} className="rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-gray-900">{question.prompt}</p>
            <p className="shrink-0 text-xs text-gray-500">
              {isKo ? `${question.responseCount}명` : `${question.responseCount}`}
            </p>
          </div>
          {question.questionType === 'text' ? (
            question.textAnswers.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">
                {question.responseCount > 0
                  ? isKo
                    ? '주관식 응답이 접수되었습니다.'
                    : 'Written answers were submitted.'
                  : isKo
                    ? '응답 대기'
                    : 'Waiting for answers'}
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {question.textAnswers.map((answer, index) => (
                  <li key={`${question.id}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    {answer.voter ? <span className="mr-2 text-xs text-gray-500">{answer.voter}</span> : null}
                    {answer.text}
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="mt-3 space-y-2">
              {question.options.map((option) => (
                <li key={option.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs text-gray-700">
                    <span className="truncate font-medium">{option.label}</span>
                    <span className="shrink-0">
                      {option.count} · {option.percent}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${option.percent}%` }}
                    />
                  </div>
                  {option.voters.length > 0 ? (
                    <p className="mt-1 text-[11px] leading-4 text-gray-500">{option.voters.join(', ')}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  )
}
