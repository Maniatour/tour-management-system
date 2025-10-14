// 상담 관리 시스템 타입 정의
import { Database } from '@/lib/database.types'

export type ConsultationCategory = Database['public']['Tables']['consultation_categories']['Row']
export type ConsultationTemplate = Database['public']['Tables']['consultation_templates']['Row']
export type ConsultationLog = Database['public']['Tables']['consultation_logs']['Row']
export type ConsultationStats = Database['public']['Tables']['consultation_stats']['Row']

export type ConsultationCategoryInsert = Database['public']['Tables']['consultation_categories']['Insert']
export type ConsultationTemplateInsert = Database['public']['Tables']['consultation_templates']['Insert']
export type ConsultationLogInsert = Database['public']['Tables']['consultation_logs']['Insert']
export type ConsultationStatsInsert = Database['public']['Tables']['consultation_stats']['Insert']

export type ConsultationCategoryUpdate = Database['public']['Tables']['consultation_categories']['Update']
export type ConsultationTemplateUpdate = Database['public']['Tables']['consultation_templates']['Update']
export type ConsultationLogUpdate = Database['public']['Tables']['consultation_logs']['Update']
export type ConsultationStatsUpdate = Database['public']['Tables']['consultation_stats']['Update']

// 확장된 타입 (조인된 데이터 포함)
export interface ConsultationTemplateWithRelations extends ConsultationTemplate {
  category?: ConsultationCategory
  product?: {
    id: string
    name: string
    name_ko: string
    name_en: string
  }
  channel?: {
    id: string
    name: string
  }
}

export interface ConsultationLogWithRelations extends ConsultationLog {
  customer?: {
    id: string
    name: string
    email: string
  }
  product?: {
    id: string
    name: string
    name_ko: string
    name_en: string
  }
  channel?: {
    id: string
    name: string
  }
  templates?: ConsultationTemplate[]
}

// 템플릿 타입 열거형
export type TemplateType = 'faq' | 'greeting' | 'closing' | 'policy' | 'general'

// 상담 타입 열거형
export type ConsultationType = 'inquiry' | 'complaint' | 'booking' | 'support' | 'other'

// 상담 상태 열거형
export type ConsultationStatus = 'open' | 'resolved' | 'closed' | 'escalated'

// 언어 타입
export type Language = 'ko' | 'en'

// 필터 옵션
export interface ConsultationFilters {
  searchTerm: string
  categoryId: string
  productId: string
  channelId: string
  templateType: TemplateType | 'all'
  isActive: boolean | null
  isFavorite: boolean | null
  language: Language
}

// 통계 데이터
export interface ConsultationStatsData {
  totalTemplates: number
  activeTemplates: number
  favoriteTemplates: number
  totalUsage: number
  mostUsedTemplate?: ConsultationTemplate
  categoryStats: {
    category: ConsultationCategory
    count: number
    usage: number
  }[]
  recentTemplates: ConsultationTemplate[]
}

// 상담 대시보드 데이터
export interface ConsultationDashboardData {
  stats: ConsultationStatsData
  recentLogs: ConsultationLogWithRelations[]
  topTemplates: ConsultationTemplateWithRelations[]
  categoryDistribution: {
    category: ConsultationCategory
    percentage: number
  }[]
}
