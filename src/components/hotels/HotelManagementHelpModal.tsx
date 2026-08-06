'use client'

import Link from 'next/link'
import { BookOpen, HelpCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type HotelManagementHelpModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: string
}

export function HotelManagementHelpModal({
  open,
  onOpenChange,
  locale,
}: HotelManagementHelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 px-5 py-4 pr-12 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <BookOpen className="h-5 w-5 text-muted-foreground" aria-hidden />
            호텔 관리 — 이렇게 쓰세요
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-5 py-4 text-sm leading-6 text-foreground">
          <section className="rounded-xl border border-warning/30 bg-warning/5 p-4">
            <h3 className="font-semibold mb-2">가장 중요한 것</h3>
            <p className="text-muted-foreground">
              요금은 <strong className="text-foreground">「멤버 요금 가져오기」</strong>로만
              가져옵니다. StayAPI Enrich는 이미지·설명용이며 가격과 무관합니다. Enrich를 눌러도
              요금은 변하지 않습니다.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Wyndham 멤버 요금 (권장 순서)</h3>
            <ol className="list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">.env.local</strong>에 Wyndham Rewards 계정과
                Live 플래그를 넣습니다.
                <pre className="mt-2 rounded-lg bg-muted/50 p-3 text-[11px] overflow-x-auto">
{`WYNDHAM_LOGIN_EMAIL=you@example.com
WYNDHAM_LOGIN_PASSWORD=********
HOTEL_WYNDHAM_LIVE=1`}
                </pre>
              </li>
              <li>
                Playwright 설치:{' '}
                <code className="text-xs">npm i -D playwright && npx playwright install chromium</code>
              </li>
              <li>dev 서버를 재시작합니다. (env 변경 반영)</li>
              <li>
                페이지 상단 <strong className="text-foreground">1단계 준비 상태</strong>가 OK인지
                확인합니다.
              </li>
              <li>
                <strong className="text-foreground">2단계</strong>에서 체크인·체크아웃을 고릅니다.
              </li>
              <li>
                <strong className="text-foreground">3단계</strong>에서 호텔을 카탈로그에 추가합니다
                (예: Super 8 Page).
              </li>
              <li>
                호텔 목록에서{' '}
                <strong className="text-foreground">멤버 요금 가져오기</strong>를 누릅니다.
                <br />
                → 서버가 Wyndham에 로그인 → 멤버가 화면을 읽어 →{' '}
                <strong className="text-foreground">요금</strong> 탭에 저장합니다.
              </li>
              <li>
                토스트에 가격이 보이면 성공입니다. 실패하면 메시지와{' '}
                <code className="text-xs">automation/wyndham/artifacts</code> 스크린샷을 확인하세요.
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold mb-2">StayAPI Enrich는 언제?</h3>
            <p className="text-muted-foreground">
              호텔 사진·주소·편의시설을 채울 때만 씁니다. 키가 없으면 「설정 안 됨」 안내만
              뜹니다. <strong className="text-foreground">요금 조회와 완전히 별개</strong>입니다.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">탭 의미</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">호텔 목록</strong> — 카탈로그 + 요금 수동 트리거
              </li>
              <li>
                <strong className="text-foreground">요금</strong> — 가져온 멤버가 결과
              </li>
              <li>
                <strong className="text-foreground">예약 / 투어 배정</strong> — 이후 단계에서 사용
              </li>
              <li>
                <strong className="text-foreground">가격 알림</strong> — $20 이상 하락 시
              </li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold mb-2">다른 메뉴와 구분</h3>
            <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>
                <Link
                  href={`/${locale}/admin/booking`}
                  className="underline underline-offset-2 text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  Booking → Hotels
                </Link>
                : 기존 수동 운영 장부
              </li>
              <li>
                <Link
                  href={`/${locale}/admin/pickup-hotels`}
                  className="underline underline-offset-2 text-foreground"
                  onClick={() => onOpenChange(false)}
                >
                  픽업 호텔
                </Link>
                : 게스트 픽업 장소 (숙박 조달 아님)
              </li>
            </ul>
          </section>
        </div>

        <DialogFooter className="border-t border-border/60 px-5 py-3">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition duration-200 hover:opacity-95"
          >
            확인
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function HotelManagementHelpButton({
  onClick,
}: {
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl border border-border/60 bg-card text-sm font-medium hover:shadow-md transition duration-200"
      aria-haspopup="dialog"
    >
      <HelpCircle className="h-4 w-4" />
      사용법
    </button>
  )
}
