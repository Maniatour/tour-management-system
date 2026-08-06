'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

function TodoPanelLoading() {
  return (
    <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
    </div>
  )
}

export const PickupNotificationPanel = dynamic(
  () => import('./PickupNotificationPanel').then((m) => m.PickupNotificationPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const GuideScheduleConfirmPanel = dynamic(
  () => import('./GuideScheduleConfirmPanel').then((m) => m.GuideScheduleConfirmPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const CustomerInfoReviewPanel = dynamic(
  () => import('./CustomerInfoReviewPanel').then((m) => m.CustomerInfoReviewPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const CancelRebookingFollowUpPanel = dynamic(
  () => import('./CancelRebookingFollowUpPanel').then((m) => m.CancelRebookingFollowUpPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const PendingCustomerManagementPanel = dynamic(
  () => import('./PendingCustomerManagementPanel').then((m) => m.PendingCustomerManagementPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const OtaClosurePanel = dynamic(
  () => import('./OtaClosurePanel').then((m) => m.OtaClosurePanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const TourHotelManagementPanel = dynamic(
  () => import('./TourHotelManagementPanel').then((m) => m.TourHotelManagementPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const TourHotelPriceCheckPanel = dynamic(
  () => import('./TourHotelPriceCheckPanel').then((m) => m.TourHotelPriceCheckPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const TourHotelCcFormPanel = dynamic(
  () => import('./TourHotelCcFormPanel').then((m) => m.TourHotelCcFormPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const TourSettlementPanel = dynamic(
  () => import('./TourSettlementPanel').then((m) => m.TourSettlementPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const ReservationAgencyManagementPanel = dynamic(
  () => import('./ReservationAgencyManagementPanel').then((m) => m.ReservationAgencyManagementPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const AntelopeCanyonBookingPanel = dynamic(
  () => import('./AntelopeCanyonBookingPanel').then((m) => m.AntelopeCanyonBookingPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const BentoCheckPanel = dynamic(
  () => import('./BentoCheckPanel').then((m) => m.BentoCheckPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const TourEnvelopePrintPanel = dynamic(
  () => import('./TourEnvelopePrintPanel').then((m) => m.TourEnvelopePrintPanel),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)

export const LazyTourQuickPrintHost = dynamic(
  () => import('./TourQuickPrintHost').then((m) => m.TourQuickPrintHost),
  { ssr: false, loading: () => null }
)

export const LazyTourPickupNotificationHost = dynamic(
  () => import('./TourPickupNotificationHost').then((m) => m.TourPickupNotificationHost),
  { ssr: false, loading: () => null }
)

export const LazyReservationCardItem = dynamic(
  () => import('@/components/reservation/ReservationCardItem').then((m) => m.ReservationCardItem),
  { ssr: false, loading: () => <TodoPanelLoading /> }
)
