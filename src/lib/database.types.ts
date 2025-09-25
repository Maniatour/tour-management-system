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
          category: string | null
          base_price: number | null
          duration: string | null
          max_participants: number | null
          status: string | null
          tags: string[] | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name_ko: string
          name_en?: string | null
          sub_category?: string | null
          category?: string | null
          base_price?: number | null
          duration?: string | null
          max_participants?: number | null
          status?: string | null
          tags?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string | null
          sub_category?: string | null
          category?: string | null
          base_price?: number | null
          duration?: string | null
          max_participants?: number | null
          status?: string | null
          tags?: string[] | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      product_details: {
        Row: {
          id: string
          product_id: string
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          description: string | null
          included: string | null
          not_included: string | null
          pickup_drop_info: string | null
          luggage_info: string | null
          tour_operation_info: string | null
          preparation_info: string | null
          small_group_info: string | null
          companion_info: string | null
          exclusive_booking_info: string | null
          cancellation_policy: string | null
          chat_announcement: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          product_id: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          description?: string | null
          included?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          luggage_info?: string | null
          tour_operation_info?: string | null
          preparation_info?: string | null
          small_group_info?: string | null
          companion_info?: string | null
          exclusive_booking_info?: string | null
          cancellation_policy?: string | null
          chat_announcement?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          description?: string | null
          included?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          luggage_info?: string | null
          tour_operation_info?: string | null
          preparation_info?: string | null
          small_group_info?: string | null
          companion_info?: string | null
          exclusive_booking_info?: string | null
          cancellation_policy?: string | null
          chat_announcement?: string | null
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
          tour_guide_id: string | null
          assistant_id: string | null
          tour_car_id: string | null
          tour_start_datetime: string | null
          tour_end_datetime: string | null
          guide_fee: number | null
          assistant_fee: number | null
          team_type: string | null
          tour_note: string | null
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
          tour_guide_id?: string | null
          assistant_id?: string | null
          tour_car_id?: string | null
          tour_start_datetime?: string | null
          tour_end_datetime?: string | null
          guide_fee?: number | null
          assistant_fee?: number | null
          team_type?: string | null
          tour_note?: string | null
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
          tour_guide_id?: string | null
          assistant_id?: string | null
          tour_car_id?: string | null
          tour_start_datetime?: string | null
          tour_end_datetime?: string | null
          guide_fee?: number | null
          assistant_fee?: number | null
          team_type?: string | null
          tour_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_reports: {
        Row: {
          id: string
          tour_id: string
          end_mileage: number | null
          cash_balance: number | null
          customer_count: number | null
          weather: string | null
          main_stops_visited: string[] | null
          activities_completed: string[] | null
          overall_mood: string | null
          guest_comments: string | null
          incidents_delays_health: string[] | null
          lost_items_damage: string[] | null
          suggestions_followup: string | null
          communication: string | null
          teamwork: string | null
          comments: string | null
          submitted_on: string
          user_email: string
          sign: string | null
          office_note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tour_id: string
          end_mileage?: number | null
          cash_balance?: number | null
          customer_count?: number | null
          weather?: string | null
          main_stops_visited?: string[] | null
          activities_completed?: string[] | null
          overall_mood?: string | null
          guest_comments?: string | null
          incidents_delays_health?: string[] | null
          lost_items_damage?: string[] | null
          suggestions_followup?: string | null
          communication?: string | null
          teamwork?: string | null
          comments?: string | null
          submitted_on?: string
          user_email: string
          sign?: string | null
          office_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tour_id?: string
          end_mileage?: number | null
          cash_balance?: number | null
          customer_count?: number | null
          weather?: string | null
          main_stops_visited?: string[] | null
          activities_completed?: string[] | null
          overall_mood?: string | null
          guest_comments?: string | null
          incidents_delays_health?: string[] | null
          lost_items_damage?: string[] | null
          suggestions_followup?: string | null
          communication?: string | null
          teamwork?: string | null
          comments?: string | null
          submitted_on?: string
          user_email?: string
          sign?: string | null
          office_note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      ticket_bookings: {
        Row: {
          id: string
          tour_id: string | null
          company: string | null
          category: string | null
          time: string | null
          ea: number | null
          rn_number: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tour_id?: string | null
          company?: string | null
          category?: string | null
          time?: string | null
          ea?: number | null
          rn_number?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tour_id?: string | null
          company?: string | null
          category?: string | null
          time?: string | null
          ea?: number | null
          rn_number?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_hotel_bookings: {
        Row: {
          id: string
          tour_id: string | null
          hotel_name: string | null
          check_in_date: string | null
          check_out_date: string | null
          booking_reference: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          tour_id?: string | null
          hotel_name?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          booking_reference?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          tour_id?: string | null
          hotel_name?: string | null
          check_in_date?: string | null
          check_out_date?: string | null
          booking_reference?: string | null
          status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      pickup_hotels: {
        Row: {
          id: string
          hotel: string
          pick_up_location: string
          link: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          hotel: string
          pick_up_location: string
          link?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          hotel?: string
          pick_up_location?: string
          link?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      vehicles: {
        Row: {
          id: string
          vehicle_category: string | null
          vehicle_number: string | null
          vehicle_type: string | null
          capacity: number | null
          vehicle_status: string | null
          rental_company: string | null
          rental_start_date: string | null
          rental_end_date: string | null
          rental_status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          vehicle_category?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
          capacity?: number | null
          vehicle_status?: string | null
          rental_company?: string | null
          rental_start_date?: string | null
          rental_end_date?: string | null
          rental_status?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          vehicle_category?: string | null
          vehicle_number?: string | null
          vehicle_type?: string | null
          capacity?: number | null
          vehicle_status?: string | null
          rental_company?: string | null
          rental_start_date?: string | null
          rental_end_date?: string | null
          rental_status?: string | null
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
    tour_expenses: {
      Row: {
        id: string
        tour_id: string
        submit_on: string
        paid_to: string | null
        paid_for: string
        amount: number
        payment_method: string | null
        note: string | null
        tour_date: string
        product_id: string | null
        submitted_by: string
        image_url: string | null
        file_path: string | null
        audited_by: string | null
        checked_by: string | null
        checked_on: string | null
        status: 'pending' | 'approved' | 'rejected'
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        tour_id: string
        submit_on?: string
        paid_to: string | null
        paid_for: string
        amount: number
        payment_method?: string | null
        note?: string | null
        tour_date: string
        product_id?: string | null
        submitted_by: string
        image_url?: string | null
        file_path?: string | null
        audited_by?: string | null
        checked_by?: string | null
        checked_on?: string | null
        status?: 'pending' | 'approved' | 'rejected'
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        tour_id?: string
        submit_on?: string
        paid_to?: string
        paid_for?: string
        amount?: number
        payment_method?: string | null
        note?: string | null
        tour_date?: string
        product_id?: string | null
        submitted_by?: string
        image_url?: string | null
        file_path?: string | null
        audited_by?: string | null
        checked_by?: string | null
        checked_on?: string | null
        status?: 'pending' | 'approved' | 'rejected'
        created_at?: string
        updated_at?: string
      }
    }
    expense_categories: {
      Row: {
        id: string
        name: string
        created_at: string
      }
      Insert: {
        id?: string
        name: string
        created_at?: string
      }
      Update: {
        id?: string
        name?: string
        created_at?: string
      }
    }
    expense_vendors: {
      Row: {
        id: string
        name: string
        created_at: string
      }
      Insert: {
        id?: string
        name: string
        created_at?: string
      }
      Update: {
        id?: string
        name?: string
        created_at?: string
      }
    }
    CompositeTypes: {
      [key: string]: Record<string, any>
    }
  }
}
