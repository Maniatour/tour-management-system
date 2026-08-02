import type { AdminSmsCategoryId } from '@/lib/adminSmsTemplateCatalog'
import { substituteCancellationFollowUpMessageTemplate } from '@/lib/cancellationFollowUpMessage'
import { substituteGuideScheduleAssignmentSmsTemplate } from '@/lib/guideScheduleAssignmentSmsTemplate'
import { substituteGuideScheduleConfirmSmsTemplate } from '@/lib/guideScheduleConfirmSmsTemplate'
import type { SupportedLocale } from '@/lib/guideLanguageDetection'
import {
  buildGuideScheduleConfirmOfficeLine,
  buildGuideScheduleConfirmPickupLine,
  formatGuideScheduleTourDateLabel,
} from '@/lib/guideScheduleConfirmMessage'
import { buildGuideTourAssignmentUrl } from '@/lib/guideScheduleAssignmentMessage'
import {
  DEFAULT_MESSENGER_CONTACT_SETTINGS,
  substitutePreTourContactSmsTemplate,
} from '@/lib/preTourContactSms'
import type { PreTourContactSmsLocale } from '@/lib/preTourContactSmsLocale'
import { substitutePendingAltTourMessageTemplate } from '@/lib/pendingCustomerAltTourMessage'
import {
  substitutePickupNotificationSmsTemplate,
  type PickupNotificationSmsLocale,
} from '@/lib/pickupNotificationSms'

type SampleLocale = 'ko' | 'en' | 'ja' | 'zh'

type SampleData = {
  customerName: string
  productName: string
  tourDate: string
  channelReference: string
  pickupTime: string
  pickupHotel: string
  pickupLocation: string
  guideName: string
  pickupLine: string
  officeLine: string
  chatRoomUrl: string
  rebookingUrl: string
  couponCode: string
  couponValidUntil: string
  priceComparisonPlain: string
}

const SAMPLE_BY_LOCALE: Record<SampleLocale, SampleData> = {
  ko: {
    customerName: '김민수',
    productName: '그랜드캐년 선라이즈 투어',
    tourDate: '2026-08-15',
    channelReference: 'GYG-12345678',
    pickupTime: '22:00',
    pickupHotel: 'Bellagio Hotel',
    pickupLocation: 'Valet Pickup (Main Entrance)',
    guideName: 'James Park',
    pickupLine: '픽업 10:00 PM · Bellagio Hotel',
    officeLine: '오피스 미팅 04:45',
    chatRoomUrl: 'https://chat.example.com/room/abc',
    rebookingUrl: 'https://www.kovegas.com/tours/grand-canyon',
    couponCode: 'REBOOK15',
    couponValidUntil: '2026년 9월 30일',
    priceComparisonPlain: '다른 채널 대비 약 $25 절약',
  },
  en: {
    customerName: 'Alex Kim',
    productName: 'Grand Canyon Sunrise Tour',
    tourDate: '2026-08-15',
    channelReference: 'GYG-12345678',
    pickupTime: '22:00',
    pickupHotel: 'Bellagio Hotel',
    pickupLocation: 'Valet Pickup (Main Entrance)',
    guideName: 'James Park',
    pickupLine: 'Pickup 10:00 PM · Bellagio Hotel',
    officeLine: 'Office meetup 4:45 AM',
    chatRoomUrl: 'https://chat.example.com/room/abc',
    rebookingUrl: 'https://www.kovegas.com/tours/grand-canyon',
    couponCode: 'REBOOK15',
    couponValidUntil: 'September 30, 2026',
    priceComparisonPlain: 'Save about $25 vs other channels',
  },
  ja: {
    customerName: '田中太郎',
    productName: 'グランドキャニオン・サンライズツアー',
    tourDate: '2026-08-15',
    channelReference: 'GYG-12345678',
    pickupTime: '22:00',
    pickupHotel: 'Bellagio Hotel',
    pickupLocation: 'Valet Pickup (Main Entrance)',
    guideName: 'James Park',
    pickupLine: 'ピックアップ 22:00 · Bellagio Hotel',
    officeLine: 'オフィス集合 04:45',
    chatRoomUrl: 'https://chat.example.com/room/abc',
    rebookingUrl: 'https://www.kovegas.com/tours/grand-canyon',
    couponCode: 'REBOOK15',
    couponValidUntil: '2026年9月30日',
    priceComparisonPlain: '他チャネルより約$25お得',
  },
  zh: {
    customerName: '王明',
    productName: '大峡谷日出之旅',
    tourDate: '2026-08-15',
    channelReference: 'GYG-12345678',
    pickupTime: '22:00',
    pickupHotel: 'Bellagio Hotel',
    pickupLocation: 'Valet Pickup (Main Entrance)',
    guideName: 'James Park',
    pickupLine: '接送 22:00 · Bellagio Hotel',
    officeLine: '办公室集合 04:45',
    chatRoomUrl: 'https://chat.example.com/room/abc',
    rebookingUrl: 'https://www.kovegas.com/tours/grand-canyon',
    couponCode: 'REBOOK15',
    couponValidUntil: '2026年9月30日',
    priceComparisonPlain: '比其他渠道节省约 $25',
  },
}

function resolveSampleLocale(locale: string): SampleLocale {
  if (locale === 'ko' || locale === 'en' || locale === 'ja' || locale === 'zh') return locale
  return 'en'
}

function resolveStaffLocale(locale: string): 'ko' | 'en' {
  return locale === 'ko' ? 'ko' : 'en'
}

