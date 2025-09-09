// 투어 관리 시스템 데이터베이스 타입 정의

export interface Database {
  public: {
    Tables: {
      team: {
        Row: {
          email: string
          name_ko: string
          name_en: string | null
          phone: string | null
          position: string | null
          languages: string[] | null
          avatar_url: string | null
          is_active: boolean
          hire_date: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
          emergency_contact: string | null
          date_of_birth: string | null
          ssn: string | null
          personal_car_model: string | null
          car_year: number | null
          car_plate: string | null
          bank_name: string | null
          account_holder: string | null
          bank_number: string | null
          routing_number: string | null
          cpr: boolean | null
          cpr_acquired: string | null
          cpr_expired: string | null
          medical_report: boolean | null
          medical_acquired: string | null
          medical_expired: string | null
          address: string | null
        }
        Insert: {
          email: string
          name_ko: string
          name_en?: string | null
          phone?: string | null
          position?: string | null
          languages?: string[] | null
          avatar_url?: string | null
          is_active?: boolean
          hire_date?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          emergency_contact?: string | null
          date_of_birth?: string | null
          ssn?: string | null
          personal_car_model?: string | null
          car_year?: number | null
          car_plate?: string | null
          bank_name?: string | null
          account_holder?: string | null
          bank_number?: string | null
          routing_number?: string | null
          cpr?: boolean | null
          cpr_acquired?: string | null
          cpr_expired?: string | null
          medical_report?: boolean | null
          medical_acquired?: string | null
          medical_expired?: string | null
          address?: string | null
        }
        Update: {
          email?: string
          name_ko?: string
          name_en?: string | null
          phone?: string | null
          position?: string | null
          languages?: string[] | null
          avatar_url?: string | null
          is_active?: boolean
          hire_date?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
          emergency_contact?: string | null
          date_of_birth?: string | null
          ssn?: string | null
          personal_car_model?: string | null
          car_year?: number | null
          car_plate?: string | null
          bank_name?: string | null
          account_holder?: string | null
          bank_number?: string | null
          routing_number?: string | null
          cpr?: boolean | null
          cpr_acquired?: string | null
          cpr_expired?: string | null
          medical_report?: boolean | null
          medical_acquired?: string | null
          medical_expired?: string | null
          address?: string | null
        }
      }
      customers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          language: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone?: string | null
          language?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string | null
          language?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      products: {
        Row: {
          id: string
          name_ko: string
          name_en: string | null
          sub_category: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name_ko: string
          name_en?: string | null
          sub_category?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string | null
          sub_category?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      reservations: {
        Row: {
          id: string
          customer_id: string | null
          product_id: string | null
          tour_date: string
          tour_time: string | null
          pickup_hotel: string | null
          pickup_time: string | null
          adults: number
          child: number
          infant: number
          total_people: number
          channel_id: string | null
          channel_rn: string | null
          added_by: string | null
          tour_id: string | null
          status: string
          event_note: string | null
          selected_options: any | null
          selected_option_prices: any | null
          is_private_tour: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          customer_id?: string | null
          product_id?: string | null
          tour_date: string
          tour_time?: string | null
          pickup_hotel?: string | null
          pickup_time?: string | null
          adults?: number
          child?: number
          infant?: number
          total_people: number
          channel_id?: string | null
          channel_rn?: string | null
          added_by?: string | null
          tour_id?: string | null
          status?: string
          event_note?: string | null
          selected_options?: any | null
          selected_option_prices?: any | null
          is_private_tour?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          customer_id?: string | null
          product_id?: string | null
          tour_date?: string
          tour_time?: string | null
          pickup_hotel?: string | null
          pickup_time?: string | null
          adults?: number
          child?: number
          infant?: number
          total_people?: number
          channel_id?: string | null
          channel_rn?: string | null
          added_by?: string | null
          tour_id?: string | null
          status?: string
          event_note?: string | null
          selected_options?: any | null
          selected_option_prices?: any | null
          is_private_tour?: boolean
          created_at?: string | null
        }
      }
      reservation_pricing: {
        Row: {
          id: string
          reservation_id: string
          adult_product_price: number
          child_product_price: number
          infant_product_price: number
          product_price_total: number
          required_options: any
          required_option_total: number
          subtotal: number
          coupon_code: string | null
          coupon_discount: number
          additional_discount: number
          additional_cost: number
          card_fee: number
          tax: number
          prepayment_cost: number
          prepayment_tip: number
          selected_options: any
          option_total: number
          total_price: number
          deposit_amount: number
          balance_amount: number
          private_tour_additional_cost: number
          commission_percent: number
        }
        Insert: {
          id?: string
          reservation_id: string
          adult_product_price?: number
          child_product_price?: number
          infant_product_price?: number
          product_price_total?: number
          required_options?: any
          required_option_total?: number
          subtotal?: number
          coupon_code?: string | null
          coupon_discount?: number
          additional_discount?: number
          additional_cost?: number
          card_fee?: number
          tax?: number
          prepayment_cost?: number
          prepayment_tip?: number
          selected_options?: any
          option_total?: number
          total_price?: number
          deposit_amount?: number
          balance_amount?: number
          private_tour_additional_cost?: number
          commission_percent?: number
        }
        Update: {
          id?: string
          reservation_id?: string
          adult_product_price?: number
          child_product_price?: number
          infant_product_price?: number
          product_price_total?: number
          required_options?: any
          required_option_total?: number
          subtotal?: number
          coupon_code?: string | null
          coupon_discount?: number
          additional_discount?: number
          additional_cost?: number
          card_fee?: number
          tax?: number
          prepayment_cost?: number
          prepayment_tip?: number
          selected_options?: any
          option_total?: number
          total_price?: number
          deposit_amount?: number
          balance_amount?: number
          private_tour_additional_cost?: number
          commission_percent?: number
        }
      }
      tours: {
        Row: {
          id: string
          product_id: string | null
          tour_date: string
          reservation_ids: string[] | null
          tour_status: string | null
          is_private_tour: boolean
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id?: string | null
          tour_date: string
          reservation_ids?: string[] | null
          tour_status?: string | null
          is_private_tour?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string | null
          tour_date?: string
          reservation_ids?: string[] | null
          tour_status?: string | null
          is_private_tour?: boolean
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
    Views: {
      [key: string]: {
        Row: {
          [key: string]: any
        }
        Insert: {
          [key: string]: any
        }
        Update: {
          [key: string]: any
        }
      }
    }
    Functions: {
      [key: string]: {
        Args: {
          [key: string]: any
        }
        Returns: any
      }
    }
    Enums: {
      [key: string]: string
    }
    CompositeTypes: {
      [key: string]: Record<string, any>
    }
  }
}
