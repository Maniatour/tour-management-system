import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 타입 정의
export interface Database {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string
          name: string
          email: string
          phone: string
          channel: string
          language: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          email: string
          phone: string
          channel: string
          language: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          email?: string
          phone?: string
          channel?: string
          language?: string
          created_at?: string
        }
      }
      products: {
        Row: {
          id: string
          name: string
          category: string
          description: string
          duration: string
          base_price: number
          min_participants: number
          max_participants: number
          difficulty: string
          status: string
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          description: string
          duration: string
          base_price: number
          min_participants: number
          max_participants: number
          difficulty: string
          status: string
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string
          duration?: string
          base_price?: number
          min_participants?: number
          max_participants?: number
          difficulty?: string
          status?: string
          tags?: string[]
          created_at?: string
        }
      }
      options: {
        Row: {
          id: string
          name: string
          category: string
          description: string
          base_price: number
          price_type: string
          min_quantity: number
          max_quantity: number
          status: string
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          category: string
          description: string
          base_price: number
          price_type: string
          min_quantity: number
          max_quantity: number
          status: string
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          category?: string
          description?: string
          base_price?: number
          price_type?: string
          min_quantity?: number
          max_quantity?: number
          status?: string
          tags?: string[]
          created_at?: string
        }
      }
      employees: {
        Row: {
          id: string
          email: string
          name_ko: string
          name_en: string
          language: string
          type: string
          phone: string
          emergency_contact: string
          is_active: boolean
          date_of_birth: string
          address: string
          ssn: string
          photo: string
          personal_car_model: string
          car_year: number
          car_plate: string
          bank_name: string
          account_holder: string
          bank_number: string
          routing_number: string
          cpr: boolean
          cpr_acquired: string
          cpr_expired: string
          medical_report: boolean
          medical_acquired: string
          medical_expired: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          email: string
          name_ko: string
          name_en: string
          language: string
          type: string
          phone: string
          emergency_contact: string
          is_active: boolean
          date_of_birth: string
          address: string
          ssn: string
          photo: string
          personal_car_model: string
          car_year: number
          car_plate: string
          bank_name: string
          account_holder: string
          bank_number: string
          routing_number: string
          cpr: boolean
          cpr_acquired: string
          cpr_expired: string
          medical_report: boolean
          medical_acquired: string
          medical_expired: string
          status: string
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name_ko?: string
          name_en?: string
          language?: string
          type?: string
          phone?: string
          emergency_contact?: string
          is_active?: boolean
          date_of_birth?: string
          address?: string
          ssn?: string
          photo?: string
          personal_car_model?: string
          car_year?: number
          car_plate?: string
          bank_name?: string
          account_holder?: string
          bank_number?: string
          routing_number?: string
          cpr?: boolean
          cpr_acquired?: string
          cpr_expired?: string
          medical_report?: boolean
          medical_acquired?: string
          medical_expired?: string
          status?: string
          created_at?: string
        }
      }
      tours: {
        Row: {
          id: string
          product_id: string
          tour_date: string
          tour_guide_id: string
          assistant_id: string
          tour_car_id: string
          reservation_ids: string[]
          tour_status: string
          tour_start_datetime: string
          tour_end_datetime: string
          guide_fee: number
          assistant_fee: number
          created_at: string
        }
        Insert: {
          id?: string
          product_id: string
          tour_date: string
          tour_guide_id: string
          assistant_id: string
          tour_car_id: string
          reservation_ids?: string[]
          tour_status: string
          tour_start_datetime: string
          tour_end_datetime: string
          guide_fee: number
          assistant_fee: number
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          tour_date?: string
          tour_guide_id?: string
          assistant_id?: string
          tour_car_id?: string
          reservation_ids?: string[]
          tour_status?: string
          tour_start_datetime?: string
          tour_end_datetime?: string
          guide_fee?: number
          assistant_fee?: number
          created_at?: string
        }
      }
      reservations: {
        Row: {
          id: string
          customer_id: string
          product_id: string
          tour_date: string
          tour_time: string
          pickup_hotel: string
          pickup_time: string
          adults: number
          child: number
          infant: number
          total_people: number
          channel: string
          channel_rn: string
          added_by: string
          status: string
          event_note: string
          created_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          product_id: string
          tour_date: string
          tour_time: string
          pickup_hotel: string
          pickup_time: string
          adults: number
          child: number
          infant: number
          total_people: number
          channel: string
          channel_rn: string
          added_by: string
          status: string
          event_note: string
          created_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          product_id?: string
          tour_date?: string
          tour_time?: string
          pickup_hotel?: string
          pickup_time?: string
          adults?: number
          child?: number
          infant?: number
          total_people?: number
          channel?: string
          channel_rn?: string
          added_by?: string
          status?: string
          event_note?: string
          created_at?: string
        }
      }
      channels: {
        Row: {
          id: string
          name: string
          type: string
          website: string
          commission: number
          base_price: number
          markup: number
          status: string
          description: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          website: string
          commission: number
          base_price: number
          markup: number
          status: string
          description: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          website?: string
          commission?: number
          base_price?: number
          markup?: number
          status?: string
          description?: string
          created_at?: string
        }
      }
    }
  }
}
