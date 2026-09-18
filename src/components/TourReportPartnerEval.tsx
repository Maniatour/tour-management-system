'use client'

import { Star, Users } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  PARTNER_EVAL_CRITERIA,
  type PartnerEvalCriterionKey,
  type PartnerEvaluation,
} from '@/lib/tourReportActivityDetails'

const EMPTY_EVAL: PartnerEvaluation = { ratings: {}, issues: '' }

export default function TourReportPartnerEval({
  locale,
  partnerName,
  value,
  onChange,
}: {
  locale: string
  partnerName?: string
  value: PartnerEvaluation
  onChange: (next: PartnerEvaluation) => void
}) {
  const english = locale === 'en' || locale.startsWith('en')
  const ratings = value.ratings ?? {}

  const setStars = (key: PartnerEvalCriterionKey, stars: number) => {
    const nextRatings = { ...ratings }
    if (ratings[key] === stars) delete nextRatings[key]
    else nextRatings[key] = stars
    onChange({ ...value, ratings: nextRatings })
  }

  return (
    <section className="space-y-3 rounded-xl border border-border/70 bg-white p-3 shadow-sm">
      <div>
        <Label className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 shrink-0" />
          {english ? 'Partner evaluation' : '파트너 평가'}
        </Label>
        <p className="mt-1 text-xs text-muted-foreground">
          {partnerName
            ? english
              ? `Rate ${partnerName}. Optional — skip if you worked alone.`
              : `${partnerName} 님을 평가해 주세요. 혼자 진행했다면 건너뛰어도 됩니다.`
            : english
              ? 'Star-rate the person you worked with. Optional if you were alone.'
              : '같이 진행한 파트너를 별점으로 평가해 주세요. 혼자면 건너뛰어도 됩니다.'}
        </p>
      </div>

      <div className="space-y-2">
        {PARTNER_EVAL_CRITERIA.map((item) => {
          const current = ratings[item.key] ?? 0
          return (
            <div key={item.key} className="flex items-center justify-between gap-2">
              <span className="min-w-0 shrink-0 text-xs font-medium text-foreground">
                {english ? item.en : item.ko}
              </span>
              <div className="flex items-center gap-0.5" role="radiogroup" aria-label={english ? item.en : item.ko}>
                {[1, 2, 3, 4, 5].map((stars) => {
                  const selected = current >= stars
                  return (
                    <button
                      key={stars}
                      type="button"
                      aria-label={`${stars}`}
                      onClick={() => setStars(item.key, stars)}
                      className="rounded-md p-0.5 transition hover:scale-105"
                    >
                      <Star
                        className={cn(
                          'h-5 w-5',
                          selected ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'
                        )}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="partner-eval-issues" className="text-xs font-medium">
          {english ? 'Problems or notes' : '문제 있는 점'}
        </Label>
        <Textarea
          id="partner-eval-issues"
          value={value.issues}
          onChange={(event) => onChange({ ...value, issues: event.target.value })}
          placeholder={
            english
              ? 'Write anything that went wrong, or leave blank.'
              : '문제가 있었다면 적어 주세요. 없으면 비워 두세요.'
          }
          rows={3}
          className="min-h-[80px] resize-y text-sm"
        />
      </div>
    </section>
  )
}

export function emptyPartnerEvaluation(): PartnerEvaluation {
  return { ratings: {}, issues: '' }
}

export { EMPTY_EVAL }