export function buildAdminSmsSamplePreview(params: {
  categoryId: AdminSmsCategoryId
  locale: string
  bodyTpl: string
}): string {
  const { categoryId, locale, bodyTpl } = params
  const trimmed = bodyTpl.trim()
  if (!trimmed) return ''

  const sample = SAMPLE_BY_LOCALE[resolveSampleLocale(locale)]

  if (categoryId === 'pre_tour_contact') {
    const loc = (locale === 'ko' || locale === 'en' || locale === 'ja' ? locale : 'en') as PreTourContactSmsLocale
    return substitutePreTourContactSmsTemplate(trimmed, {
      customerName: sample.customerName,
      productName: sample.productName,
      tourDate: sample.tourDate,
      channelReference: sample.channelReference,
      pickupTime: sample.pickupTime,
      pickupHotelName: sample.pickupHotel,
      pickupLocation: sample.pickupLocation,
      chatRoomUrl: sample.chatRoomUrl,
      contacts: DEFAULT_MESSENGER_CONTACT_SETTINGS,
      locale: loc,
    })
  }

  if (categoryId === 'pickup_notification') {
    const loc = (locale === 'ko' || locale === 'en' || locale === 'ja' ? locale : 'en') as PickupNotificationSmsLocale
    return substitutePickupNotificationSmsTemplate(trimmed, {
      customerName: sample.customerName,
      productName: sample.productName,
      tourDate: sample.tourDate,
      channelReference: sample.channelReference,
      pickupTime: sample.pickupTime,
      pickupHotelName: sample.pickupHotel,
      pickupLocation: sample.pickupLocation,
      contacts: DEFAULT_MESSENGER_CONTACT_SETTINGS,
      locale: loc,
    })
  }

  if (categoryId === 'guide_schedule_assignment') {
    const guideLocale = (locale === 'ko' || locale === 'en' || locale === 'ja' || locale === 'zh'
      ? locale
      : 'en') as SupportedLocale
    const tourDateIso = '2026-07-31'
    const pickupTimeRaw = '22:40'
    const pickupTimeDisplay = '10:40 PM'
    const pickupHotel =
      guideLocale === 'ko' ? '더 베네치안 라스베가스' : 'The Venetian Las Vegas'
    return substituteGuideScheduleAssignmentSmsTemplate(trimmed, {
      guideName: guideLocale === 'en' ? 'Dez' : sample.guideName,
      tourDate: formatGuideScheduleTourDateLabel(tourDateIso, guideLocale),
      productName:
        guideLocale === 'ko' ? '선라이즈 투어' : guideLocale === 'ja' ? 'サンライズツアー' : 'Sunrise Tour',
      pickupLine: buildGuideScheduleConfirmPickupLine(
        guideLocale,
        pickupTimeDisplay,
        pickupHotel,
        '2026-07-30',
      ),
      officeLine: buildGuideScheduleConfirmOfficeLine(guideLocale, tourDateIso, pickupTimeRaw),
      confirmUrl: buildGuideTourAssignmentUrl('sample-tour-id', guideLocale),
    })
  }

  if (categoryId === 'guide_schedule_confirm') {
    const guideLocale = (locale === 'ko' || locale === 'en' || locale === 'ja' || locale === 'zh'
      ? locale
      : 'en') as SupportedLocale
    const tourDateIso = '2026-07-31'
    const pickupTimeRaw = '22:40'
    const pickupTimeDisplay = '10:40 PM'
    const pickupHotel =
      guideLocale === 'ko' ? '더 베네치안 라스베가스' : 'The Venetian Las Vegas'
    return substituteGuideScheduleConfirmSmsTemplate(trimmed, {
      guideName: guideLocale === 'en' ? 'Dez' : sample.guideName,
      tourDate: formatGuideScheduleTourDateLabel(tourDateIso, guideLocale),
      productName:
        guideLocale === 'ko' ? '선라이즈 투어' : guideLocale === 'ja' ? 'サンライズツアー' : 'Sunrise Tour',
      pickupLine: buildGuideScheduleConfirmPickupLine(
        guideLocale,
        pickupTimeDisplay,
        pickupHotel,
        '2026-07-30',
      ),
      officeLine: buildGuideScheduleConfirmOfficeLine(guideLocale, tourDateIso, pickupTimeRaw),
    })
  }

  if (categoryId === 'cancellation_follow_up' || categoryId === 'cancellation_rebooking') {
    const staffLocale = resolveStaffLocale(locale)
    return substituteCancellationFollowUpMessageTemplate('', trimmed, 'sms', {
      customerName: sample.customerName,
      productName: sample.productName,
      tourDate: sample.tourDate,
      channelReference: sample.channelReference,
      locale: staffLocale,
      tourDateLong: sample.tourDate,
      rebookingUrl: sample.rebookingUrl,
      couponCode: sample.couponCode,
      couponValidUntil: sample.couponValidUntil,
      priceComparisonPlain: sample.priceComparisonPlain,
    }).body
  }

  if (categoryId === 'pending_alt_tour') {
    const staffLocale = resolveStaffLocale(locale)
    return substitutePendingAltTourMessageTemplate(trimmed, {
      customerName: sample.customerName,
      productName: sample.productName,
      tourDate: sample.tourDate,
      channelReference: sample.channelReference,
      locale: staffLocale,
    })
  }

  return trimmed
}

export function getAdminSmsSamplePreviewNote(uiLocale: string): string {
  return uiLocale.startsWith('ko')
    ? '아래는 샘플 예약 데이터로 치환한 미리보기입니다. 실제 발송 시에는 각 예약 정보가 반영됩니다.'
    : 'Preview uses sample booking data. Actual sends use each reservation’s details.'
}
