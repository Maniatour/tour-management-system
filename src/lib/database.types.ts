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
          // address: string | null // 실제 데이터베이스에 컬럼이 없음
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
          // address?: string | null // 실제 데이터베이스에 컬럼이 없음
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
          // address?: string | null // 실제 데이터베이스에 컬럼이 없음
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
          name: string
          name_en: string | null
          product_code: string | null
          sub_category: string | null
          category: string | null
          description: string | null
          base_price: number | null
          duration: string | null
          max_participants: number | null
          status: string | null
          departure_city: string | null
          arrival_city: string | null
          departure_country: string | null
          arrival_country: string | null
          languages: string[] | null
          group_size: string | null
          adult_age: number | null
          child_age_min: number | null
          child_age_max: number | null
          infant_age: number | null
          tags: string[] | null
          choices: any | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          name_en?: string | null
          product_code?: string | null
          sub_category?: string | null
          category?: string | null
          description?: string | null
          base_price?: number | null
          duration?: string | null
          max_participants?: number | null
          status?: string | null
          departure_city?: string | null
          arrival_city?: string | null
          departure_country?: string | null
          arrival_country?: string | null
          languages?: string[] | null
          group_size?: string | null
          adult_age?: number | null
          child_age_min?: number | null
          child_age_max?: number | null
          infant_age?: number | null
          tags?: string[] | null
          choices?: any | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          name_en?: string | null
          product_code?: string | null
          sub_category?: string | null
          category?: string | null
          description?: string | null
          base_price?: number | null
          duration?: string | null
          max_participants?: number | null
          status?: string | null
          departure_city?: string | null
          arrival_city?: string | null
          departure_country?: string | null
          arrival_country?: string | null
          languages?: string[] | null
          group_size?: string | null
          adult_age?: number | null
          child_age_min?: number | null
          child_age_max?: number | null
          infant_age?: number | null
          tags?: string[] | null
          choices?: any | null
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
          selected_options: Record<string, unknown> | null
          selected_option_prices: Record<string, unknown> | null
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
          selected_options?: Record<string, unknown> | null
          selected_option_prices?: Record<string, unknown> | null
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
          selected_options?: Record<string, unknown> | null
          selected_option_prices?: Record<string, unknown> | null
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
          required_options: Record<string, unknown>
          required_option_total: number
          choices: Record<string, unknown>
          choices_total: number
          subtotal: number
          coupon_code: string | null
          coupon_discount: number
          additional_discount: number
          additional_cost: number
          card_fee: number
          tax: number
          prepayment_cost: number
          prepayment_tip: number
          selected_options: Record<string, unknown>
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
          required_options?: Record<string, unknown>
          required_option_total?: number
          choices?: Record<string, unknown>
          choices_total?: number
          subtotal?: number
          coupon_code?: string | null
          coupon_discount?: number
          additional_discount?: number
          additional_cost?: number
          card_fee?: number
          tax?: number
          prepayment_cost?: number
          prepayment_tip?: number
          selected_options?: Record<string, unknown>
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
          required_options?: Record<string, unknown>
          required_option_total?: number
          choices?: Record<string, unknown>
          choices_total?: number
          subtotal?: number
          coupon_code?: string | null
          coupon_discount?: number
          additional_discount?: number
          additional_cost?: number
          card_fee?: number
          tax?: number
          prepayment_cost?: number
          prepayment_tip?: number
          selected_options?: Record<string, unknown>
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
          assignment_status: string | null
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
          assignment_status?: string | null
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
          assignment_status?: string | null
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
          description_ko: string | null
          description_en: string | null
          address: string
          pin: string | null
          link: string | null
          youtube_link: string | null
          media: string[] | null
          is_active: boolean | null
          group_number: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          hotel: string
          pick_up_location: string
          description_ko?: string | null
          description_en?: string | null
          address: string
          pin?: string | null
          link?: string | null
          youtube_link?: string | null
          media?: string[] | null
          is_active?: boolean | null
          group_number?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          hotel?: string
          pick_up_location?: string
          description_ko?: string | null
          description_en?: string | null
          address?: string
          pin?: string | null
          link?: string | null
          youtube_link?: string | null
          media?: string[] | null
          is_active?: boolean | null
          group_number?: number | null
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
      off_schedules: {
        Row: {
          id: string
          team_email: string
          off_date: string
          reason: string
          status: string | null
          approved_by: string | null
          approved_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          team_email: string
          off_date: string
          reason: string
          status?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          team_email?: string
          off_date?: string
          reason?: string
          status?: string | null
          approved_by?: string | null
          approved_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      team_announcement_acknowledgments: {
        Row: {
          id: string
          announcement_id: string
          ack_by: string
          ack_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          announcement_id: string
          ack_by: string
          ack_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          announcement_id?: string
          ack_by?: string
          ack_at?: string
          created_at?: string | null
        }
      }
    }
    Views: {
      [key: string]: {
        Row: {
          [key: string]: unknown
        }
        Insert: {
          [key: string]: unknown
        }
        Update: {
          [key: string]: unknown
        }
      }
    }
    Functions: {
      [key: string]: {
        Args: {
          [key: string]: unknown
        }
        Returns: unknown
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
    sunrise_sunset_data: {
      Row: {
        id: string
        location_name: string
        latitude: number
        longitude: number
        date: string
        sunrise_time: string
        sunset_time: string
        created_at: string | null
        updated_at: string | null
      }
      Insert: {
        id?: string
        location_name: string
        latitude: number
        longitude: number
        date: string
        sunrise_time: string
        sunset_time: string
        created_at?: string | null
        updated_at?: string | null
      }
      Update: {
        id?: string
        location_name?: string
        latitude?: number
        longitude?: number
        date?: string
        sunrise_time?: string
        sunset_time?: string
        created_at?: string | null
        updated_at?: string | null
      }
    }
    weather_data: {
      Row: {
        id: string
        location_name: string
        latitude: number
        longitude: number
        date: string
        temperature: number | null
        humidity: number | null
        weather_main: string | null
        weather_description: string | null
        wind_speed: number | null
        visibility: number | null
        created_at: string | null
        updated_at: string | null
      }
      Insert: {
        id?: string
        location_name: string
        latitude: number
        longitude: number
        date: string
        temperature?: number | null
        humidity?: number | null
        weather_main?: string | null
        weather_description?: string | null
        wind_speed?: number | null
        visibility?: number | null
        created_at?: string | null
        updated_at?: string | null
      }
      Update: {
        id?: string
        location_name?: string
        latitude?: number
        longitude?: number
        date?: string
        temperature?: number | null
        humidity?: number | null
        weather_main?: string | null
        weather_description?: string | null
        wind_speed?: number | null
        visibility?: number | null
        created_at?: string | null
        updated_at?: string | null
      }
    }
    product_schedules: {
      Row: {
        id: string
        product_id: string
        day_number: number
        start_time: string | null
        end_time: string | null
        duration_minutes: number | null
        is_break: boolean | null
        is_meal: boolean | null
        is_transport: boolean | null
        created_at: string | null
        updated_at: string | null
        latitude: number | null
        longitude: number | null
        google_maps_link: string | null
        show_to_customers: boolean | null
        title_ko: string | null
        title_en: string | null
        description_ko: string | null
        description_en: string | null
        location_ko: string | null
        location_en: string | null
        guide_notes_ko: string | null
        guide_notes_en: string | null
        is_tour: boolean | null
        thumbnail_url: string | null
        order_index: number | null
        two_guide_schedule: string | null
        guide_driver_schedule: string | null
      }
      Insert: {
        id?: string
        product_id: string
        day_number: number
        start_time?: string | null
        end_time?: string | null
        duration_minutes?: number | null
        is_break?: boolean | null
        is_meal?: boolean | null
        is_transport?: boolean | null
        created_at?: string | null
        updated_at?: string | null
        latitude?: number | null
        longitude?: number | null
        google_maps_link?: string | null
        show_to_customers?: boolean | null
        title_ko?: string | null
        title_en?: string | null
        description_ko?: string | null
        description_en?: string | null
        location_ko?: string | null
        location_en?: string | null
        guide_notes_ko?: string | null
        guide_notes_en?: string | null
        is_tour?: boolean | null
        thumbnail_url?: string | null
        order_index?: number | null
        two_guide_schedule?: string | null
        guide_driver_schedule?: string | null
      }
      Update: {
        id?: string
        product_id?: string
        day_number?: number
        start_time?: string | null
        end_time?: string | null
        duration_minutes?: number | null
        is_break?: boolean | null
        is_meal?: boolean | null
        is_transport?: boolean | null
        created_at?: string | null
        updated_at?: string | null
        latitude?: number | null
        longitude?: number | null
        google_maps_link?: string | null
        show_to_customers?: boolean | null
        title_ko?: string | null
        title_en?: string | null
        description_ko?: string | null
        description_en?: string | null
        location_ko?: string | null
        location_en?: string | null
        guide_notes_ko?: string | null
        guide_notes_en?: string | null
        is_tour?: boolean | null
        thumbnail_url?: string | null
        order_index?: number | null
        two_guide_schedule?: string | null
        guide_driver_schedule?: string | null
      }
      tour_attractions: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          description_ko: string | null
          description_en: string | null
          location: string | null
          coordinates: unknown | null
          category: string | null
          visit_duration: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          description_ko?: string | null
          description_en?: string | null
          location?: string | null
          coordinates?: unknown | null
          category?: string | null
          visit_duration?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          description_ko?: string | null
          description_en?: string | null
          location?: string | null
          coordinates?: unknown | null
          category?: string | null
          visit_duration?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_material_categories: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          description_ko: string | null
          description_en: string | null
          icon: string | null
          color: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          description_ko?: string | null
          description_en?: string | null
          icon?: string | null
          color?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          description_ko?: string | null
          description_en?: string | null
          icon?: string | null
          color?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_materials: {
        Row: {
          id: string
          title: string
          description: string | null
          attraction_id: string | null
          category_id: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          mime_type: string
          duration: number | null
          language: string | null
          tags: string[] | null
          is_active: boolean | null
          is_public: boolean | null
          created_by: string | null
          updated_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          attraction_id?: string | null
          category_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          mime_type: string
          duration?: number | null
          language?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          is_public?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          attraction_id?: string | null
          category_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          mime_type?: string
          duration?: number | null
          language?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          is_public?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      guide_quizzes: {
        Row: {
          id: string
          title: string
          description: string | null
          attraction_id: string | null
          question: string
          options: unknown
          correct_answer: number
          explanation: string | null
          difficulty: string | null
          language: string | null
          tags: string[] | null
          is_active: boolean | null
          created_by: string | null
          updated_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          attraction_id?: string | null
          question: string
          options: unknown
          correct_answer: number
          explanation?: string | null
          difficulty?: string | null
          language?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          attraction_id?: string | null
          question?: string
          options?: unknown
          correct_answer?: number
          explanation?: string | null
          difficulty?: string | null
          language?: string | null
          tags?: string[] | null
          is_active?: boolean | null
          created_by?: string | null
          updated_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      guide_quiz_results: {
        Row: {
          id: string
          quiz_id: string | null
          user_id: string | null
          selected_answer: number
          is_correct: boolean
          time_taken: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          quiz_id?: string | null
          user_id?: string | null
          selected_answer: number
          is_correct: boolean
          time_taken?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          quiz_id?: string | null
          user_id?: string | null
          selected_answer?: number
          is_correct?: boolean
          time_taken?: number | null
          created_at?: string | null
        }
      }
      tour_course_categories: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          description_ko: string | null
          description_en: string | null
          color: string | null
          icon: string | null
          sort_order: number | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          description_ko?: string | null
          description_en?: string | null
          color?: string | null
          icon?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          description_ko?: string | null
          description_en?: string | null
          color?: string | null
          icon?: string | null
          sort_order?: number | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_course_photos: {
        Row: {
          id: string
          course_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          mime_type: string
          thumbnail_url: string | null
          is_primary: boolean | null
          sort_order: number | null
          uploaded_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          mime_type: string
          thumbnail_url?: string | null
          is_primary?: boolean | null
          sort_order?: number | null
          uploaded_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          mime_type?: string
          thumbnail_url?: string | null
          is_primary?: boolean | null
          sort_order?: number | null
          uploaded_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_course_points: {
        Row: {
          id: string
          course_id: string
          point_name: string
          location: string | null
          latitude: number | null
          longitude: number | null
          description_ko: string | null
          description_en: string | null
          visit_duration: number | null
          sort_order: number | null
          is_active: boolean | null
          google_maps_url: string | null
          place_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          course_id: string
          point_name: string
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          description_ko?: string | null
          description_en?: string | null
          visit_duration?: number | null
          sort_order?: number | null
          is_active?: boolean | null
          google_maps_url?: string | null
          place_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          course_id?: string
          point_name?: string
          location?: string | null
          latitude?: number | null
          longitude?: number | null
          description_ko?: string | null
          description_en?: string | null
          visit_duration?: number | null
          sort_order?: number | null
          is_active?: boolean | null
          google_maps_url?: string | null
          place_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      tour_courses: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          description_ko: string | null
          description_en: string | null
          category_id: string | null
          point_name: string | null
          location: string | null
          start_latitude: number | null
          start_longitude: number | null
          end_latitude: number | null
          end_longitude: number | null
          internal_note: string | null
          google_maps_url: string | null
          place_id: string | null
          start_google_maps_url: string | null
          start_place_id: string | null
          end_google_maps_url: string | null
          end_place_id: string | null
          duration_hours: number
          difficulty_level: 'easy' | 'medium' | 'hard'
          max_participants: number
          min_participants: number
          price_adult: number | null
          price_child: number | null
          price_infant: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          description_ko?: string | null
          description_en?: string | null
          category_id?: string | null
          point_name?: string | null
          location?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          internal_note?: string | null
          google_maps_url?: string | null
          place_id?: string | null
          start_google_maps_url?: string | null
          start_place_id?: string | null
          end_google_maps_url?: string | null
          end_place_id?: string | null
          duration_hours: number
          difficulty_level: 'easy' | 'medium' | 'hard'
          max_participants: number
          min_participants: number
          price_adult?: number | null
          price_child?: number | null
          price_infant?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          description_ko?: string | null
          description_en?: string | null
          category_id?: string | null
          point_name?: string | null
          location?: string | null
          start_latitude?: number | null
          start_longitude?: number | null
          end_latitude?: number | null
          end_longitude?: number | null
          internal_note?: string | null
          google_maps_url?: string | null
          place_id?: string | null
          start_google_maps_url?: string | null
          start_place_id?: string | null
          end_google_maps_url?: string | null
          end_place_id?: string | null
          duration_hours?: number
          difficulty_level?: 'easy' | 'medium' | 'hard'
          max_participants?: number
          min_participants?: number
          price_adult?: number | null
          price_child?: number | null
          price_infant?: number | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      reservation_options: {
        Row: {
          id: string
          reservation_id: string
          option_id: string
          ea: number
          price: number
          total_price: number
          status: string
          note: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          reservation_id: string
          option_id: string
          ea?: number
          price?: number
          total_price?: number
          status?: string
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          reservation_id?: string
          option_id?: string
          ea?: number
          price?: number
          total_price?: number
          status?: string
          note?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      choice_combinations: {
        Row: {
          id: string
          product_id: string
          pricing_rule_id: string
          combination_key: string
          combination_name: string
          combination_name_ko: string | null
          adult_price: number
          child_price: number
          infant_price: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          product_id: string
          pricing_rule_id: string
          combination_key: string
          combination_name: string
          combination_name_ko?: string | null
          adult_price?: number
          child_price?: number
          infant_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          pricing_rule_id?: string
          combination_key?: string
          combination_name?: string
          combination_name_ko?: string | null
          adult_price?: number
          child_price?: number
          infant_price?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      document_templates: {
        Row: {
          id: string
          template_key: string
          language: string
          name: string
          subject: string | null
          content: string
          format: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          template_key: string
          language?: string
          name: string
          subject?: string | null
          content: string
          format?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          template_key?: string
          language?: string
          name?: string
          subject?: string | null
          content?: string
          format?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    CompositeTypes: {
      [key: string]: Record<string, unknown>
    }
  }
}
