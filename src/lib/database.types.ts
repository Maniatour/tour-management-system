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
          name_ko: string
          name_en: string | null
          internal_name_ko: string
          internal_name_en: string
          customer_name_ko: string
          customer_name_en: string
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
          internal_name_ko: string
          internal_name_en: string
          customer_name_ko: string
          customer_name_en: string
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
          internal_name_ko?: string
          internal_name_en?: string
          customer_name_ko?: string
          customer_name_en?: string
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
          description_ko: string | null
          description_en: string | null
          address: string
          pin: string | null
          link: string | null
          media: string[] | null
          is_active: boolean | null
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
          media?: string[] | null
          is_active?: boolean | null
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
          media?: string[] | null
          is_active?: boolean | null
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
        title: string
        title_ko: string | null
        title_en: string | null
        description: string | null
        description_ko: string | null
        description_en: string | null
        location: string | null
        location_ko: string | null
        location_en: string | null
        duration_minutes: number | null
        is_break: boolean
        is_meal: boolean
        is_transport: boolean
        is_tour: boolean
        transport_type: string | null
        transport_details: string | null
        transport_details_ko: string | null
        transport_details_en: string | null
        notes: string | null
        notes_ko: string | null
        notes_en: string | null
        guide_notes_ko: string | null
        guide_notes_en: string | null
        show_to_customers: boolean
        guide_assignment_type: string
        two_guide_schedule: string | null
        guide_driver_schedule: string | null
        latitude: number | null
        longitude: number | null
        thumbnail_url: string | null
        order_index: number
        created_at: string
        updated_at: string
      }
      Insert: {
        id?: string
        product_id: string
        day_number: number
        start_time?: string | null
        end_time?: string | null
        title: string
        title_ko?: string | null
        title_en?: string | null
        description?: string | null
        description_ko?: string | null
        description_en?: string | null
        location?: string | null
        location_ko?: string | null
        location_en?: string | null
        duration_minutes?: number | null
        is_break?: boolean
        is_meal?: boolean
        is_transport?: boolean
        is_tour?: boolean
        transport_type?: string | null
        transport_details?: string | null
        transport_details_ko?: string | null
        transport_details_en?: string | null
        notes?: string | null
        notes_ko?: string | null
        notes_en?: string | null
        guide_notes_ko?: string | null
        guide_notes_en?: string | null
        show_to_customers?: boolean
        guide_assignment_type?: string
        two_guide_schedule?: string | null
        guide_driver_schedule?: string | null
        latitude?: number | null
        longitude?: number | null
        thumbnail_url?: string | null
        order_index?: number
        created_at?: string
        updated_at?: string
      }
      Update: {
        id?: string
        product_id?: string
        day_number?: number
        start_time?: string | null
        end_time?: string | null
        title?: string
        title_ko?: string | null
        title_en?: string | null
        description?: string | null
        description_ko?: string | null
        description_en?: string | null
        location?: string | null
        location_ko?: string | null
        location_en?: string | null
        duration_minutes?: number | null
        is_break?: boolean
        is_meal?: boolean
        is_transport?: boolean
        is_tour?: boolean
        transport_type?: string | null
        transport_details?: string | null
        transport_details_ko?: string | null
        transport_details_en?: string | null
        notes?: string | null
        notes_ko?: string | null
        notes_en?: string | null
        guide_notes_ko?: string | null
        guide_notes_en?: string | null
        show_to_customers?: boolean
        guide_assignment_type?: string
        two_guide_schedule?: string | null
        guide_driver_schedule?: string | null
        latitude?: number | null
        longitude?: number | null
        thumbnail_url?: string | null
        order_index?: number
        created_at?: string
        updated_at?: string
      }
    }
    CompositeTypes: {
      [key: string]: Record<string, unknown>
    }
  }
}
