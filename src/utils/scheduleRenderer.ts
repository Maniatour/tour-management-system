/**
 * 투어 스케줄을 HTML로 렌더링하는 유틸리티 함수들
 */

export interface ScheduleItem {
  day?: number
  time: string
  title: string
  location: string
  description?: string
  show_to_customers?: boolean
  is_tour?: boolean
  is_transport?: boolean
  is_meal?: boolean
  is_break?: boolean
}

/**
 * 스케줄 아이템을 HTML로 렌더링
 */
export function renderScheduleItem(item: ScheduleItem, locale: 'ko' | 'en' = 'ko'): string {
  // const timeLabel = locale === 'ko' ? '시간' : 'Time'
  const locationLabel = locale === 'ko' ? '장소' : 'Location'
  const descriptionLabel = locale === 'ko' ? '설명' : 'Description'
  
  const html = `
    <div class="schedule-item" style="margin-bottom: 12px; padding: 8px; border-left: 3px solid #3b82f6; background-color: #f8fafc;">
      <div style="font-weight: bold; color: #1e40af; margin-bottom: 4px;">
        ${item.time} - ${item.title}
      </div>
      <div style="color: #374151; margin-bottom: 2px;">
        <strong>${locationLabel}:</strong> ${item.location}
      </div>
      ${item.description ? `
        <div style="color: #6b7280; font-size: 0.9em;">
          <strong>${descriptionLabel}:</strong> ${item.description}
        </div>
      ` : ''}
    </div>
  `
  
  return html
}

/**
 * 일차별 스케줄을 HTML로 렌더링
 */
export function renderScheduleByDay(schedules: ScheduleItem[], locale: 'ko' | 'en' = 'ko'): string {
  if (!schedules || schedules.length === 0) {
    return `<p style="color: #6b7280; font-style: italic;">${locale === 'ko' ? '등록된 일정이 없습니다.' : 'No schedules registered.'}</p>`
  }

  // const dayLabel = locale === 'ko' ? '일차' : 'Day'
  // const scheduleLabel = locale === 'ko' ? '일정' : 'Schedule'
  
  let html = '<div class="schedule-container">'
  
  schedules.forEach((item) => {
    html += renderScheduleItem(item, locale)
  })
  
  html += '</div>'
  
  return html
}

/**
 * 전체 스케줄을 일차별로 그룹화하여 HTML로 렌더링
 */
export function renderFullSchedule(schedules: ScheduleItem[], locale: 'ko' | 'en' = 'ko'): string {
  if (!schedules || schedules.length === 0) {
    return `<p style="color: #6b7280; font-style: italic;">${locale === 'ko' ? '등록된 일정이 없습니다.' : 'No schedules registered.'}</p>`
  }

  const dayLabel = locale === 'ko' ? '일차' : 'Day'
  // const scheduleLabel = locale === 'ko' ? '일정' : 'Schedule'
  
  // 일차별로 그룹화
  const schedulesByDay = schedules.reduce((acc, schedule) => {
    const day = schedule.day || 1
    if (!acc[day]) {
      acc[day] = []
    }
    acc[day].push(schedule)
    return acc
  }, {} as Record<number, ScheduleItem[]>)

  let html = '<div class="full-schedule-container">'
  
  Object.keys(schedulesByDay)
    .map(Number)
    .sort((a, b) => a - b)
    .forEach(dayNumber => {
      const daySchedules = schedulesByDay[dayNumber]
      html += `
        <div class="day-schedule" style="margin-bottom: 20px;">
          <h3 style="color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-bottom: 12px;">
            ${dayNumber}${dayLabel}
          </h3>
          ${daySchedules.map(item => renderScheduleItem(item, locale)).join('')}
        </div>
      `
    })
  
  html += '</div>'
  
  return html
}

/**
 * 카테고리별 스케줄을 HTML로 렌더링
 */
export function renderScheduleByCategory(schedules: ScheduleItem[], category: 'tour' | 'transport' | 'meal' | 'break', locale: 'ko' | 'en' = 'ko'): string {
  if (!schedules || schedules.length === 0) {
    return `<p style="color: #6b7280; font-style: italic;">${locale === 'ko' ? '해당 카테고리의 일정이 없습니다.' : 'No schedules in this category.'}</p>`
  }

  const categoryLabels = {
    tour: locale === 'ko' ? '투어' : 'Tour',
    transport: locale === 'ko' ? '교통편' : 'Transport',
    meal: locale === 'ko' ? '식사' : 'Meal',
    break: locale === 'ko' ? '휴식' : 'Break'
  }

  const categoryLabel = categoryLabels[category]
  
  const html = `
    <div class="category-schedule" style="margin-bottom: 16px;">
      <h3 style="color: #059669; border-bottom: 2px solid #10b981; padding-bottom: 4px; margin-bottom: 12px;">
        ${categoryLabel} ${locale === 'ko' ? '일정' : 'Schedule'}
      </h3>
      ${schedules.map(item => renderScheduleItem(item, locale)).join('')}
    </div>
  `
  
  return html
}

/**
 * JSON 문자열을 파싱하여 스케줄 배열로 변환
 */
export function parseScheduleJson(jsonString: string): ScheduleItem[] {
  try {
    const parsed = JSON.parse(jsonString)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.error('스케줄 JSON 파싱 오류:', error)
    return []
  }
}

/**
 * 템플릿에서 사용할 수 있는 스케줄 렌더링 함수들
 */
export const scheduleRenderers = {
  /**
   * 고객용 전체 스케줄 렌더링
   */
  renderCustomerSchedule: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderFullSchedule(schedules, locale)
  },

  /**
   * 고객용 일차별 스케줄 렌더링
   */
  renderCustomerDaySchedule: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderScheduleByDay(schedules, locale)
  },

  /**
   * 고객용 투어 아이템만 렌더링
   */
  renderCustomerTourItems: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderScheduleByCategory(schedules, 'tour', locale)
  },

  /**
   * 고객용 교통편만 렌더링
   */
  renderCustomerTransportItems: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderScheduleByCategory(schedules, 'transport', locale)
  },

  /**
   * 고객용 식사만 렌더링
   */
  renderCustomerMealItems: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderScheduleByCategory(schedules, 'meal', locale)
  },

  /**
   * 고객용 휴식만 렌더링
   */
  renderCustomerBreakItems: (jsonString: string, locale: 'ko' | 'en' = 'ko') => {
    const schedules = parseScheduleJson(jsonString)
    return renderScheduleByCategory(schedules, 'break', locale)
  }
}
