export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          check_in_time: string | null
          check_out_time: string | null
          created_at: string
          date: string
          employee_email: string
          id: string
          notes: string | null
          session_number: number
          status: string | null
          updated_at: string
          work_hours: number | null
        }
        Insert: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date: string
          employee_email: string
          id?: string
          notes?: string | null
          session_number?: number
          status?: string | null
          updated_at?: string
          work_hours?: number | null
        }
        Update: {
          check_in_time?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          employee_email?: string
          id?: string
          notes?: string | null
          session_number?: number
          status?: string | null
          updated_at?: string
          work_hours?: number | null
        }
        Relationships: []
      }
      attraction_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      attraction_category_relations: {
        Row: {
          attraction_id: string
          category_id: string
        }
        Insert: {
          attraction_id: string
          category_id: string
        }
        Update: {
          attraction_id?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attraction_category_relations_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attraction_category_relations_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "attraction_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      attraction_connections: {
        Row: {
          connection_type: string
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          difficulty_level: string | null
          distance_km: number | null
          duration_minutes: number | null
          from_attraction_id: string
          id: string
          internal_note: string | null
          is_active: boolean | null
          name_en: string | null
          name_ko: string | null
          to_attraction_id: string
          updated_at: string | null
        }
        Insert: {
          connection_type: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          from_attraction_id: string
          id?: string
          internal_note?: string | null
          is_active?: boolean | null
          name_en?: string | null
          name_ko?: string | null
          to_attraction_id: string
          updated_at?: string | null
        }
        Update: {
          connection_type?: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          from_attraction_id?: string
          id?: string
          internal_note?: string | null
          is_active?: boolean | null
          name_en?: string | null
          name_ko?: string | null
          to_attraction_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attraction_connections_from_attraction_id_fkey"
            columns: ["from_attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attraction_connections_to_attraction_id_fkey"
            columns: ["to_attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
        ]
      }
      attraction_photos: {
        Row: {
          attraction_id: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_primary: boolean | null
          mime_type: string
          sort_order: number | null
          thumbnail_url: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          attraction_id: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_primary?: boolean | null
          mime_type: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          attraction_id?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_primary?: boolean | null
          mime_type?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attraction_photos_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
        ]
      }
      attractions: {
        Row: {
          admission_fee_adult: number | null
          admission_fee_child: number | null
          admission_fee_infant: number | null
          created_at: string | null
          customer_description_en: string | null
          customer_description_ko: string | null
          customer_name_en: string
          customer_name_ko: string
          google_maps_url: string | null
          id: string
          internal_note: string | null
          is_active: boolean | null
          latitude: number | null
          level: number
          location: string | null
          longitude: number | null
          parent_id: string | null
          path: string | null
          place_id: string | null
          product_id: string
          sort_order: number | null
          team_description_en: string | null
          team_description_ko: string | null
          team_name_en: string
          team_name_ko: string
          updated_at: string | null
          visit_duration: number | null
        }
        Insert: {
          admission_fee_adult?: number | null
          admission_fee_child?: number | null
          admission_fee_infant?: number | null
          created_at?: string | null
          customer_description_en?: string | null
          customer_description_ko?: string | null
          customer_name_en: string
          customer_name_ko: string
          google_maps_url?: string | null
          id?: string
          internal_note?: string | null
          is_active?: boolean | null
          latitude?: number | null
          level?: number
          location?: string | null
          longitude?: number | null
          parent_id?: string | null
          path?: string | null
          place_id?: string | null
          product_id: string
          sort_order?: number | null
          team_description_en?: string | null
          team_description_ko?: string | null
          team_name_en: string
          team_name_ko: string
          updated_at?: string | null
          visit_duration?: number | null
        }
        Update: {
          admission_fee_adult?: number | null
          admission_fee_child?: number | null
          admission_fee_infant?: number | null
          created_at?: string | null
          customer_description_en?: string | null
          customer_description_ko?: string | null
          customer_name_en?: string
          customer_name_ko?: string
          google_maps_url?: string | null
          id?: string
          internal_note?: string | null
          is_active?: boolean | null
          latitude?: number | null
          level?: number
          location?: string | null
          longitude?: number | null
          parent_id?: string | null
          path?: string | null
          place_id?: string | null
          product_id?: string
          sort_order?: number | null
          team_description_en?: string | null
          team_description_ko?: string | null
          team_name_en?: string
          team_name_ko?: string
          updated_at?: string | null
          visit_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "attractions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          changed_fields: string[] | null
          created_at: string | null
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string
          table_name: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id: string
          table_name: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string
          table_name?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      booking_history: {
        Row: {
          action: string
          booking_id: string
          booking_type: string
          changed_at: string | null
          changed_by: string
          id: string
          new_values: Json | null
          old_values: Json | null
          reason: string | null
        }
        Insert: {
          action: string
          booking_id: string
          booking_type: string
          changed_at?: string | null
          changed_by: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Update: {
          action?: string
          booking_id?: string
          booking_type?: string
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
        }
        Relationships: []
      }
      cash_transaction_history: {
        Row: {
          amount: number | null
          category: string | null
          change_type: string
          description: string | null
          id: string
          modified_at: string
          modified_by: string
          new_values: Json | null
          notes: string | null
          old_values: Json | null
          source_table: string
          transaction_date: string | null
          transaction_id: string
          transaction_type: string | null
        }
        Insert: {
          amount?: number | null
          category?: string | null
          change_type: string
          description?: string | null
          id?: string
          modified_at?: string
          modified_by: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          source_table: string
          transaction_date?: string | null
          transaction_id: string
          transaction_type?: string | null
        }
        Update: {
          amount?: number | null
          category?: string | null
          change_type?: string
          description?: string | null
          id?: string
          modified_at?: string
          modified_by?: string
          new_values?: Json | null
          notes?: string | null
          old_values?: Json | null
          source_table?: string
          transaction_date?: string | null
          transaction_id?: string
          transaction_type?: string | null
        }
        Relationships: []
      }
      cash_transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          notes: string | null
          reference_id: string | null
          reference_type: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          notes?: string | null
          reference_id?: string | null
          reference_type?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      channel_products: {
        Row: {
          channel_id: string
          created_at: string | null
          id: string
          is_active: boolean | null
          product_id: string
          updated_at: string | null
          variant_description_en: string | null
          variant_description_ko: string | null
          variant_key: string
          variant_name_en: string | null
          variant_name_ko: string | null
        }
        Insert: {
          channel_id: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product_id: string
          updated_at?: string | null
          variant_description_en?: string | null
          variant_description_ko?: string | null
          variant_key?: string
          variant_name_en?: string | null
          variant_name_ko?: string | null
        }
        Update: {
          channel_id?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          product_id?: string
          updated_at?: string | null
          variant_description_en?: string | null
          variant_description_ko?: string | null
          variant_key?: string
          variant_name_en?: string | null
          variant_name_ko?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_products_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_products_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "channel_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          admin_website: string | null
          base_price: number | null
          category: string
          commission: number | null
          commission_adult_only: boolean | null
          commission_base_price_only: boolean | null
          commission_percent: number | null
          contract_url: string | null
          created_at: string | null
          customer_website: string | null
          description: string | null
          favicon_url: string | null
          has_not_included_price: boolean | null
          id: string
          manager_contact: string | null
          manager_name: string | null
          markup: number | null
          name: string
          not_included_price: number | null
          not_included_type: string | null
          pricing_type: string | null
          status: string | null
          sub_channels: string[] | null
          type: string | null
          website: string | null
        }
        Insert: {
          admin_website?: string | null
          base_price?: number | null
          category?: string
          commission?: number | null
          commission_adult_only?: boolean | null
          commission_base_price_only?: boolean | null
          commission_percent?: number | null
          contract_url?: string | null
          created_at?: string | null
          customer_website?: string | null
          description?: string | null
          favicon_url?: string | null
          has_not_included_price?: boolean | null
          id?: string
          manager_contact?: string | null
          manager_name?: string | null
          markup?: number | null
          name: string
          not_included_price?: number | null
          not_included_type?: string | null
          pricing_type?: string | null
          status?: string | null
          sub_channels?: string[] | null
          type?: string | null
          website?: string | null
        }
        Update: {
          admin_website?: string | null
          base_price?: number | null
          category?: string
          commission?: number | null
          commission_adult_only?: boolean | null
          commission_base_price_only?: boolean | null
          commission_percent?: number | null
          contract_url?: string | null
          created_at?: string | null
          customer_website?: string | null
          description?: string | null
          favicon_url?: string | null
          has_not_included_price?: boolean | null
          id?: string
          manager_contact?: string | null
          manager_name?: string | null
          markup?: number | null
          name?: string
          not_included_price?: number | null
          not_included_type?: string | null
          pricing_type?: string | null
          status?: string | null
          sub_channels?: string[] | null
          type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      chat_announcement_templates: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          language: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          language?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          language?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      chat_bans: {
        Row: {
          banned_by: string
          banned_until: string | null
          client_id: string | null
          created_at: string
          customer_name: string | null
          id: string
          reason: string | null
          room_id: string
          updated_at: string
        }
        Insert: {
          banned_by: string
          banned_until?: string | null
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          reason?: string | null
          room_id: string
          updated_at?: string
        }
        Update: {
          banned_by?: string
          banned_until?: string | null
          client_id?: string | null
          created_at?: string
          customer_name?: string | null
          id?: string
          reason?: string | null
          room_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_bans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_url: string | null
          id: string
          is_read: boolean | null
          message: string
          message_type: string | null
          room_id: string
          sender_email: string | null
          sender_name: string
          sender_type: string
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          message_type?: string | null
          room_id: string
          sender_email?: string | null
          sender_name: string
          sender_type: string
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_url?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          message_type?: string | null
          room_id?: string
          sender_email?: string | null
          sender_name?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          id: string
          is_active: boolean | null
          joined_at: string | null
          last_read_at: string | null
          participant_id: string
          participant_name: string
          participant_type: string
          room_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          participant_id: string
          participant_name: string
          participant_type: string
          room_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          participant_id?: string
          participant_name?: string
          participant_type?: string
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          language: string
          room_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          language?: string
          room_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          language?: string
          room_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_announcements_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          is_active: boolean | null
          room_code: string
          room_name: string
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          room_code: string
          room_name: string
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          is_active?: boolean | null
          room_code?: string
          room_name?: string
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_rooms_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      choice_options: {
        Row: {
          adult_price: number | null
          capacity: number | null
          child_price: number | null
          choice_id: string | null
          created_at: string | null
          description: string | null
          description_ko: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          infant_price: number | null
          is_active: boolean | null
          is_default: boolean | null
          option_key: string
          option_name: string
          option_name_ko: string
          sort_order: number | null
          thumbnail_url: string | null
        }
        Insert: {
          adult_price?: number | null
          capacity?: number | null
          child_price?: number | null
          choice_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ko?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          infant_price?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          option_key: string
          option_name: string
          option_name_ko: string
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Update: {
          adult_price?: number | null
          capacity?: number | null
          child_price?: number | null
          choice_id?: string | null
          created_at?: string | null
          description?: string | null
          description_ko?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          infant_price?: number | null
          is_active?: boolean | null
          is_default?: boolean | null
          option_key?: string
          option_name?: string
          option_name_ko?: string
          sort_order?: number | null
          thumbnail_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "choice_options_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "product_choices"
            referencedColumns: ["id"]
          },
        ]
      }
      company_expenses: {
        Row: {
          accounting_period: string | null
          amount: number | null
          approved_by: string | null
          approved_on: string | null
          attachments: string[] | null
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expense_type: string | null
          id: string
          maintenance_type: string | null
          notes: string | null
          paid_by: string | null
          paid_for: string | null
          paid_for_label_id: string | null
          reimbursement_note: string | null
          reimbursed_amount: number
          reimbursed_on: string | null
          reimbursement_outstanding: number
          standard_paid_for: string | null
          paid_on: string | null
          paid_to: string | null
          payment_method: string | null
          photo_url: string | null
          status: string | null
          subcategory: string | null
          submit_by: string | null
          submit_on: string | null
          tax_deductible: boolean | null
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string | null
        }
        Insert: {
          accounting_period?: string | null
          amount?: number | null
          approved_by?: string | null
          approved_on?: string | null
          attachments?: string[] | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          maintenance_type?: string | null
          notes?: string | null
          paid_by?: string | null
          paid_for?: string | null
          paid_for_label_id?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          standard_paid_for?: string | null
          paid_on?: string | null
          paid_to?: string | null
          payment_method?: string | null
          photo_url?: string | null
          status?: string | null
          subcategory?: string | null
          submit_by?: string | null
          submit_on?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Update: {
          accounting_period?: string | null
          amount?: number | null
          approved_by?: string | null
          approved_on?: string | null
          attachments?: string[] | null
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expense_type?: string | null
          id?: string
          maintenance_type?: string | null
          notes?: string | null
          paid_by?: string | null
          paid_for?: string | null
          paid_for_label_id?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          standard_paid_for?: string | null
          paid_on?: string | null
          paid_to?: string | null
          payment_method?: string | null
          photo_url?: string | null
          status?: string | null
          subcategory?: string | null
          submit_by?: string | null
          submit_on?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
        }
        Relationships: []
      }
      company_expense_paid_for_labels: {
        Row: {
          id: string
          code: string
          label_ko: string
          label_en: string | null
          links_vehicle_maintenance: boolean
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          label_ko: string
          label_en?: string | null
          links_vehicle_maintenance?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          label_ko?: string
          label_en?: string | null
          links_vehicle_maintenance?: boolean
          sort_order?: number
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_expense_vehicle_maintenance_links: {
        Row: {
          company_expense_id: string
          vehicle_maintenance_id: string
          created_at: string
        }
        Insert: {
          company_expense_id: string
          vehicle_maintenance_id: string
          created_at?: string
        }
        Update: {
          company_expense_id?: string
          vehicle_maintenance_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'company_expense_vehicle_maintenance_links_company_expense_id_fkey'
            columns: ['company_expense_id']
            isOneToOne: false
            referencedRelation: 'company_expenses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'company_expense_vehicle_maintenance_links_vehicle_maintenance_id_fkey'
            columns: ['vehicle_maintenance_id']
            isOneToOne: false
            referencedRelation: 'vehicle_maintenance'
            referencedColumns: ['id']
          }
        ]
      }
      consultation_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      consultation_logs: {
        Row: {
          agent_email: string | null
          agent_name: string | null
          agent_response: string | null
          channel_id: string | null
          consultation_type: string | null
          created_at: string | null
          customer_id: string | null
          customer_message: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          language: string | null
          product_id: string | null
          resolution: string | null
          started_at: string | null
          status: string | null
          templates_used: string[] | null
          updated_at: string | null
        }
        Insert: {
          agent_email?: string | null
          agent_name?: string | null
          agent_response?: string | null
          channel_id?: string | null
          consultation_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_message?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          language?: string | null
          product_id?: string | null
          resolution?: string | null
          started_at?: string | null
          status?: string | null
          templates_used?: string[] | null
          updated_at?: string | null
        }
        Update: {
          agent_email?: string | null
          agent_name?: string | null
          agent_response?: string | null
          channel_id?: string | null
          consultation_type?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_message?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          language?: string | null
          product_id?: string | null
          resolution?: string | null
          started_at?: string | null
          status?: string | null
          templates_used?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consultation_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_stats: {
        Row: {
          avg_duration_minutes: number | null
          avg_response_time_minutes: number | null
          channel_id: string | null
          created_at: string | null
          date: string
          id: string
          most_used_template_id: string | null
          product_id: string | null
          resolved_inquiries: number | null
          satisfaction_score: number | null
          template_usage_count: number | null
          total_inquiries: number | null
          updated_at: string | null
        }
        Insert: {
          avg_duration_minutes?: number | null
          avg_response_time_minutes?: number | null
          channel_id?: string | null
          created_at?: string | null
          date: string
          id?: string
          most_used_template_id?: string | null
          product_id?: string | null
          resolved_inquiries?: number | null
          satisfaction_score?: number | null
          template_usage_count?: number | null
          total_inquiries?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_duration_minutes?: number | null
          avg_response_time_minutes?: number | null
          channel_id?: string | null
          created_at?: string | null
          date?: string
          id?: string
          most_used_template_id?: string | null
          product_id?: string | null
          resolved_inquiries?: number | null
          satisfaction_score?: number | null
          template_usage_count?: number | null
          total_inquiries?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_stats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_stats_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_stats_most_used_template_id_fkey"
            columns: ["most_used_template_id"]
            isOneToOne: false
            referencedRelation: "consultation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consultation_stats_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_templates: {
        Row: {
          answer_en: string
          answer_ko: string
          category_id: string | null
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          is_active: boolean | null
          is_favorite: boolean | null
          last_used_at: string | null
          priority: number | null
          product_id: string | null
          question_en: string
          question_ko: string
          tags: string[] | null
          template_type: string | null
          updated_at: string | null
          updated_by: string | null
          usage_count: number | null
        }
        Insert: {
          answer_en: string
          answer_ko: string
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          last_used_at?: string | null
          priority?: number | null
          product_id?: string | null
          question_en: string
          question_ko: string
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Update: {
          answer_en?: string
          answer_ko?: string
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_active?: boolean | null
          is_favorite?: boolean | null
          last_used_at?: string | null
          priority?: number | null
          product_id?: string | null
          question_en?: string
          question_ko?: string
          tags?: string[] | null
          template_type?: string | null
          updated_at?: string | null
          updated_by?: string | null
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consultation_templates_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_workflow_executions: {
        Row: {
          completed_at: string | null
          consultation_log_id: string | null
          created_at: string | null
          current_step_id: string | null
          execution_data: Json | null
          execution_status: string | null
          id: string
          last_step_at: string | null
          started_at: string | null
          step_history: Json | null
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          completed_at?: string | null
          consultation_log_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          execution_data?: Json | null
          execution_status?: string | null
          id?: string
          last_step_at?: string | null
          started_at?: string | null
          step_history?: Json | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          completed_at?: string | null
          consultation_log_id?: string | null
          created_at?: string | null
          current_step_id?: string | null
          execution_data?: Json | null
          execution_status?: string | null
          id?: string
          last_step_at?: string | null
          started_at?: string | null
          step_history?: Json | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_workflow_executions_consultation_log_id_fkey"
            columns: ["consultation_log_id"]
            isOneToOne: false
            referencedRelation: "consultation_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_executions_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_executions_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_workflow_step_executions: {
        Row: {
          completed_at: string | null
          created_at: string | null
          duration_seconds: number | null
          error_message: string | null
          execution_id: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          started_at: string | null
          step_id: string | null
          step_result: string | null
          step_status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          step_id?: string | null
          step_result?: string | null
          step_status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          error_message?: string | null
          execution_id?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          started_at?: string | null
          step_id?: string | null
          step_result?: string | null
          step_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_workflow_step_executions_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_step_executions_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_workflow_steps: {
        Row: {
          action_type: string | null
          alternative_step_id: string | null
          condition_type: string | null
          condition_value: string | null
          created_at: string | null
          estimated_time: number | null
          group_id: string | null
          id: string
          images: Json | null
          is_active: boolean | null
          is_required: boolean | null
          links: Json | null
          next_step_id: string | null
          node_color: string | null
          node_shape: string | null
          notes_en: string | null
          notes_ko: string | null
          position: Json | null
          priority: string | null
          rich_description_en: string | null
          rich_description_ko: string | null
          step_description_en: string | null
          step_description_ko: string | null
          step_name_en: string
          step_name_ko: string
          step_order: number
          step_type: string | null
          tags: string[] | null
          template_id: string | null
          text_color: string | null
          timeout_minutes: number | null
          updated_at: string | null
          workflow_id: string | null
        }
        Insert: {
          action_type?: string | null
          alternative_step_id?: string | null
          condition_type?: string | null
          condition_value?: string | null
          created_at?: string | null
          estimated_time?: number | null
          group_id?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          is_required?: boolean | null
          links?: Json | null
          next_step_id?: string | null
          node_color?: string | null
          node_shape?: string | null
          notes_en?: string | null
          notes_ko?: string | null
          position?: Json | null
          priority?: string | null
          rich_description_en?: string | null
          rich_description_ko?: string | null
          step_description_en?: string | null
          step_description_ko?: string | null
          step_name_en: string
          step_name_ko: string
          step_order: number
          step_type?: string | null
          tags?: string[] | null
          template_id?: string | null
          text_color?: string | null
          timeout_minutes?: number | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Update: {
          action_type?: string | null
          alternative_step_id?: string | null
          condition_type?: string | null
          condition_value?: string | null
          created_at?: string | null
          estimated_time?: number | null
          group_id?: string | null
          id?: string
          images?: Json | null
          is_active?: boolean | null
          is_required?: boolean | null
          links?: Json | null
          next_step_id?: string | null
          node_color?: string | null
          node_shape?: string | null
          notes_en?: string | null
          notes_ko?: string | null
          position?: Json | null
          priority?: string | null
          rich_description_en?: string | null
          rich_description_ko?: string | null
          step_description_en?: string | null
          step_description_ko?: string | null
          step_name_en?: string
          step_name_ko?: string
          step_order?: number
          step_type?: string | null
          tags?: string[] | null
          template_id?: string | null
          text_color?: string | null
          timeout_minutes?: number | null
          updated_at?: string | null
          workflow_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_workflow_steps_alternative_step_id_fkey"
            columns: ["alternative_step_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_steps_next_step_id_fkey"
            columns: ["next_step_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "consultation_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "consultation_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_workflows: {
        Row: {
          category_id: string | null
          channel_id: string | null
          created_at: string | null
          created_by: string | null
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name_en: string
          name_ko: string
          product_id: string | null
          tags: string[] | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_en: string
          name_ko: string
          product_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          category_id?: string | null
          channel_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name_en?: string
          name_ko?: string
          product_id?: string | null
          tags?: string[] | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consultation_workflows_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "consultation_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflows_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_workflows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "consultation_workflows_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          channel_id: string | null
          coupon_code: string | null
          created_at: string | null
          description: string | null
          discount_type: string | null
          end_date: string | null
          fixed_value: number | null
          id: string
          percentage_value: number | null
          product_id: string | null
          start_date: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          channel_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          end_date?: string | null
          fixed_value?: number | null
          id?: string
          percentage_value?: number | null
          product_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          channel_id?: string | null
          coupon_code?: string | null
          created_at?: string | null
          description?: string | null
          discount_type?: string | null
          end_date?: string | null
          fixed_value?: number | null
          id?: string
          percentage_value?: number | null
          product_id?: string | null
          start_date?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "coupons_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          booking_count: number | null
          channel_id: string | null
          created_at: string | null
          email: string | null
          emergency_contact: string | null
          id: string
          id_photo_url: string | null
          language: string | null
          name: string
          pass_photo_url: string | null
          phone: string | null
          resident_status: string | null
          special_requests: string | null
          status: string | null
          sub_channel: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          booking_count?: number | null
          channel_id?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          id: string
          id_photo_url?: string | null
          language?: string | null
          name: string
          pass_photo_url?: string | null
          phone?: string | null
          resident_status?: string | null
          special_requests?: string | null
          status?: string | null
          sub_channel?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          booking_count?: number | null
          channel_id?: string | null
          created_at?: string | null
          email?: string | null
          emergency_contact?: string | null
          id?: string
          id_photo_url?: string | null
          language?: string | null
          name?: string
          pass_photo_url?: string | null
          phone?: string | null
          resident_status?: string | null
          special_requests?: string | null
          status?: string | null
          sub_channel?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_channel"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customers_channel"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      date_notes: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          note: string | null
          note_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          note_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          note?: string | null
          note_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      document_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      document_download_logs: {
        Row: {
          document_id: string | null
          downloaded_at: string | null
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          document_id?: string | null
          downloaded_at?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          document_id?: string | null
          downloaded_at?: string | null
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_download_logs_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_permissions: {
        Row: {
          document_id: string | null
          granted_at: string | null
          granted_by: string | null
          id: string
          permission_type: string
          user_id: string | null
        }
        Insert: {
          document_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type: string
          user_id?: string | null
        }
        Update: {
          document_id?: string | null
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          permission_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_permissions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_reminders: {
        Row: {
          created_at: string | null
          document_id: string | null
          error_message: string | null
          id: string
          reminder_date: string
          reminder_type: string
          sent_at: string | null
          sent_to_email: string | null
          sent_to_user_id: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          reminder_date: string
          reminder_type: string
          sent_at?: string | null
          sent_to_email?: string | null
          sent_to_user_id?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          document_id?: string | null
          error_message?: string | null
          id?: string
          reminder_date?: string
          reminder_type?: string
          sent_at?: string | null
          sent_to_email?: string | null
          sent_to_user_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "document_reminders_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_templates: {
        Row: {
          content: string
          created_at: string
          format: string
          id: string
          is_active: boolean
          language: string
          name: string
          subject: string | null
          template_key: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          language?: string
          name: string
          subject?: string | null
          template_key: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          format?: string
          id?: string
          is_active?: boolean
          language?: string
          name?: string
          subject?: string | null
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          auto_calculate_expiry: boolean | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          expiry_date: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          guide_email: string | null
          id: string
          issue_date: string | null
          mime_type: string
          reminder_30_days: boolean | null
          reminder_7_days: boolean | null
          reminder_expired: boolean | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
          validity_period_months: number | null
          version: string | null
        }
        Insert: {
          auto_calculate_expiry?: boolean | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          guide_email?: string | null
          id?: string
          issue_date?: string | null
          mime_type: string
          reminder_30_days?: boolean | null
          reminder_7_days?: boolean | null
          reminder_expired?: boolean | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
          validity_period_months?: number | null
          version?: string | null
        }
        Update: {
          auto_calculate_expiry?: boolean | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          expiry_date?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          guide_email?: string | null
          id?: string
          issue_date?: string | null
          mime_type?: string
          reminder_30_days?: boolean | null
          reminder_7_days?: boolean | null
          reminder_expired?: boolean | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
          validity_period_months?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "document_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_pricing: {
        Row: {
          additional_options_pricing: Json | null
          adult_price: number
          channel_id: string | null
          child_price: number
          choices_pricing: Json | null
          commission_percent: number | null
          coupon_percent: number | null
          created_at: string | null
          date: string
          exclusions_en: string | null
          exclusions_ko: string | null
          id: string
          inclusions_en: string | null
          inclusions_ko: string | null
          infant_price: number
          is_sale_available: boolean | null
          markup_amount: number | null
          markup_percent: number | null
          not_included_price: number | null
          options_pricing: Json | null
          price_adjustment_adult: number | null
          price_adjustment_child: number | null
          price_adjustment_infant: number | null
          price_calculation_method: string | null
          price_type: string
          product_id: string | null
          updated_at: string | null
          variant_key: string
        }
        Insert: {
          additional_options_pricing?: Json | null
          adult_price: number
          channel_id?: string | null
          child_price: number
          choices_pricing?: Json | null
          commission_percent?: number | null
          coupon_percent?: number | null
          created_at?: string | null
          date: string
          exclusions_en?: string | null
          exclusions_ko?: string | null
          id?: string
          inclusions_en?: string | null
          inclusions_ko?: string | null
          infant_price: number
          is_sale_available?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          not_included_price?: number | null
          options_pricing?: Json | null
          price_adjustment_adult?: number | null
          price_adjustment_child?: number | null
          price_adjustment_infant?: number | null
          price_calculation_method?: string | null
          price_type?: string
          product_id?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Update: {
          additional_options_pricing?: Json | null
          adult_price?: number
          channel_id?: string | null
          child_price?: number
          choices_pricing?: Json | null
          commission_percent?: number | null
          coupon_percent?: number | null
          created_at?: string | null
          date?: string
          exclusions_en?: string | null
          exclusions_ko?: string | null
          id?: string
          inclusions_en?: string | null
          inclusions_ko?: string | null
          infant_price?: number
          is_sale_available?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          not_included_price?: number | null
          options_pricing?: Json | null
          price_adjustment_adult?: number | null
          price_adjustment_child?: number | null
          price_adjustment_infant?: number | null
          price_calculation_method?: string | null
          price_type?: string
          product_id?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_pricing_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_pricing_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "dynamic_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      dynamic_pricing_backup: {
        Row: {
          adult_price: number | null
          channel_id: string | null
          child_price: number | null
          choices_pricing: Json | null
          commission_percent: number | null
          coupon_percent: number | null
          created_at: string | null
          date: string | null
          exclusions_en: string | null
          exclusions_ko: string | null
          id: string | null
          inclusions_en: string | null
          inclusions_ko: string | null
          infant_price: number | null
          is_sale_available: boolean | null
          markup_amount: number | null
          markup_percent: number | null
          not_included_price: number | null
          options_pricing: Json | null
          product_id: string | null
          updated_at: string | null
        }
        Insert: {
          adult_price?: number | null
          channel_id?: string | null
          child_price?: number | null
          choices_pricing?: Json | null
          commission_percent?: number | null
          coupon_percent?: number | null
          created_at?: string | null
          date?: string | null
          exclusions_en?: string | null
          exclusions_ko?: string | null
          id?: string | null
          inclusions_en?: string | null
          inclusions_ko?: string | null
          infant_price?: number | null
          is_sale_available?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          not_included_price?: number | null
          options_pricing?: Json | null
          product_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adult_price?: number | null
          channel_id?: string | null
          child_price?: number | null
          choices_pricing?: Json | null
          commission_percent?: number | null
          coupon_percent?: number | null
          created_at?: string | null
          date?: string | null
          exclusions_en?: string | null
          exclusions_ko?: string | null
          id?: string | null
          inclusions_en?: string | null
          inclusions_ko?: string | null
          infant_price?: number | null
          is_sale_available?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          not_included_price?: number | null
          options_pricing?: Json | null
          product_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          bounce_reason: string | null
          bounced_at: string | null
          clicked_at: string | null
          clicked_count: number | null
          created_at: string | null
          delivered_at: string | null
          email: string
          email_type: string
          error_message: string | null
          id: string
          opened_at: string | null
          opened_count: number | null
          resend_email_id: string | null
          reservation_id: string
          sent_at: string | null
          sent_by: string | null
          status: string
          subject: string
        }
        Insert: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          email: string
          email_type: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          opened_count?: number | null
          resend_email_id?: string | null
          reservation_id: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject: string
        }
        Update: {
          bounce_reason?: string | null
          bounced_at?: string | null
          clicked_at?: string | null
          clicked_count?: number | null
          created_at?: string | null
          delivered_at?: string | null
          email?: string
          email_type?: string
          error_message?: string | null
          id?: string
          opened_at?: string | null
          opened_count?: number | null
          resend_email_id?: string | null
          reservation_id?: string
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      estimates: {
        Row: {
          config_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          email_id: string | null
          estimate_data: Json
          estimate_date: string
          estimate_number: string
          id: string
          pdf_file_path: string | null
          pdf_url: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email_id?: string | null
          estimate_data?: Json
          estimate_date: string
          estimate_number: string
          id?: string
          pdf_file_path?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          email_id?: string | null
          estimate_data?: Json
          estimate_date?: string
          estimate_number?: string
          id?: string
          pdf_file_path?: string | null
          pdf_url?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estimates_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "tour_cost_calculator_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estimates_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_categories: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      expense_category_mappings: {
        Row: {
          created_at: string | null
          id: string
          last_matched_at: string | null
          match_count: number | null
          original_value: string
          source_table: string
          standard_category_id: string | null
          sub_category_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_matched_at?: string | null
          match_count?: number | null
          original_value: string
          source_table: string
          standard_category_id?: string | null
          sub_category_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_matched_at?: string | null
          match_count?: number | null
          original_value?: string
          source_table?: string
          standard_category_id?: string | null
          sub_category_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_category_mappings_standard_category_id_fkey"
            columns: ["standard_category_id"]
            isOneToOne: false
            referencedRelation: "expense_standard_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_category_mappings_sub_category_id_fkey"
            columns: ["sub_category_id"]
            isOneToOne: false
            referencedRelation: "expense_standard_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_normalization_mappings: {
        Row: {
          created_at: string | null
          id: string
          normalized_value: string
          original_value: string
          source_table: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          normalized_value: string
          original_value: string
          source_table: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          normalized_value?: string
          original_value?: string
          source_table?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      expense_standard_categories: {
        Row: {
          created_at: string | null
          deduction_limit_percent: number | null
          description: string | null
          display_order: number | null
          id: string
          irs_schedule_c_line: string | null
          is_active: boolean | null
          name: string
          name_ko: string | null
          parent_id: string | null
          tax_deductible: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          deduction_limit_percent?: number | null
          description?: string | null
          display_order?: number | null
          id: string
          irs_schedule_c_line?: string | null
          is_active?: boolean | null
          name: string
          name_ko?: string | null
          parent_id?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          deduction_limit_percent?: number | null
          description?: string | null
          display_order?: number | null
          id?: string
          irs_schedule_c_line?: string | null
          is_active?: boolean | null
          name?: string
          name_ko?: string | null
          parent_id?: string | null
          tax_deductible?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expense_standard_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "expense_standard_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_vendors: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      global_options: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          value: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          value?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          value?: string | null
        }
        Relationships: []
      }
      guide_cost_history: {
        Row: {
          action: string
          changed_at: string | null
          id: string
          new_assistant_fee: number | null
          new_driver_fee: number | null
          new_effective_from: string | null
          new_effective_to: string | null
          new_guide_fee: number | null
          old_assistant_fee: number | null
          old_driver_fee: number | null
          old_effective_from: string | null
          old_effective_to: string | null
          old_guide_fee: number | null
          product_guide_cost_id: string
        }
        Insert: {
          action: string
          changed_at?: string | null
          id?: string
          new_assistant_fee?: number | null
          new_driver_fee?: number | null
          new_effective_from?: string | null
          new_effective_to?: string | null
          new_guide_fee?: number | null
          old_assistant_fee?: number | null
          old_driver_fee?: number | null
          old_effective_from?: string | null
          old_effective_to?: string | null
          old_guide_fee?: number | null
          product_guide_cost_id: string
        }
        Update: {
          action?: string
          changed_at?: string | null
          id?: string
          new_assistant_fee?: number | null
          new_driver_fee?: number | null
          new_effective_from?: string | null
          new_effective_to?: string | null
          new_guide_fee?: number | null
          old_assistant_fee?: number | null
          old_driver_fee?: number | null
          old_effective_from?: string | null
          old_effective_to?: string | null
          old_guide_fee?: number | null
          product_guide_cost_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_cost_history_product_guide_cost_id_fkey"
            columns: ["product_guide_cost_id"]
            isOneToOne: false
            referencedRelation: "product_guide_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_cost_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          note?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      guide_quiz_results: {
        Row: {
          created_at: string | null
          id: string
          is_correct: boolean
          quiz_id: string | null
          selected_answer: number
          time_taken: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_correct: boolean
          quiz_id?: string | null
          selected_answer: number
          time_taken?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_correct?: boolean
          quiz_id?: string | null
          selected_answer?: number
          time_taken?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_quiz_results_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "guide_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_quizzes: {
        Row: {
          attraction_id: string | null
          correct_answer: number
          created_at: string | null
          created_by: string | null
          description: string | null
          difficulty: string | null
          explanation: string | null
          id: string
          is_active: boolean | null
          language: string | null
          options: Json
          question: string
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          attraction_id?: string | null
          correct_answer: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          options: Json
          question: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          attraction_id?: string | null
          correct_answer?: number
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          difficulty?: string | null
          explanation?: string | null
          id?: string
          is_active?: boolean | null
          language?: string | null
          options?: Json
          question?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_quizzes_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "tour_attractions"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          apply_discount: boolean | null
          apply_processing_fee: boolean | null
          apply_tax: boolean | null
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          discount: number
          discount_percent: number | null
          email_id: string | null
          exchange_rate: number | null
          id: string
          invoice_date: string
          invoice_number: string
          items: Json
          notes: string | null
          processing_fee: number
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subtotal: number
          tax: number
          tax_percent: number | null
          total: number
          updated_at: string | null
        }
        Insert: {
          apply_discount?: boolean | null
          apply_processing_fee?: boolean | null
          apply_tax?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          discount_percent?: number | null
          email_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_date: string
          invoice_number: string
          items?: Json
          notes?: string | null
          processing_fee?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subtotal?: number
          tax?: number
          tax_percent?: number | null
          total?: number
          updated_at?: string | null
        }
        Update: {
          apply_discount?: boolean | null
          apply_processing_fee?: boolean | null
          apply_tax?: boolean | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          discount?: number
          discount_percent?: number | null
          email_id?: string | null
          exchange_rate?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          items?: Json
          notes?: string | null
          processing_fee?: number
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subtotal?: number
          tax?: number
          tax_percent?: number | null
          total?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string
          project_id: string | null
          reported_by: string
          status: string
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          reported_by: string
          status?: string
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          project_id?: string | null
          reported_by?: string
          status?: string
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "issues_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      message_translations: {
        Row: {
          created_at: string | null
          id: string
          message_id: string
          message_text_hash: string | null
          source_language: string | null
          target_language: string
          translated_text: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: string
          message_text_hash?: string | null
          source_language?: string | null
          target_language: string
          translated_text: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: string
          message_text_hash?: string | null
          source_language?: string | null
          target_language?: string
          translated_text?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_translations_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_attendance_stats: {
        Row: {
          avg_work_hours_per_day: number
          complete_days: number
          created_at: string | null
          employee_email: string
          employee_name: string
          first_half_hours: number
          id: string
          month: string
          present_days: number
          second_half_hours: number
          total_days: number
          total_work_hours: number
          updated_at: string | null
        }
        Insert: {
          avg_work_hours_per_day?: number
          complete_days?: number
          created_at?: string | null
          employee_email: string
          employee_name: string
          first_half_hours?: number
          id?: string
          month: string
          present_days?: number
          second_half_hours?: number
          total_days?: number
          total_work_hours?: number
          updated_at?: string | null
        }
        Update: {
          avg_work_hours_per_day?: number
          complete_days?: number
          created_at?: string | null
          employee_email?: string
          employee_name?: string
          first_half_hours?: number
          id?: string
          month?: string
          present_days?: number
          second_half_hours?: number
          total_days?: number
          total_work_hours?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      off_schedules: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          off_date: string
          reason: string | null
          status: string
          team_email: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          off_date: string
          reason?: string | null
          status?: string
          team_email: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          off_date?: string
          reason?: string | null
          status?: string
          team_email?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "off_schedules_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["email"]
          },
        ]
      }
      op_todos: {
        Row: {
          assigned_to: string | null
          category: string
          completed: boolean
          completed_at: string | null
          created_at: string
          created_by: string
          department: string
          description: string | null
          due_date: string | null
          id: string
          scope: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by: string
          department?: string
          description?: string | null
          due_date?: string | null
          id?: string
          scope: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: string
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          created_by?: string
          department?: string
          description?: string | null
          due_date?: string | null
          id?: string
          scope?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      options: {
        Row: {
          adult_price: number
          category: string
          child_price: number
          choice_type: string | null
          created_at: string | null
          description: string | null
          description_en: string | null
          description_ko: string | null
          id: string
          image_alt: string | null
          image_order: number | null
          image_url: string | null
          infant_price: number
          is_choice_template: boolean | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string
          name_en: string | null
          name_ko: string | null
          price_type: string
          sort_order: number | null
          status: string | null
          tags: string[] | null
          template_group: string | null
          template_group_description_en: string | null
          template_group_description_ko: string | null
          template_group_ko: string | null
          thumbnail_url: string | null
        }
        Insert: {
          adult_price: number
          category: string
          child_price: number
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_ko?: string | null
          id: string
          image_alt?: string | null
          image_order?: number | null
          image_url?: string | null
          infant_price: number
          is_choice_template?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          name_en?: string | null
          name_ko?: string | null
          price_type: string
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_description_en?: string | null
          template_group_description_ko?: string | null
          template_group_ko?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          adult_price?: number
          category?: string
          child_price?: number
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          image_alt?: string | null
          image_order?: number | null
          image_url?: string | null
          infant_price?: number
          is_choice_template?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          name_en?: string | null
          name_ko?: string | null
          price_type?: string
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_description_en?: string | null
          template_group_description_ko?: string | null
          template_group_ko?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      partner_fund_transaction_history: {
        Row: {
          action_type: string
          changed_at: string | null
          changed_by: string
          id: string
          new_values: Json | null
          old_values: Json | null
          transaction_id: string
        }
        Insert: {
          action_type: string
          changed_at?: string | null
          changed_by: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          transaction_id: string
        }
        Update: {
          action_type?: string
          changed_at?: string | null
          changed_by?: string
          id?: string
          new_values?: Json | null
          old_values?: Json | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_fund_transaction_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "partner_fund_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_fund_transactions: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          description: string
          id: string
          notes: string | null
          partner: string
          transaction_date: string
          transaction_type: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          description: string
          id?: string
          notes?: string | null
          partner: string
          transaction_date?: string
          transaction_type: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          description?: string
          id?: string
          notes?: string | null
          partner?: string
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      partner_loan_payments: {
        Row: {
          amount: number
          created_at: string | null
          created_by: string
          id: string
          loan_id: string
          notes: string | null
          payment_date: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          created_by: string
          id?: string
          loan_id: string
          notes?: string | null
          payment_date: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          created_by?: string
          id?: string
          loan_id?: string
          notes?: string | null
          payment_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "partner_loans"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_loans: {
        Row: {
          created_at: string | null
          created_by: string
          current_balance: number
          due_date: string | null
          id: string
          initial_amount: number
          interest_rate: number | null
          lender: string | null
          loan_name: string
          notes: string | null
          partner: string
          start_date: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          current_balance: number
          due_date?: string | null
          id?: string
          initial_amount: number
          interest_rate?: number | null
          lender?: string | null
          loan_name: string
          notes?: string | null
          partner: string
          start_date: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          current_balance?: number
          due_date?: string | null
          id?: string
          initial_amount?: number
          interest_rate?: number | null
          lender?: string | null
          loan_name?: string
          notes?: string | null
          partner?: string
          start_date?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          assigned_date: string | null
          card_holder_name: string | null
          card_number_last4: string | null
          card_type: string | null
          created_at: string | null
          created_by: string | null
          current_day_usage: number | null
          current_month_usage: number | null
          daily_limit: number | null
          display_name: string | null
          expiry_date: string | null
          id: string
          last_used_date: string | null
          limit_amount: number | null
          method: string
          method_type: string
          monthly_limit: number | null
          notes: string | null
          status: string | null
          updated_at: string | null
          updated_by: string | null
          user_email: string | null
        }
        Insert: {
          assigned_date?: string | null
          card_holder_name?: string | null
          card_number_last4?: string | null
          card_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_day_usage?: number | null
          current_month_usage?: number | null
          daily_limit?: number | null
          display_name?: string | null
          expiry_date?: string | null
          id: string
          last_used_date?: string | null
          limit_amount?: number | null
          method: string
          method_type?: string
          monthly_limit?: number | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_email?: string | null
        }
        Update: {
          assigned_date?: string | null
          card_holder_name?: string | null
          card_number_last4?: string | null
          card_type?: string | null
          created_at?: string | null
          created_by?: string | null
          current_day_usage?: number | null
          current_month_usage?: number | null
          daily_limit?: number | null
          display_name?: string | null
          expiry_date?: string | null
          id?: string
          last_used_date?: string | null
          limit_amount?: number | null
          method?: string
          method_type?: string
          monthly_limit?: number | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_email?: string | null
        }
        Relationships: []
      }
      payment_records: {
        Row: {
          amount: number | null
          amount_krw: number | null
          confirmed_by: string | null
          confirmed_on: string | null
          created_at: string | null
          id: string
          image_file_url: string | null
          note: string | null
          payment_method: string | null
          payment_status: string | null
          reservation_id: string
          submit_by: string | null
          submit_on: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          amount_krw?: number | null
          confirmed_by?: string | null
          confirmed_on?: string | null
          created_at?: string | null
          id?: string
          image_file_url?: string | null
          note?: string | null
          payment_method?: string | null
          payment_status?: string | null
          reservation_id: string
          submit_by?: string | null
          submit_on?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          amount_krw?: number | null
          confirmed_by?: string | null
          confirmed_on?: string | null
          created_at?: string | null
          id?: string
          image_file_url?: string | null
          note?: string | null
          payment_method?: string | null
          payment_status?: string | null
          reservation_id?: string
          submit_by?: string | null
          submit_on?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_records_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_records_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pickup_hotels: {
        Row: {
          address: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          group_number: number | null
          hotel: string
          id: string
          is_active: boolean | null
          link: string | null
          media: string[] | null
          pick_up_location: string
          pin: string | null
          updated_at: string | null
          youtube_link: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          group_number?: number | null
          hotel: string
          id?: string
          is_active?: boolean | null
          link?: string | null
          media?: string[] | null
          pick_up_location: string
          pin?: string | null
          updated_at?: string | null
          youtube_link?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          group_number?: number | null
          hotel?: string
          id?: string
          is_active?: boolean | null
          link?: string | null
          media?: string[] | null
          pick_up_location?: string
          pin?: string | null
          updated_at?: string | null
          youtube_link?: string | null
        }
        Relationships: []
      }
      employee_hourly_rate_periods: {
        Row: {
          id: string
          employee_email: string
          hourly_rate: number
          effective_from: string
          effective_to: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_email: string
          hourly_rate: number
          effective_from: string
          effective_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_email?: string
          hourly_rate?: number
          effective_from?: string
          effective_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'employee_hourly_rate_periods_employee_email_fkey'
            columns: ['employee_email']
            isOneToOne: false
            referencedRelation: 'team'
            referencedColumns: ['email']
          },
        ]
      }
      position_hourly_rate_periods: {
        Row: {
          id: string
          position_key: string
          hourly_rate: number
          effective_from: string
          effective_to: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          position_key: string
          hourly_rate: number
          effective_from: string
          effective_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          position_key?: string
          hourly_rate?: number
          effective_from?: string
          effective_to?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_choices: {
        Row: {
          choice_group: string
          choice_group_en: string | null
          choice_group_key: string | null
          choice_group_ko: string
          choice_type: string
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          product_id: string | null
          sort_order: number | null
        }
        Insert: {
          choice_group: string
          choice_group_en?: string | null
          choice_group_key?: string | null
          choice_group_ko: string
          choice_type?: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          product_id?: string | null
          sort_order?: number | null
        }
        Update: {
          choice_group?: string
          choice_group_en?: string | null
          choice_group_key?: string | null
          choice_group_ko?: string
          choice_type?: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          product_id?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_choices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_choices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_details: {
        Row: {
          cancellation_policy: string | null
          chat_announcement: string | null
          companion_info: string | null
          created_at: string | null
          description: string | null
          exclusive_booking_info: string | null
          id: string
          included: string | null
          luggage_info: string | null
          not_included: string | null
          pickup_drop_info: string | null
          preparation_info: string | null
          product_id: string
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          small_group_info: string | null
          tour_operation_info: string | null
          updated_at: string | null
        }
        Insert: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          companion_info?: string | null
          created_at?: string | null
          description?: string | null
          exclusive_booking_info?: string | null
          id?: string
          included?: string | null
          luggage_info?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          product_id: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Update: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          companion_info?: string | null
          created_at?: string | null
          description?: string | null
          exclusive_booking_info?: string | null
          id?: string
          included?: string | null
          luggage_info?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          product_id?: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_details_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_details_common: {
        Row: {
          cancellation_policy: string | null
          chat_announcement: string | null
          companion_info: string | null
          created_at: string | null
          description: string | null
          exclusive_booking_info: string | null
          id: string
          included: string | null
          luggage_info: string | null
          not_included: string | null
          pickup_drop_info: string | null
          preparation_info: string | null
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          small_group_info: string | null
          sub_category: string
          tour_operation_info: string | null
          updated_at: string | null
        }
        Insert: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          companion_info?: string | null
          created_at?: string | null
          description?: string | null
          exclusive_booking_info?: string | null
          id?: string
          included?: string | null
          luggage_info?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          sub_category: string
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Update: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          companion_info?: string | null
          created_at?: string | null
          description?: string | null
          exclusive_booking_info?: string | null
          id?: string
          included?: string | null
          luggage_info?: string | null
          not_included?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          sub_category?: string
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_details_common_multilingual: {
        Row: {
          cancellation_policy: string | null
          chat_announcement: string | null
          created_at: string | null
          description: string | null
          id: string
          included: string | null
          language_code: string
          luggage_info: string | null
          not_included: string | null
          notice_info: string | null
          pickup_drop_info: string | null
          preparation_info: string | null
          private_tour_info: string | null
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          small_group_info: string | null
          sub_category: string
          tags: string[] | null
          tour_operation_info: string | null
          updated_at: string | null
        }
        Insert: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          included?: string | null
          language_code?: string
          luggage_info?: string | null
          not_included?: string | null
          notice_info?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          private_tour_info?: string | null
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          sub_category: string
          tags?: string[] | null
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Update: {
          cancellation_policy?: string | null
          chat_announcement?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          included?: string | null
          language_code?: string
          luggage_info?: string | null
          not_included?: string | null
          notice_info?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          private_tour_info?: string | null
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          sub_category?: string
          tags?: string[] | null
          tour_operation_info?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_details_multilingual: {
        Row: {
          cancellation_policy: string | null
          channel_id: string | null
          chat_announcement: string | null
          created_at: string | null
          description: string | null
          id: string
          included: string | null
          language_code: string
          luggage_info: string | null
          not_included: string | null
          notice_info: string | null
          pickup_drop_info: string | null
          preparation_info: string | null
          private_tour_info: string | null
          product_id: string
          slogan1: string | null
          slogan2: string | null
          slogan3: string | null
          small_group_info: string | null
          tags: string[] | null
          tour_operation_info: string | null
          updated_at: string | null
          variant_key: string
        }
        Insert: {
          cancellation_policy?: string | null
          channel_id?: string | null
          chat_announcement?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          included?: string | null
          language_code?: string
          luggage_info?: string | null
          not_included?: string | null
          notice_info?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          private_tour_info?: string | null
          product_id: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          tags?: string[] | null
          tour_operation_info?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Update: {
          cancellation_policy?: string | null
          channel_id?: string | null
          chat_announcement?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          included?: string | null
          language_code?: string
          luggage_info?: string | null
          not_included?: string | null
          notice_info?: string | null
          pickup_drop_info?: string | null
          preparation_info?: string | null
          private_tour_info?: string | null
          product_id?: string
          slogan1?: string | null
          slogan2?: string | null
          slogan3?: string | null
          small_group_info?: string | null
          tags?: string[] | null
          tour_operation_info?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_details_multilingual_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_details_multilingual_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_faqs: {
        Row: {
          answer: string
          created_at: string | null
          id: string
          is_active: boolean | null
          order_index: number | null
          product_id: string
          question: string
          updated_at: string | null
        }
        Insert: {
          answer: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          product_id: string
          question: string
          updated_at?: string | null
        }
        Update: {
          answer?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          order_index?: number | null
          product_id?: string
          question?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_faqs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_guide_costs: {
        Row: {
          assistant_fee: number
          created_at: string | null
          driver_fee: number
          effective_from: string
          effective_to: string | null
          guide_fee: number
          id: string
          is_active: boolean
          product_id: string
          team_type: string
          updated_at: string | null
        }
        Insert: {
          assistant_fee?: number
          created_at?: string | null
          driver_fee?: number
          effective_from: string
          effective_to?: string | null
          guide_fee?: number
          id?: string
          is_active?: boolean
          product_id: string
          team_type: string
          updated_at?: string | null
        }
        Update: {
          assistant_fee?: number
          created_at?: string | null
          driver_fee?: number
          effective_from?: string
          effective_to?: string | null
          guide_fee?: number
          id?: string
          is_active?: boolean
          product_id?: string
          team_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_id_mapping_suggestions: {
        Row: {
          created_at: string | null
          id: number
          old_product_id: string
          reservation_count: number | null
          suggested_new_product_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          old_product_id: string
          reservation_count?: number | null
          suggested_new_product_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          old_product_id?: string
          reservation_count?: number | null
          suggested_new_product_id?: string | null
        }
        Relationships: []
      }
      product_media: {
        Row: {
          alt_text: string | null
          caption: string | null
          created_at: string | null
          file_name: string
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          mime_type: string | null
          order_index: number | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          file_name: string
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          mime_type?: string | null
          order_index?: number | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          created_at?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          mime_type?: string | null
          order_index?: number | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          adult_price_adjustment: number | null
          child_price_adjustment: number | null
          choice_description: string | null
          choice_name: string | null
          choice_type: string | null
          created_at: string | null
          description: string | null
          id: string
          image_alt: string | null
          image_url: string | null
          infant_price_adjustment: number | null
          is_default: boolean | null
          is_from_template: boolean | null
          is_multiple: boolean | null
          is_required: boolean | null
          linked_option_id: string | null
          max_selections: number | null
          min_selections: number | null
          name: string
          product_id: string | null
          template_option_id: string | null
          updated_at: string | null
        }
        Insert: {
          adult_price_adjustment?: number | null
          child_price_adjustment?: number | null
          choice_description?: string | null
          choice_name?: string | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          infant_price_adjustment?: number | null
          is_default?: boolean | null
          is_from_template?: boolean | null
          is_multiple?: boolean | null
          is_required?: boolean | null
          linked_option_id?: string | null
          max_selections?: number | null
          min_selections?: number | null
          name: string
          product_id?: string | null
          template_option_id?: string | null
          updated_at?: string | null
        }
        Update: {
          adult_price_adjustment?: number | null
          child_price_adjustment?: number | null
          choice_description?: string | null
          choice_name?: string | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_alt?: string | null
          image_url?: string | null
          infant_price_adjustment?: number | null
          is_default?: boolean | null
          is_from_template?: boolean | null
          is_multiple?: boolean | null
          is_required?: boolean | null
          linked_option_id?: string | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string
          product_id?: string | null
          template_option_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_new_linked_option_id_fkey"
            columns: ["linked_option_id"]
            isOneToOne: false
            referencedRelation: "choice_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_new_linked_option_id_fkey"
            columns: ["linked_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_new_linked_option_id_fkey"
            columns: ["linked_option_id"]
            isOneToOne: false
            referencedRelation: "options_with_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_new_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_options_new_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_template_option_id_fkey"
            columns: ["template_option_id"]
            isOneToOne: false
            referencedRelation: "choice_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_template_option_id_fkey"
            columns: ["template_option_id"]
            isOneToOne: false
            referencedRelation: "options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_options_template_option_id_fkey"
            columns: ["template_option_id"]
            isOneToOne: false
            referencedRelation: "options_with_images"
            referencedColumns: ["id"]
          },
        ]
      }
      product_schedules: {
        Row: {
          created_at: string | null
          day_number: number
          description_en: string | null
          description_ko: string | null
          duration_minutes: number | null
          end_time: string | null
          google_maps_link: string | null
          guide_driver_schedule: string | null
          guide_notes_en: string | null
          guide_notes_ko: string | null
          id: string
          is_break: boolean | null
          is_meal: boolean | null
          is_tour: boolean | null
          is_transport: boolean | null
          latitude: number | null
          location_en: string | null
          location_ko: string | null
          longitude: number | null
          no_time: boolean | null
          order_index: number | null
          product_id: string
          show_to_customers: boolean | null
          start_time: string | null
          thumbnail_url: string | null
          title_en: string | null
          title_ko: string | null
          two_guide_schedule: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          day_number: number
          description_en?: string | null
          description_ko?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          google_maps_link?: string | null
          guide_driver_schedule?: string | null
          guide_notes_en?: string | null
          guide_notes_ko?: string | null
          id?: string
          is_break?: boolean | null
          is_meal?: boolean | null
          is_tour?: boolean | null
          is_transport?: boolean | null
          latitude?: number | null
          location_en?: string | null
          location_ko?: string | null
          longitude?: number | null
          no_time?: boolean | null
          order_index?: number | null
          product_id: string
          show_to_customers?: boolean | null
          start_time?: string | null
          thumbnail_url?: string | null
          title_en?: string | null
          title_ko?: string | null
          two_guide_schedule?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          day_number?: number
          description_en?: string | null
          description_ko?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          google_maps_link?: string | null
          guide_driver_schedule?: string | null
          guide_notes_en?: string | null
          guide_notes_ko?: string | null
          id?: string
          is_break?: boolean | null
          is_meal?: boolean | null
          is_tour?: boolean | null
          is_transport?: boolean | null
          latitude?: number | null
          location_en?: string | null
          location_ko?: string | null
          longitude?: number | null
          no_time?: boolean | null
          order_index?: number | null
          product_id?: string
          show_to_customers?: boolean | null
          start_time?: string | null
          thumbnail_url?: string | null
          title_en?: string | null
          title_ko?: string | null
          two_guide_schedule?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_schedules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_schedules_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_sub_categories: {
        Row: {
          category_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          category_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          category_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_product_sub_categories_category_id"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tour_courses: {
        Row: {
          created_at: string | null
          id: string
          order: number | null
          product_id: string
          tour_course_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          order?: number | null
          product_id: string
          tour_course_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          order?: number | null
          product_id?: string
          tour_course_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_tour_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tour_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tour_courses_tour_course_id_fkey"
            columns: ["tour_course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          adult_age: number | null
          adult_base_price: number | null
          arrival_city: string | null
          arrival_country: string | null
          base_price: number
          category: string
          child_age_max: number | null
          child_age_min: number | null
          child_base_price: number | null
          choices: Json | null
          created_at: string | null
          customer_name_en: string
          customer_name_ko: string
          departure_city: string | null
          departure_country: string | null
          description: string | null
          display_name: Json | null
          duration: string | null
          favorite_order: number | null
          group_size: string | null
          homepage_pricing_type: string | null
          id: string
          infant_age: number | null
          infant_base_price: number | null
          is_favorite: boolean | null
          languages: string[] | null
          max_participants: number | null
          name: string
          name_en: string | null
          name_ko: string | null
          product_code: string | null
          status: string | null
          sub_category: string | null
          summary_en: string | null
          summary_ko: string | null
          tags: string[] | null
          tour_departure_times: Json | null
          transportation_methods: string[] | null
          use_common_details: boolean
        }
        Insert: {
          adult_age?: number | null
          adult_base_price?: number | null
          arrival_city?: string | null
          arrival_country?: string | null
          base_price: number
          category: string
          child_age_max?: number | null
          child_age_min?: number | null
          child_base_price?: number | null
          choices?: Json | null
          created_at?: string | null
          customer_name_en?: string
          customer_name_ko?: string
          departure_city?: string | null
          departure_country?: string | null
          description?: string | null
          display_name?: Json | null
          duration?: string | null
          favorite_order?: number | null
          group_size?: string | null
          homepage_pricing_type?: string | null
          id?: string
          infant_age?: number | null
          infant_base_price?: number | null
          is_favorite?: boolean | null
          languages?: string[] | null
          max_participants?: number | null
          name: string
          name_en?: string | null
          name_ko?: string | null
          product_code?: string | null
          status?: string | null
          sub_category?: string | null
          summary_en?: string | null
          summary_ko?: string | null
          tags?: string[] | null
          tour_departure_times?: Json | null
          transportation_methods?: string[] | null
          use_common_details?: boolean
        }
        Update: {
          adult_age?: number | null
          adult_base_price?: number | null
          arrival_city?: string | null
          arrival_country?: string | null
          base_price?: number
          category?: string
          child_age_max?: number | null
          child_age_min?: number | null
          child_base_price?: number | null
          choices?: Json | null
          created_at?: string | null
          customer_name_en?: string
          customer_name_ko?: string
          departure_city?: string | null
          departure_country?: string | null
          description?: string | null
          display_name?: Json | null
          duration?: string | null
          favorite_order?: number | null
          group_size?: string | null
          homepage_pricing_type?: string | null
          id?: string
          infant_age?: number | null
          infant_base_price?: number | null
          is_favorite?: boolean | null
          languages?: string[] | null
          max_participants?: number | null
          name?: string
          name_en?: string | null
          name_ko?: string | null
          product_code?: string | null
          status?: string | null
          sub_category?: string | null
          summary_en?: string | null
          summary_ko?: string | null
          tags?: string[] | null
          tour_departure_times?: Json | null
          transportation_methods?: string[] | null
          use_common_details?: boolean
        }
        Relationships: []
      }
      products_choices_backup: {
        Row: {
          choices: Json | null
          created_at: string | null
          id: string | null
        }
        Insert: {
          choices?: Json | null
          created_at?: string | null
          id?: string | null
        }
        Update: {
          choices?: Json | null
          created_at?: string | null
          id?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          assigned_to: string[] | null
          created_at: string | null
          created_by: string
          description: string | null
          end_date: string | null
          id: string
          priority: string
          progress: number | null
          start_date: string | null
          status: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string[] | null
          created_at?: string | null
          created_by: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          progress?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string[] | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          end_date?: string | null
          id?: string
          priority?: string
          progress?: number | null
          start_date?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          created_at: string | null
          customer_email: string | null
          endpoint: string
          id: string
          p256dh_key: string
          room_id: string | null
          updated_at: string | null
        }
        Insert: {
          auth_key: string
          created_at?: string | null
          customer_email?: string | null
          endpoint: string
          id?: string
          p256dh_key: string
          room_id?: string | null
          updated_at?: string | null
        }
        Update: {
          auth_key?: string
          created_at?: string | null
          customer_email?: string | null
          endpoint?: string
          id?: string
          p256dh_key?: string
          room_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      report_email_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          enabled: boolean | null
          id: string
          period: string
          send_time: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          id?: string
          period: string
          send_time?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          enabled?: boolean | null
          id?: string
          period?: string
          send_time?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      reservation_choices: {
        Row: {
          choice_group: string | null
          choice_id: string | null
          created_at: string | null
          id: string
          option_id: string | null
          option_key: string | null
          quantity: number | null
          reservation_id: string | null
          total_price: number | null
        }
        Insert: {
          choice_group?: string | null
          choice_id?: string | null
          created_at?: string | null
          id?: string
          option_id?: string | null
          option_key?: string | null
          quantity?: number | null
          reservation_id?: string | null
          total_price?: number | null
        }
        Update: {
          choice_group?: string | null
          choice_id?: string | null
          created_at?: string | null
          id?: string
          option_id?: string | null
          option_key?: string | null
          quantity?: number | null
          reservation_id?: string | null
          total_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_choices_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "product_choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "choice_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_customers: {
        Row: {
          created_at: string | null
          customer_id: string | null
          email: string | null
          id: string
          id_photo_url: string | null
          name: string | null
          name_en: string | null
          name_ko: string | null
          order_index: number | null
          pass_covered_count: number | null
          pass_photo_url: string | null
          phone: string | null
          reservation_id: string
          resident_status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          id?: string
          id_photo_url?: string | null
          name?: string | null
          name_en?: string | null
          name_ko?: string | null
          order_index?: number | null
          pass_covered_count?: number | null
          pass_photo_url?: string | null
          phone?: string | null
          reservation_id: string
          resident_status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          email?: string | null
          id?: string
          id_photo_url?: string | null
          name?: string | null
          name_en?: string | null
          name_ko?: string | null
          order_index?: number | null
          pass_covered_count?: number | null
          pass_photo_url?: string | null
          phone?: string | null
          reservation_id?: string
          resident_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_customers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_customers_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_customers_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_customers_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_expenses: {
        Row: {
          amount: number | null
          audited_by: string | null
          checked_by: string | null
          checked_on: string | null
          created_at: string | null
          file_path: string | null
          id: string
          image_url: string | null
          note: string | null
          paid_for: string | null
          paid_to: string | null
          payment_method: string | null
          reimbursed_amount: number
          reimbursed_on: string | null
          reimbursement_note: string | null
          reservation_id: string | null
          status: string | null
          submit_on: string | null
          submitted_by: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          audited_by?: string | null
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string | null
          file_path?: string | null
          id: string
          image_url?: string | null
          note?: string | null
          paid_for?: string | null
          paid_to?: string | null
          payment_method?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          reservation_id?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          audited_by?: string | null
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          image_url?: string | null
          note?: string | null
          paid_for?: string | null
          paid_to?: string | null
          payment_method?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          reservation_id?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_expenses_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_expenses_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_expenses_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_imports: {
        Row: {
          id: string
          message_id: string | null
          source_email: string | null
          platform_key: string | null
          subject: string | null
          received_at: string | null
          raw_body_text: string | null
          raw_body_html: string | null
          extracted_data: Json
          status: string
          reservation_id: string | null
          created_at: string | null
          updated_at: string | null
          confirmed_by: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          source_email?: string | null
          platform_key?: string | null
          subject?: string | null
          received_at?: string | null
          raw_body_text?: string | null
          raw_body_html?: string | null
          extracted_data?: Json
          status?: string
          reservation_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          confirmed_by?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          source_email?: string | null
          platform_key?: string | null
          subject?: string | null
          received_at?: string | null
          raw_body_text?: string | null
          raw_body_html?: string | null
          extracted_data?: Json
          status?: string
          reservation_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          confirmed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_imports_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_options: {
        Row: {
          created_at: string | null
          ea: number | null
          id: string
          note: string | null
          option_id: string
          price: number | null
          reservation_id: string | null
          status: string | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ea?: number | null
          id?: string
          note?: string | null
          option_id: string
          price?: number | null
          reservation_id?: string | null
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ea?: number | null
          id?: string
          note?: string | null
          option_id?: string
          price?: number | null
          reservation_id?: string | null
          status?: string | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_options_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_pricing: {
        Row: {
          additional_cost: number | null
          additional_discount: number | null
          adult_product_price: number | null
          balance_amount: number | null
          card_fee: number | null
          child_product_price: number | null
          choices: Json | null
          choices_total: number | null
          commission_amount: number | null
          commission_percent: number | null
          coupon_code: string | null
          coupon_discount: number | null
          created_at: string | null
          deposit_amount: number | null
          id: string
          infant_product_price: number | null
          not_included_price: number | null
          option_total: number | null
          prepayment_cost: number | null
          prepayment_tip: number | null
          private_tour_additional_cost: number | null
          product_price_total: number | null
          refund_amount: number | null
          refund_reason: string | null
          required_option_total: number | null
          required_options: Json | null
          reservation_id: string
          selected_options: Json | null
          subtotal: number | null
          tax: number | null
          total_price: number | null
          updated_at: string | null
        }
        Insert: {
          additional_cost?: number | null
          additional_discount?: number | null
          adult_product_price?: number | null
          balance_amount?: number | null
          card_fee?: number | null
          child_product_price?: number | null
          choices?: Json | null
          choices_total?: number | null
          commission_amount?: number | null
          commission_percent?: number | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          infant_product_price?: number | null
          not_included_price?: number | null
          option_total?: number | null
          prepayment_cost?: number | null
          prepayment_tip?: number | null
          private_tour_additional_cost?: number | null
          product_price_total?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          required_option_total?: number | null
          required_options?: Json | null
          reservation_id: string
          selected_options?: Json | null
          subtotal?: number | null
          tax?: number | null
          total_price?: number | null
          updated_at?: string | null
        }
        Update: {
          additional_cost?: number | null
          additional_discount?: number | null
          adult_product_price?: number | null
          balance_amount?: number | null
          card_fee?: number | null
          child_product_price?: number | null
          choices?: Json | null
          choices_total?: number | null
          commission_amount?: number | null
          commission_percent?: number | null
          coupon_code?: string | null
          coupon_discount?: number | null
          created_at?: string | null
          deposit_amount?: number | null
          id?: string
          infant_product_price?: number | null
          not_included_price?: number | null
          option_total?: number | null
          prepayment_cost?: number | null
          prepayment_tip?: number | null
          private_tour_additional_cost?: number | null
          product_price_total?: number | null
          refund_amount?: number | null
          refund_reason?: string | null
          required_option_total?: number | null
          required_options?: Json | null
          reservation_id?: string
          selected_options?: Json | null
          subtotal?: number | null
          tax?: number | null
          total_price?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      reservation_reviews: {
        Row: {
          content: string | null
          created_at: string | null
          evidence_photo_url: string | null
          has_photo: boolean | null
          id: string
          platform: string
          rating: number
          reservation_id: string
          tour_photo_url: string | null
          updated_at: string | null
        }
        Insert: {
          content?: string | null
          created_at?: string | null
          evidence_photo_url?: string | null
          has_photo?: boolean | null
          id?: string
          platform: string
          rating: number
          reservation_id: string
          tour_photo_url?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: string | null
          created_at?: string | null
          evidence_photo_url?: string | null
          has_photo?: boolean | null
          id?: string
          platform?: string
          rating?: number
          reservation_id?: string
          tour_photo_url?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_reviews_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_check_submissions: {
        Row: {
          agreed: boolean
          card_processing_fee_usd_cents: number
          created_at: string
          has_annual_pass: boolean | null
          id: string
          id_proof_url: string | null
          non_resident_16_plus_count: number
          nps_fee_usd_cents: number
          pass_assistance_requested: boolean
          pass_photo_url: string | null
          payment_method: string | null
          residency: string
          stripe_payment_intent_id: string | null
          stripe_payment_status: string | null
          token_id: string
          total_charge_usd_cents: number
          updated_at: string
        }
        Insert: {
          agreed?: boolean
          card_processing_fee_usd_cents?: number
          created_at?: string
          has_annual_pass?: boolean | null
          id?: string
          id_proof_url?: string | null
          non_resident_16_plus_count?: number
          nps_fee_usd_cents?: number
          pass_assistance_requested?: boolean
          pass_photo_url?: string | null
          payment_method?: string | null
          residency: string
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          token_id: string
          total_charge_usd_cents?: number
          updated_at?: string
        }
        Update: {
          agreed?: boolean
          card_processing_fee_usd_cents?: number
          created_at?: string
          has_annual_pass?: boolean | null
          id?: string
          id_proof_url?: string | null
          non_resident_16_plus_count?: number
          nps_fee_usd_cents?: number
          pass_assistance_requested?: boolean
          pass_photo_url?: string | null
          payment_method?: string | null
          residency?: string
          stripe_payment_intent_id?: string | null
          stripe_payment_status?: string | null
          token_id?: string
          total_charge_usd_cents?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_check_submissions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: true
            referencedRelation: "resident_check_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      resident_check_tokens: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string
          id: string
          reservation_id: string
          token_hash: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          reservation_id: string
          token_hash: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          reservation_id?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "resident_check_tokens_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_check_tokens_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resident_check_tokens_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations: {
        Row: {
          added_by: string | null
          adults: number | null
          channel_id: string
          channel_rn: string | null
          child: number | null
          choices: Json | null
          created_at: string | null
          customer_id: string | null
          event_note: string | null
          id: string
          infant: number | null
          is_private_tour: boolean | null
          pickup_hotel: string | null
          pickup_notification_sent: boolean | null
          pickup_time: string | null
          product_id: string | null
          selected_choices: Json | null
          selected_option_prices: Json | null
          selected_options: Json | null
          status: string | null
          sub_channel: string | null
          total_people: number | null
          tour_date: string
          tour_id: string | null
          tour_time: string | null
          updated_at: string | null
          variant_key: string
        }
        Insert: {
          added_by?: string | null
          adults?: number | null
          channel_id: string
          channel_rn?: string | null
          child?: number | null
          choices?: Json | null
          created_at?: string | null
          customer_id?: string | null
          event_note?: string | null
          id?: string
          infant?: number | null
          is_private_tour?: boolean | null
          pickup_hotel?: string | null
          pickup_notification_sent?: boolean | null
          pickup_time?: string | null
          product_id?: string | null
          selected_choices?: Json | null
          selected_option_prices?: Json | null
          selected_options?: Json | null
          status?: string | null
          sub_channel?: string | null
          total_people?: number | null
          tour_date: string
          tour_id?: string | null
          tour_time?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Update: {
          added_by?: string | null
          adults?: number | null
          channel_id?: string
          channel_rn?: string | null
          child?: number | null
          choices?: Json | null
          created_at?: string | null
          customer_id?: string | null
          event_note?: string | null
          id?: string
          infant?: number | null
          is_private_tour?: boolean | null
          pickup_hotel?: string | null
          pickup_notification_sent?: boolean | null
          pickup_time?: string | null
          product_id?: string | null
          selected_choices?: Json | null
          selected_option_prices?: Json | null
          selected_options?: Json | null
          status?: string | null
          sub_channel?: string | null
          total_people?: number | null
          tour_date?: string
          tour_id?: string | null
          tour_time?: string | null
          updated_at?: string | null
          variant_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reservations_channel"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_reservations_channel"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations_backup_before_product_migration: {
        Row: {
          added_by: string | null
          adults: number | null
          channel_id: string | null
          channel_rn: string | null
          child: number | null
          created_at: string | null
          customer_id: string | null
          event_note: string | null
          id: string | null
          infant: number | null
          pickup_hotel: string | null
          pickup_time: string | null
          product_id: string | null
          selected_option_prices: Json | null
          selected_options: Json | null
          status: string | null
          total_people: number | null
          tour_date: string | null
          tour_id: string | null
          tour_time: string | null
        }
        Insert: {
          added_by?: string | null
          adults?: number | null
          channel_id?: string | null
          channel_rn?: string | null
          child?: number | null
          created_at?: string | null
          customer_id?: string | null
          event_note?: string | null
          id?: string | null
          infant?: number | null
          pickup_hotel?: string | null
          pickup_time?: string | null
          product_id?: string | null
          selected_option_prices?: Json | null
          selected_options?: Json | null
          status?: string | null
          total_people?: number | null
          tour_date?: string | null
          tour_id?: string | null
          tour_time?: string | null
        }
        Update: {
          added_by?: string | null
          adults?: number | null
          channel_id?: string | null
          channel_rn?: string | null
          child?: number | null
          created_at?: string | null
          customer_id?: string | null
          event_note?: string | null
          id?: string | null
          infant?: number | null
          pickup_hotel?: string | null
          pickup_time?: string | null
          product_id?: string | null
          selected_option_prices?: Json | null
          selected_options?: Json | null
          status?: string | null
          total_people?: number | null
          tour_date?: string | null
          tour_id?: string | null
          tour_time?: string | null
        }
        Relationships: []
      }
      reservations_choices_backup: {
        Row: {
          choices: Json | null
          created_at: string | null
          id: string | null
        }
        Insert: {
          choices?: Json | null
          created_at?: string | null
          id?: string | null
        }
        Update: {
          choices?: Json | null
          created_at?: string | null
          id?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          description: string | null
          display_name: string
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_name: string
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_name?: string
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      share_tokens: {
        Row: {
          created_at: string
          doc_type: string
          expires_at: string
          reservation_id: string
          token: string
        }
        Insert: {
          created_at?: string
          doc_type: string
          expires_at: string
          reservation_id: string
          token: string
        }
        Update: {
          created_at?: string
          doc_type?: string
          expires_at?: string
          reservation_id?: string
          token?: string
        }
        Relationships: []
      }
      shared_settings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sunrise_sunset_data: {
        Row: {
          created_at: string | null
          date: string
          id: string
          latitude: number
          location_name: string
          longitude: number
          sunrise_time: string
          sunset_time: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          latitude: number
          location_name: string
          longitude: number
          sunrise_time: string
          sunset_time: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          latitude?: number
          location_name?: string
          longitude?: number
          sunrise_time?: string
          sunset_time?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplier_products: {
        Row: {
          adult_season_price: number | null
          adult_supplier_price: number | null
          child_season_price: number | null
          child_supplier_price: number | null
          choice_id: string | null
          choice_option_id: string | null
          created_at: string | null
          entry_times: Json | null
          id: string
          infant_season_price: number | null
          infant_supplier_price: number | null
          is_active: boolean | null
          markup_amount: number | null
          markup_percent: number | null
          option_id: string | null
          product_id: string | null
          regular_price: number
          season_dates: Json | null
          season_price: number | null
          supplier_id: string
          supplier_price: number
          ticket_name: string
          updated_at: string | null
        }
        Insert: {
          adult_season_price?: number | null
          adult_supplier_price?: number | null
          child_season_price?: number | null
          child_supplier_price?: number | null
          choice_id?: string | null
          choice_option_id?: string | null
          created_at?: string | null
          entry_times?: Json | null
          id?: string
          infant_season_price?: number | null
          infant_supplier_price?: number | null
          is_active?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          option_id?: string | null
          product_id?: string | null
          regular_price: number
          season_dates?: Json | null
          season_price?: number | null
          supplier_id: string
          supplier_price: number
          ticket_name: string
          updated_at?: string | null
        }
        Update: {
          adult_season_price?: number | null
          adult_supplier_price?: number | null
          child_season_price?: number | null
          child_supplier_price?: number | null
          choice_id?: string | null
          choice_option_id?: string | null
          created_at?: string | null
          entry_times?: Json | null
          id?: string
          infant_season_price?: number | null
          infant_supplier_price?: number | null
          is_active?: boolean | null
          markup_amount?: number | null
          markup_percent?: number | null
          option_id?: string | null
          product_id?: string | null
          regular_price?: number
          season_dates?: Json | null
          season_price?: number | null
          supplier_id?: string
          supplier_price?: number
          ticket_name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_ticket_purchases: {
        Row: {
          booking_id: string
          created_at: string | null
          id: string
          is_season_price: boolean | null
          notes: string | null
          payment_date: string | null
          payment_status: string | null
          purchase_date: string
          quantity: number
          supplier_id: string
          supplier_product_id: string
          total_amount: number
          unit_price: number
          updated_at: string | null
        }
        Insert: {
          booking_id: string
          created_at?: string | null
          id?: string
          is_season_price?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string | null
          purchase_date?: string
          quantity?: number
          supplier_id: string
          supplier_product_id: string
          total_amount: number
          unit_price: number
          updated_at?: string | null
        }
        Update: {
          booking_id?: string
          created_at?: string | null
          id?: string
          is_season_price?: boolean | null
          notes?: string | null
          payment_date?: string | null
          payment_status?: string | null
          purchase_date?: string
          quantity?: number
          supplier_id?: string
          supplier_product_id?: string
          total_amount?: number
          unit_price?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_ticket_purchases_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "ticket_bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ticket_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_ticket_purchases_supplier_product_id_fkey"
            columns: ["supplier_product_id"]
            isOneToOne: false
            referencedRelation: "supplier_products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tag_translations: {
        Row: {
          created_at: string | null
          id: string
          label: string
          locale: string
          notes: string | null
          pronunciation: string | null
          tag_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          label: string
          locale: string
          notes?: string | null
          pronunciation?: string | null
          tag_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          label?: string
          locale?: string
          notes?: string | null
          pronunciation?: string | null
          tag_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_translations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tag_translations_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags_with_translations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string | null
          icon_url: string | null
          id: string
          is_system: boolean | null
          key: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          icon_url?: string | null
          id: string
          is_system?: boolean | null
          key: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          icon_url?: string | null
          id?: string
          is_system?: boolean | null
          key?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      tasks: {
        Row: {
          assigned_to: string | null
          created_at: string | null
          created_by: string
          description: string | null
          due_date: string | null
          id: number
          priority: string | null
          status: string | null
          tags: string[] | null
          target_individuals: string[] | null
          target_positions: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: number
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          target_individuals?: string[] | null
          target_positions?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          assigned_to?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: number
          priority?: string | null
          status?: string | null
          tags?: string[] | null
          target_individuals?: string[] | null
          target_positions?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      team: {
        Row: {
          account_holder: string | null
          avatar_url: string | null
          bank_name: string | null
          bank_number: string | null
          car_plate: string | null
          car_year: number | null
          cpr: boolean | null
          cpr_acquired: string | null
          cpr_expired: string | null
          created_at: string | null
          date_of_birth: string | null
          email: string
          emergency_contact: string | null
          hire_date: string | null
          home_address: string | null
          is_active: boolean | null
          languages: string[] | null
          medical_acquired: string | null
          medical_expired: string | null
          medical_report: boolean | null
          name_en: string | null
          nick_name: string | null
          name_ko: string
          personal_car_model: string | null
          phone: string | null
          position: string | null
          role_id: string | null
          routing_number: string | null
          ssn: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          account_holder?: string | null
          avatar_url?: string | null
          bank_name?: string | null
          bank_number?: string | null
          car_plate?: string | null
          car_year?: number | null
          cpr?: boolean | null
          cpr_acquired?: string | null
          cpr_expired?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email: string
          emergency_contact?: string | null
          hire_date?: string | null
          home_address?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          medical_acquired?: string | null
          medical_expired?: string | null
          medical_report?: boolean | null
          name_en?: string | null
          nick_name?: string | null
          name_ko: string
          personal_car_model?: string | null
          phone?: string | null
          position?: string | null
          role_id?: string | null
          routing_number?: string | null
          ssn?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          account_holder?: string | null
          avatar_url?: string | null
          bank_name?: string | null
          bank_number?: string | null
          car_plate?: string | null
          car_year?: number | null
          cpr?: boolean | null
          cpr_acquired?: string | null
          cpr_expired?: string | null
          created_at?: string | null
          date_of_birth?: string | null
          email?: string
          emergency_contact?: string | null
          hire_date?: string | null
          home_address?: string | null
          is_active?: boolean | null
          languages?: string[] | null
          medical_acquired?: string | null
          medical_expired?: string | null
          medical_report?: boolean | null
          name_en?: string | null
          name_ko?: string
          personal_car_model?: string | null
          phone?: string | null
          position?: string | null
          role_id?: string | null
          routing_number?: string | null
          ssn?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcement_acknowledgments: {
        Row: {
          ack_at: string
          ack_by: string
          announcement_id: string
          id: string
        }
        Insert: {
          ack_at?: string
          ack_by: string
          announcement_id: string
          id?: string
        }
        Update: {
          ack_at?: string
          ack_by?: string
          announcement_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_announcement_acknowledgments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "team_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcement_comments: {
        Row: {
          announcement_id: string
          comment: string
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          announcement_id: string
          comment: string
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          announcement_id?: string
          comment?: string
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_announcement_comments_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "team_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcement_todo_links: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          todo_id: string
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          todo_id: string
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          todo_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_announcement_todo_links_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "team_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_announcement_todo_links_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "op_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      team_announcements: {
        Row: {
          content: string
          created_at: string
          created_by: string
          due_by: string | null
          id: string
          is_archived: boolean | null
          is_pinned: boolean | null
          priority: string | null
          recipients: string[] | null
          tags: string[] | null
          target_positions: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          created_by: string
          due_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          priority?: string | null
          recipients?: string[] | null
          tags?: string[] | null
          target_positions?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string
          due_by?: string | null
          id?: string
          is_archived?: boolean | null
          is_pinned?: boolean | null
          priority?: string | null
          recipients?: string[] | null
          tags?: string[] | null
          target_positions?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_chat_messages: {
        Row: {
          created_at: string | null
          file_name: string | null
          file_size: number | null
          file_type: string | null
          file_url: string | null
          id: string
          is_pinned: boolean | null
          message: string
          message_type: string | null
          reply_to_id: string | null
          room_id: string
          sender_email: string
          sender_name: string
          sender_position: string | null
        }
        Insert: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          message: string
          message_type?: string | null
          reply_to_id?: string | null
          room_id: string
          sender_email: string
          sender_name: string
          sender_position?: string | null
        }
        Update: {
          created_at?: string | null
          file_name?: string | null
          file_size?: number | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_pinned?: boolean | null
          message?: string
          message_type?: string | null
          reply_to_id?: string | null
          room_id?: string
          sender_email?: string
          sender_name?: string
          sender_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "team_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "team_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_participants: {
        Row: {
          id: string
          is_active: boolean | null
          is_admin: boolean | null
          joined_at: string | null
          last_read_at: string | null
          participant_email: string
          participant_name: string
          participant_position: string | null
          room_id: string
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          participant_email: string
          participant_name: string
          participant_position?: string | null
          room_id: string
        }
        Update: {
          id?: string
          is_active?: boolean | null
          is_admin?: boolean | null
          joined_at?: string | null
          last_read_at?: string | null
          participant_email?: string
          participant_name?: string
          participant_position?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "team_chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_read_status: {
        Row: {
          id: string
          message_id: string
          read_at: string | null
          reader_email: string
        }
        Insert: {
          id?: string
          message_id: string
          read_at?: string | null
          reader_email: string
        }
        Update: {
          id?: string
          message_id?: string
          read_at?: string | null
          reader_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_chat_read_status_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "team_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      team_chat_rooms: {
        Row: {
          created_at: string | null
          created_by: string
          department: string | null
          description: string | null
          id: string
          is_active: boolean | null
          room_name: string
          room_type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          room_name: string
          room_type?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          department?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          room_name?: string
          room_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ticket_bookings: {
        Row: {
          category: string
          check_in_date: string
          company: string | null
          created_at: string | null
          ea: number | null
          expense: number | null
          id: string
          income: number | null
          note: string | null
          payment_method: string | null
          reservation_id: string | null
          rn_number: string | null
          season: string | null
          status: string | null
          submit_on: string | null
          submitted_by: string
          time: string | null
          tour_id: string | null
          updated_at: string | null
          uploaded_file_urls: string[] | null
        }
        Insert: {
          category: string
          check_in_date: string
          company?: string | null
          created_at?: string | null
          ea?: number | null
          expense?: number | null
          id?: string
          income?: number | null
          note?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          rn_number?: string | null
          season?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by: string
          time?: string | null
          tour_id?: string | null
          updated_at?: string | null
          uploaded_file_urls?: string[] | null
        }
        Update: {
          category?: string
          check_in_date?: string
          company?: string | null
          created_at?: string | null
          ea?: number | null
          expense?: number | null
          id?: string
          income?: number | null
          note?: string | null
          payment_method?: string | null
          reservation_id?: string | null
          rn_number?: string | null
          season?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by?: string
          time?: string | null
          tour_id?: string | null
          updated_at?: string | null
          uploaded_file_urls?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "ticket_bookings_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_bookings_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_bookings_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      todo_click_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          timestamp: string | null
          todo_id: string
          user_email: string
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          timestamp?: string | null
          todo_id: string
          user_email: string
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          timestamp?: string | null
          todo_id?: string
          user_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "todo_click_logs_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "op_todos"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_announcements: {
        Row: {
          content: string
          created_at: string | null
          created_by: string
          id: string
          is_active: boolean | null
          language: string
          title: string
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by: string
          id?: string
          is_active?: boolean | null
          language?: string
          title: string
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string
          id?: string
          is_active?: boolean | null
          language?: string
          title?: string
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_announcements_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_attractions: {
        Row: {
          category: string | null
          coordinates: unknown
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          location: string | null
          name_en: string
          name_ko: string
          updated_at: string | null
          visit_duration: number | null
        }
        Insert: {
          category?: string | null
          coordinates?: unknown
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name_en: string
          name_ko: string
          updated_at?: string | null
          visit_duration?: number | null
        }
        Update: {
          category?: string | null
          coordinates?: unknown
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          location?: string | null
          name_en?: string
          name_ko?: string
          updated_at?: string | null
          visit_duration?: number | null
        }
        Relationships: []
      }
      tour_bonuses: {
        Row: {
          additional_cost: number | null
          created_at: string | null
          driver_bonus: number | null
          driver_email: string | null
          guide_bonus: number | null
          guide_email: string | null
          non_resident_count: number | null
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          additional_cost?: number | null
          created_at?: string | null
          driver_bonus?: number | null
          driver_email?: string | null
          guide_bonus?: number | null
          guide_email?: string | null
          non_resident_count?: number | null
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          additional_cost?: number | null
          created_at?: string | null
          driver_bonus?: number | null
          driver_email?: string | null
          guide_bonus?: number | null
          guide_email?: string | null
          non_resident_count?: number | null
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_bonuses_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_cost_calculator_configs: {
        Row: {
          course_order: Json | null
          created_at: string | null
          created_by: string | null
          custom_margin_rate: number | null
          customer_id: string | null
          gas_price: number | null
          guide_fee: number | null
          guide_hourly_rate: number | null
          id: string
          margin_type: string | null
          mileage: number | null
          name: string
          other_expenses: Json | null
          participant_count: number | null
          selected_courses: Json | null
          selected_product_id: string | null
          tour_type: string
          travel_time: number | null
          updated_at: string | null
          updated_by: string | null
          vehicle_type: string | null
        }
        Insert: {
          course_order?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_margin_rate?: number | null
          customer_id?: string | null
          gas_price?: number | null
          guide_fee?: number | null
          guide_hourly_rate?: number | null
          id?: string
          margin_type?: string | null
          mileage?: number | null
          name: string
          other_expenses?: Json | null
          participant_count?: number | null
          selected_courses?: Json | null
          selected_product_id?: string | null
          tour_type?: string
          travel_time?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Update: {
          course_order?: Json | null
          created_at?: string | null
          created_by?: string | null
          custom_margin_rate?: number | null
          customer_id?: string | null
          gas_price?: number | null
          guide_fee?: number | null
          guide_hourly_rate?: number | null
          id?: string
          margin_type?: string | null
          mileage?: number | null
          name?: string
          other_expenses?: Json | null
          participant_count?: number | null
          selected_courses?: Json | null
          selected_product_id?: string | null
          tour_type?: string
          travel_time?: number | null
          updated_at?: string | null
          updated_by?: string | null
          vehicle_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_cost_calculator_configs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_cost_calculator_templates: {
        Row: {
          course_order: Json
          created_at: string | null
          created_by: string | null
          id: string
          name: string
          selected_courses: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          course_order: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          name: string
          selected_courses: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          course_order?: Json
          created_at?: string | null
          created_by?: string | null
          id?: string
          name?: string
          selected_courses?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      tour_course_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tour_course_connections: {
        Row: {
          connection_type: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          difficulty_level: string | null
          distance_km: number | null
          duration_minutes: number | null
          from_course_id: string
          id: string
          is_active: boolean | null
          name_en: string | null
          name_ko: string | null
          to_course_id: string
          updated_at: string | null
        }
        Insert: {
          connection_type?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          from_course_id: string
          id?: string
          is_active?: boolean | null
          name_en?: string | null
          name_ko?: string | null
          to_course_id: string
          updated_at?: string | null
        }
        Update: {
          connection_type?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance_km?: number | null
          duration_minutes?: number | null
          from_course_id?: string
          id?: string
          is_active?: boolean | null
          name_en?: string | null
          name_ko?: string | null
          to_course_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_course_connections_from_course_id_fkey"
            columns: ["from_course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_course_connections_to_course_id_fkey"
            columns: ["to_course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_course_maps: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          map_data: Json | null
          map_type: string
          map_url: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id: string
          map_data?: Json | null
          map_type: string
          map_url?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          map_data?: Json | null
          map_type?: string
          map_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_course_maps_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_course_photos: {
        Row: {
          course_id: string | null
          created_at: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          photo_alt_en: string | null
          photo_alt_ko: string | null
          photo_url: string
          sort_order: number | null
          thumbnail_url: string | null
          uploaded_by: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id: string
          is_primary?: boolean | null
          photo_alt_en?: string | null
          photo_alt_ko?: string | null
          photo_url: string
          sort_order?: number | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_alt_en?: string | null
          photo_alt_ko?: string | null
          photo_url?: string
          sort_order?: number | null
          thumbnail_url?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_course_photos_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_course_points: {
        Row: {
          course_id: string
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          id: string
          is_active: boolean | null
          latitude: number | null
          location: string | null
          longitude: number | null
          point_name: string
          sort_order: number | null
          updated_at: string | null
          visit_duration: number | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          point_name: string
          sort_order?: number | null
          updated_at?: string | null
          visit_duration?: number | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          id?: string
          is_active?: boolean | null
          latitude?: number | null
          location?: string | null
          longitude?: number | null
          point_name?: string
          sort_order?: number | null
          updated_at?: string | null
          visit_duration?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_course_points_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_course_products: {
        Row: {
          course_id: string | null
          created_at: string | null
          id: string
          product_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string | null
          id: string
          product_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string | null
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_course_products_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_course_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "tour_course_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_courses: {
        Row: {
          category: string
          category_id: string | null
          created_at: string | null
          customer_description_en: string | null
          customer_description_ko: string | null
          customer_name_en: string | null
          customer_name_ko: string | null
          description_en: string | null
          description_ko: string | null
          difficulty_level: string | null
          distance: number | null
          duration_hours: number
          end_latitude: number | null
          end_longitude: number | null
          id: string
          internal_note: string | null
          is_active: boolean | null
          level: number | null
          location: string | null
          max_participants: number | null
          min_participants: number | null
          name_en: string
          name_ko: string
          parent_id: string | null
          path: string | null
          point_name: string | null
          price_13seater: number | null
          price_9seater: number | null
          price_adult: number | null
          price_child: number | null
          price_infant: number | null
          price_minivan: number | null
          price_type: string | null
          product_id: string | null
          sort_order: number | null
          start_latitude: number | null
          start_longitude: number | null
          team_description_en: string | null
          team_description_ko: string | null
          team_name_en: string | null
          team_name_ko: string | null
          updated_at: string | null
        }
        Insert: {
          category: string
          category_id?: string | null
          created_at?: string | null
          customer_description_en?: string | null
          customer_description_ko?: string | null
          customer_name_en?: string | null
          customer_name_ko?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance?: number | null
          duration_hours: number
          end_latitude?: number | null
          end_longitude?: number | null
          id: string
          internal_note?: string | null
          is_active?: boolean | null
          level?: number | null
          location?: string | null
          max_participants?: number | null
          min_participants?: number | null
          name_en: string
          name_ko: string
          parent_id?: string | null
          path?: string | null
          point_name?: string | null
          price_13seater?: number | null
          price_9seater?: number | null
          price_adult?: number | null
          price_child?: number | null
          price_infant?: number | null
          price_minivan?: number | null
          price_type?: string | null
          product_id?: string | null
          sort_order?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          team_description_en?: string | null
          team_description_ko?: string | null
          team_name_en?: string | null
          team_name_ko?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          created_at?: string | null
          customer_description_en?: string | null
          customer_description_ko?: string | null
          customer_name_en?: string | null
          customer_name_ko?: string | null
          description_en?: string | null
          description_ko?: string | null
          difficulty_level?: string | null
          distance?: number | null
          duration_hours?: number
          end_latitude?: number | null
          end_longitude?: number | null
          id?: string
          internal_note?: string | null
          is_active?: boolean | null
          level?: number | null
          location?: string | null
          max_participants?: number | null
          min_participants?: number | null
          name_en?: string
          name_ko?: string
          parent_id?: string | null
          path?: string | null
          point_name?: string | null
          price_13seater?: number | null
          price_9seater?: number | null
          price_adult?: number | null
          price_child?: number | null
          price_infant?: number | null
          price_minivan?: number | null
          price_type?: string | null
          product_id?: string | null
          sort_order?: number | null
          start_latitude?: number | null
          start_longitude?: number | null
          team_description_en?: string | null
          team_description_ko?: string | null
          team_name_en?: string | null
          team_name_ko?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_courses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tour_course_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_courses_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "tour_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "tour_courses_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_expenses: {
        Row: {
          amount: number | null
          audited_by: string | null
          checked_by: string | null
          checked_on: string | null
          created_at: string | null
          file_path: string | null
          id: string
          image_url: string | null
          note: string | null
          paid_for: string
          paid_to: string | null
          payment_method: string | null
          product_id: string | null
          reimbursed_amount: number
          reimbursed_on: string | null
          reimbursement_note: string | null
          status: string | null
          submit_on: string | null
          submitted_by: string
          tour_date: string
          tour_id: string | null
          updated_at: string | null
        }
        Insert: {
          amount?: number | null
          audited_by?: string | null
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          image_url?: string | null
          note?: string | null
          paid_for: string
          paid_to?: string | null
          payment_method?: string | null
          product_id?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by: string
          tour_date: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number | null
          audited_by?: string | null
          checked_by?: string | null
          checked_on?: string | null
          created_at?: string | null
          file_path?: string | null
          id?: string
          image_url?: string | null
          note?: string | null
          paid_for?: string
          paid_to?: string | null
          payment_method?: string | null
          product_id?: string | null
          reimbursed_amount?: number
          reimbursed_on?: string | null
          reimbursement_note?: string | null
          status?: string | null
          submit_on?: string | null
          submitted_by?: string
          tour_date?: string
          tour_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tour_hotel_bookings: {
        Row: {
          cc: string | null
          check_in_date: string
          check_out_date: string
          city: string
          created_at: string | null
          event_date: string
          hotel: string
          id: string
          payment_method: string | null
          reservation_name: string
          rn_number: string | null
          room_type: string | null
          rooms: number
          status: string | null
          submit_on: string | null
          submitted_by: string | null
          total_price: number | null
          tour_id: string | null
          unit_price: number | null
          updated_at: string | null
          uploaded_file_urls: string[] | null
          website: string | null
        }
        Insert: {
          cc?: string | null
          check_in_date: string
          check_out_date: string
          city: string
          created_at?: string | null
          event_date: string
          hotel: string
          id?: string
          payment_method?: string | null
          reservation_name: string
          rn_number?: string | null
          room_type?: string | null
          rooms?: number
          status?: string | null
          submit_on?: string | null
          submitted_by?: string | null
          total_price?: number | null
          tour_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          uploaded_file_urls?: string[] | null
          website?: string | null
        }
        Update: {
          cc?: string | null
          check_in_date?: string
          check_out_date?: string
          city?: string
          created_at?: string | null
          event_date?: string
          hotel?: string
          id?: string
          payment_method?: string | null
          reservation_name?: string
          rn_number?: string | null
          room_type?: string | null
          rooms?: number
          status?: string | null
          submit_on?: string | null
          submitted_by?: string | null
          total_price?: number | null
          tour_id?: string | null
          unit_price?: number | null
          updated_at?: string | null
          uploaded_file_urls?: string[] | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_hotel_bookings_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_material_categories: {
        Row: {
          color: string | null
          created_at: string | null
          description_en: string | null
          description_ko: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_en: string
          name_ko: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en: string
          name_ko: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description_en?: string | null
          description_ko?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          name_ko?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      tour_materials: {
        Row: {
          attraction_id: string | null
          category_id: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          duration: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_active: boolean | null
          is_public: boolean | null
          language: string | null
          mime_type: string
          tags: string[] | null
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          attraction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: number | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          language?: string | null
          mime_type: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          attraction_id?: string | null
          category_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          duration?: number | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          language?: string | null
          mime_type?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_materials_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "tour_attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "tour_material_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_photo_download_logs: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          downloaded_at: string | null
          file_name: string
          file_path: string
          id: string
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          downloaded_at?: string | null
          file_name: string
          file_path: string
          id?: string
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          downloaded_at?: string | null
          file_name?: string
          file_path?: string
          id?: string
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_photo_download_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_photo_download_logs_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_photo_hide_requests: {
        Row: {
          created_at: string | null
          customer_id: string
          customer_name: string
          file_name: string
          file_path: string
          id: string
          is_hidden: boolean | null
          requested_at: string | null
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          customer_name: string
          file_name: string
          file_path: string
          id?: string
          is_hidden?: boolean | null
          requested_at?: string | null
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          customer_name?: string
          file_name?: string
          file_path?: string
          id?: string
          is_hidden?: boolean | null
          requested_at?: string | null
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_photo_hide_requests_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_photo_hide_requests_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_photos: {
        Row: {
          created_at: string | null
          description: string | null
          file_name: string
          file_path: string
          file_size: number
          id: string
          is_public: boolean | null
          mime_type: string
          reservation_id: string | null
          share_token: string | null
          thumbnail_path: string | null
          tour_id: string
          updated_at: string | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          file_name: string
          file_path: string
          file_size: number
          id?: string
          is_public?: boolean | null
          mime_type: string
          reservation_id?: string | null
          share_token?: string | null
          thumbnail_path?: string | null
          tour_id: string
          updated_at?: string | null
          uploaded_by: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          is_public?: boolean | null
          mime_type?: string
          reservation_id?: string | null
          share_token?: string | null
          thumbnail_path?: string | null
          tour_id?: string
          updated_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "tour_photos_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_photos_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_photos_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tour_photos_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_reports: {
        Row: {
          activities_completed: string[] | null
          cash_balance: number | null
          comments: string | null
          communication: string | null
          created_at: string | null
          customer_count: number | null
          end_mileage: number | null
          guest_comments: string | null
          id: string
          incidents_delays_health: string[] | null
          lost_items_damage: string[] | null
          main_stops_visited: string[] | null
          office_note: string | null
          overall_mood: string | null
          sign: string | null
          submitted_on: string | null
          suggestions_followup: string | null
          teamwork: string | null
          tour_id: string | null
          updated_at: string | null
          user_email: string
          weather: string | null
        }
        Insert: {
          activities_completed?: string[] | null
          cash_balance?: number | null
          comments?: string | null
          communication?: string | null
          created_at?: string | null
          customer_count?: number | null
          end_mileage?: number | null
          guest_comments?: string | null
          id?: string
          incidents_delays_health?: string[] | null
          lost_items_damage?: string[] | null
          main_stops_visited?: string[] | null
          office_note?: string | null
          overall_mood?: string | null
          sign?: string | null
          submitted_on?: string | null
          suggestions_followup?: string | null
          teamwork?: string | null
          tour_id?: string | null
          updated_at?: string | null
          user_email: string
          weather?: string | null
        }
        Update: {
          activities_completed?: string[] | null
          cash_balance?: number | null
          comments?: string | null
          communication?: string | null
          created_at?: string | null
          customer_count?: number | null
          end_mileage?: number | null
          guest_comments?: string | null
          id?: string
          incidents_delays_health?: string[] | null
          lost_items_damage?: string[] | null
          main_stops_visited?: string[] | null
          office_note?: string | null
          overall_mood?: string | null
          sign?: string | null
          submitted_on?: string | null
          suggestions_followup?: string | null
          teamwork?: string | null
          tour_id?: string | null
          updated_at?: string | null
          user_email?: string
          weather?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_reports_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: false
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_tip_share_ops: {
        Row: {
          created_at: string | null
          id: string
          op_amount: number | null
          op_email: string
          op_percent: number | null
          tour_tip_share_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          op_amount?: number | null
          op_email: string
          op_percent?: number | null
          tour_tip_share_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          op_amount?: number | null
          op_email?: string
          op_percent?: number | null
          tour_tip_share_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_tip_share_ops_op_email_fkey"
            columns: ["op_email"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "tour_tip_share_ops_tour_tip_share_id_fkey"
            columns: ["tour_tip_share_id"]
            isOneToOne: false
            referencedRelation: "tour_tip_shares"
            referencedColumns: ["id"]
          },
        ]
      }
      tour_tip_shares: {
        Row: {
          assistant_amount: number | null
          assistant_email: string | null
          assistant_percent: number | null
          created_at: string | null
          guide_amount: number | null
          guide_email: string | null
          guide_percent: number | null
          id: string
          op_amount: number | null
          op_email: string | null
          op_percent: number | null
          total_tip: number | null
          tour_id: string
          updated_at: string | null
        }
        Insert: {
          assistant_amount?: number | null
          assistant_email?: string | null
          assistant_percent?: number | null
          created_at?: string | null
          guide_amount?: number | null
          guide_email?: string | null
          guide_percent?: number | null
          id?: string
          op_amount?: number | null
          op_email?: string | null
          op_percent?: number | null
          total_tip?: number | null
          tour_id: string
          updated_at?: string | null
        }
        Update: {
          assistant_amount?: number | null
          assistant_email?: string | null
          assistant_percent?: number | null
          created_at?: string | null
          guide_amount?: number | null
          guide_email?: string | null
          guide_percent?: number | null
          id?: string
          op_amount?: number | null
          op_email?: string | null
          op_percent?: number | null
          total_tip?: number | null
          tour_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tour_tip_shares_assistant_email_fkey"
            columns: ["assistant_email"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "tour_tip_shares_guide_email_fkey"
            columns: ["guide_email"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "tour_tip_shares_op_email_fkey"
            columns: ["op_email"]
            isOneToOne: false
            referencedRelation: "team"
            referencedColumns: ["email"]
          },
          {
            foreignKeyName: "tour_tip_shares_tour_id_fkey"
            columns: ["tour_id"]
            isOneToOne: true
            referencedRelation: "tours"
            referencedColumns: ["id"]
          },
        ]
      }
      tours: {
        Row: {
          assignment_status: string | null
          assistant_fee: number | null
          assistant_id: string | null
          created_at: string | null
          guide_fee: number | null
          id: string
          is_private_tour: boolean | null
          max_participants: number
          photos_extended_access: boolean | null
          product_id: string | null
          reservation_ids: string[] | null
          team_type: string | null
          tour_car_id: string | null
          tour_date: string
          tour_end_datetime: string | null
          tour_guide_id: string | null
          tour_note: string | null
          tour_start_datetime: string | null
          tour_status: string | null
          updated_at: string | null
        }
        Insert: {
          assignment_status?: string | null
          assistant_fee?: number | null
          assistant_id?: string | null
          created_at?: string | null
          guide_fee?: number | null
          id?: string
          is_private_tour?: boolean | null
          max_participants?: number
          photos_extended_access?: boolean | null
          product_id?: string | null
          reservation_ids?: string[] | null
          team_type?: string | null
          tour_car_id?: string | null
          tour_date: string
          tour_end_datetime?: string | null
          tour_guide_id?: string | null
          tour_note?: string | null
          tour_start_datetime?: string | null
          tour_status?: string | null
          updated_at?: string | null
        }
        Update: {
          assignment_status?: string | null
          assistant_fee?: number | null
          assistant_id?: string | null
          created_at?: string | null
          guide_fee?: number | null
          id?: string
          is_private_tour?: boolean | null
          max_participants?: number
          photos_extended_access?: boolean | null
          product_id?: string | null
          reservation_ids?: string[] | null
          team_type?: string | null
          tour_car_id?: string | null
          tour_date?: string
          tour_end_datetime?: string | null
          tour_guide_id?: string | null
          tour_note?: string | null
          tour_start_datetime?: string | null
          tour_status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tours_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "tours_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      translation_values: {
        Row: {
          created_at: string | null
          id: string
          locale: string
          notes: string | null
          translation_id: string | null
          updated_at: string | null
          value: string
        }
        Insert: {
          created_at?: string | null
          id: string
          locale: string
          notes?: string | null
          translation_id?: string | null
          updated_at?: string | null
          value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          locale?: string
          notes?: string | null
          translation_id?: string | null
          updated_at?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_values_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_values_translation_id_fkey"
            columns: ["translation_id"]
            isOneToOne: false
            referencedRelation: "translations_with_values"
            referencedColumns: ["id"]
          },
        ]
      }
      translations: {
        Row: {
          created_at: string | null
          id: string
          is_system: boolean | null
          key_path: string
          namespace: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          is_system?: boolean | null
          key_path: string
          namespace: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_system?: boolean | null
          key_path?: string
          namespace?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_customer_links: {
        Row: {
          auth_email: string
          created_at: string | null
          customer_id: string
          id: string
          matched_at: string | null
          matched_by: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth_email: string
          created_at?: string | null
          customer_id: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth_email?: string
          created_at?: string | null
          customer_id?: string
          id?: string
          matched_at?: string | null
          matched_by?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_customer_links_customer"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          is_active: boolean | null
          role_id: string | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          is_active?: boolean | null
          role_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_maintenance: {
        Row: {
          approved_by: string | null
          approved_on: string | null
          category: string
          company_expense_id: string | null
          created_at: string | null
          created_by: string | null
          description: string
          documents: string[] | null
          id: string
          is_scheduled_maintenance: boolean | null
          issues_found: string[] | null
          labor_cost: number | null
          maintenance_date: string
          maintenance_interval: number | null
          maintenance_type: string
          mileage: number | null
          mileage_interval: number | null
          next_maintenance_date: string | null
          next_maintenance_mileage: number | null
          notes: string | null
          other_cost: number | null
          parts_cost: number | null
          parts_cost_breakdown: Json | null
          parts_replaced: string[] | null
          photos: string[] | null
          quality_rating: number | null
          receipts: string[] | null
          recommendations: string[] | null
          satisfaction_rating: number | null
          service_provider: string | null
          service_provider_address: string | null
          service_provider_contact: string | null
          status: string | null
          subcategory: string | null
          technician_notes: string | null
          total_cost: number
          updated_at: string | null
          updated_by: string | null
          vehicle_id: string | null
          warranty_expires: string | null
          warranty_notes: string | null
          warranty_period: number | null
        }
        Insert: {
          approved_by?: string | null
          approved_on?: string | null
          category: string
          company_expense_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description: string
          documents?: string[] | null
          id: string
          is_scheduled_maintenance?: boolean | null
          issues_found?: string[] | null
          labor_cost?: number | null
          maintenance_date: string
          maintenance_interval?: number | null
          maintenance_type: string
          mileage?: number | null
          mileage_interval?: number | null
          next_maintenance_date?: string | null
          next_maintenance_mileage?: number | null
          notes?: string | null
          other_cost?: number | null
          parts_cost?: number | null
          parts_cost_breakdown?: Json | null
          parts_replaced?: string[] | null
          photos?: string[] | null
          quality_rating?: number | null
          receipts?: string[] | null
          recommendations?: string[] | null
          satisfaction_rating?: number | null
          service_provider?: string | null
          service_provider_address?: string | null
          service_provider_contact?: string | null
          status?: string | null
          subcategory?: string | null
          technician_notes?: string | null
          total_cost: number
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
          warranty_expires?: string | null
          warranty_notes?: string | null
          warranty_period?: number | null
        }
        Update: {
          approved_by?: string | null
          approved_on?: string | null
          category?: string
          company_expense_id?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string
          documents?: string[] | null
          id?: string
          is_scheduled_maintenance?: boolean | null
          issues_found?: string[] | null
          labor_cost?: number | null
          maintenance_date?: string
          maintenance_interval?: number | null
          maintenance_type?: string
          mileage?: number | null
          mileage_interval?: number | null
          next_maintenance_date?: string | null
          next_maintenance_mileage?: number | null
          notes?: string | null
          other_cost?: number | null
          parts_cost?: number | null
          parts_cost_breakdown?: Json | null
          parts_replaced?: string[] | null
          photos?: string[] | null
          quality_rating?: number | null
          receipts?: string[] | null
          recommendations?: string[] | null
          satisfaction_rating?: number | null
          service_provider?: string | null
          service_provider_address?: string | null
          service_provider_contact?: string | null
          status?: string | null
          subcategory?: string | null
          technician_notes?: string | null
          total_cost?: number
          updated_at?: string | null
          updated_by?: string | null
          vehicle_id?: string | null
          warranty_expires?: string | null
          warranty_notes?: string | null
          warranty_period?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_maintenance_company_expense_id_fkey"
            columns: ["company_expense_id"]
            isOneToOne: false
            referencedRelation: "company_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vehicle_maintenance_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photo_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          photo_name: string | null
          photo_url: string
          updated_at: string | null
          vehicle_model: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          photo_name?: string | null
          photo_url: string
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          photo_name?: string | null
          photo_url?: string
          updated_at?: string | null
          vehicle_model?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      vehicle_photos: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          photo_name: string | null
          photo_url: string
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_name?: string | null
          photo_url: string
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_name?: string | null
          photo_url?: string
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_vehicle_photos_vehicle_id"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_rental_settings: {
        Row: {
          created_at: string | null
          daily_rental_rate: number
          id: string
          mpg: number
          updated_at: string | null
          vehicle_type: string
        }
        Insert: {
          created_at?: string | null
          daily_rental_rate?: number
          id?: string
          mpg?: number
          updated_at?: string | null
          vehicle_type: string
        }
        Update: {
          created_at?: string | null
          daily_rental_rate?: number
          id?: string
          mpg?: number
          updated_at?: string | null
          vehicle_type?: string
        }
        Relationships: []
      }
      vehicle_type_photos: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_primary: boolean | null
          photo_name: string | null
          photo_url: string
          updated_at: string | null
          vehicle_type_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_name?: string | null
          photo_url: string
          updated_at?: string | null
          vehicle_type_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_primary?: boolean | null
          photo_name?: string | null
          photo_url?: string
          updated_at?: string | null
          vehicle_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_type_photos_vehicle_type_id_fkey"
            columns: ["vehicle_type_id"]
            isOneToOne: false
            referencedRelation: "vehicle_types"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_types: {
        Row: {
          brand: string
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          model: string
          name: string
          passenger_capacity: number
          updated_at: string | null
          vehicle_category: string
        }
        Insert: {
          brand: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          model: string
          name: string
          passenger_capacity: number
          updated_at?: string | null
          vehicle_category?: string
        }
        Update: {
          brand?: string
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          model?: string
          name?: string
          passenger_capacity?: number
          updated_at?: string | null
          vehicle_category?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          additional_payment: number | null
          capacity: number
          color: string | null
          created_at: string | null
          current_mileage: number | null
          daily_rate: number | null
          engine_oil_change_cycle: number | null
          front_tire_size: string | null
          headlight_model: string | null
          headlight_model_name: string | null
          id: string
          installment_amount: number | null
          installment_end_date: string | null
          installment_start_date: string | null
          interest_rate: number | null
          is_installment: boolean | null
          memo: string | null
          mileage_at_purchase: number | null
          monthly_payment: number | null
          payment_due_date: string | null
          purchase_amount: number | null
          purchase_date: string | null
          rear_tire_size: string | null
          recent_engine_oil_change_mileage: number | null
          rental_company: string | null
          rental_end_date: string | null
          rental_notes: string | null
          rental_pickup_location: string | null
          rental_return_location: string | null
          rental_start_date: string | null
          rental_total_cost: number | null
          status: string
          updated_at: string | null
          vehicle_category: string | null
          vehicle_image_url: string | null
          vehicle_number: string
          vehicle_type: string
          vin: string | null
          windshield_wiper_size: string | null
          year: number | null
        }
        Insert: {
          additional_payment?: number | null
          capacity: number
          color?: string | null
          created_at?: string | null
          current_mileage?: number | null
          daily_rate?: number | null
          engine_oil_change_cycle?: number | null
          front_tire_size?: string | null
          headlight_model?: string | null
          headlight_model_name?: string | null
          id?: string
          installment_amount?: number | null
          installment_end_date?: string | null
          installment_start_date?: string | null
          interest_rate?: number | null
          is_installment?: boolean | null
          memo?: string | null
          mileage_at_purchase?: number | null
          monthly_payment?: number | null
          payment_due_date?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          rear_tire_size?: string | null
          recent_engine_oil_change_mileage?: number | null
          rental_company?: string | null
          rental_end_date?: string | null
          rental_notes?: string | null
          rental_pickup_location?: string | null
          rental_return_location?: string | null
          rental_start_date?: string | null
          rental_total_cost?: number | null
          status?: string
          updated_at?: string | null
          vehicle_category?: string | null
          vehicle_image_url?: string | null
          vehicle_number?: string
          vehicle_type: string
          vin?: string | null
          windshield_wiper_size?: string | null
          year?: number | null
        }
        Update: {
          additional_payment?: number | null
          capacity?: number
          color?: string | null
          created_at?: string | null
          current_mileage?: number | null
          daily_rate?: number | null
          engine_oil_change_cycle?: number | null
          front_tire_size?: string | null
          headlight_model?: string | null
          headlight_model_name?: string | null
          id?: string
          installment_amount?: number | null
          installment_end_date?: string | null
          installment_start_date?: string | null
          interest_rate?: number | null
          is_installment?: boolean | null
          memo?: string | null
          mileage_at_purchase?: number | null
          monthly_payment?: number | null
          payment_due_date?: string | null
          purchase_amount?: number | null
          purchase_date?: string | null
          rear_tire_size?: string | null
          recent_engine_oil_change_mileage?: number | null
          rental_company?: string | null
          rental_end_date?: string | null
          rental_notes?: string | null
          rental_pickup_location?: string | null
          rental_return_location?: string | null
          rental_start_date?: string | null
          rental_status?: string | null
          rental_total_cost?: number | null
          updated_at?: string | null
          vehicle_category?: string | null
          vehicle_image_url?: string | null
          vehicle_number?: string
          vehicle_status?: string | null
          vehicle_type?: string
          vin?: string | null
          windshield_wiper_size?: string | null
          year?: number | null
        }
        Relationships: []
      }
      weather_data: {
        Row: {
          created_at: string | null
          date: string
          humidity: number | null
          id: string
          latitude: number
          location_name: string
          longitude: number
          temp_max: number | null
          temp_min: number | null
          temperature: number | null
          updated_at: string | null
          visibility: number | null
          weather_description: string | null
          weather_main: string | null
          wind_speed: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          humidity?: number | null
          id?: string
          latitude: number
          location_name: string
          longitude: number
          temp_max?: number | null
          temp_min?: number | null
          temperature?: number | null
          updated_at?: string | null
          visibility?: number | null
          weather_description?: string | null
          weather_main?: string | null
          wind_speed?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          humidity?: number | null
          id?: string
          latitude?: number
          location_name?: string
          longitude?: number
          temp_max?: number | null
          temp_min?: number | null
          temperature?: number | null
          updated_at?: string | null
          visibility?: number | null
          weather_description?: string | null
          weather_main?: string | null
          wind_speed?: number | null
        }
        Relationships: []
      },
      company_sop_versions: {
        Row: {
          id: string
          version_number: number
          title: string
          body_md: string | null
          body_structure: Json | null
          published_at: string
          published_by: string | null
        }
        Insert: {
          id?: string
          version_number: number
          title?: string
          body_md?: string | null
          body_structure?: Json | null
          published_at?: string
          published_by?: string | null
        }
        Update: {
          id?: string
          version_number?: number
          title?: string
          body_md?: string | null
          body_structure?: Json | null
          published_at?: string
          published_by?: string | null
        }
        Relationships: []
      },
      company_employee_contract_versions: {
        Row: {
          id: string
          version_number: number
          title: string
          body_md: string | null
          body_structure: Json | null
          published_at: string
          published_by: string | null
        }
        Insert: {
          id?: string
          version_number: number
          title?: string
          body_md?: string | null
          body_structure?: Json | null
          published_at?: string
          published_by?: string | null
        }
        Update: {
          id?: string
          version_number?: number
          title?: string
          body_md?: string | null
          body_structure?: Json | null
          published_at?: string
          published_by?: string | null
        }
        Relationships: []
      },
      company_sop_draft: {
        Row: {
          singleton: number
          body_structure: Json
          paste_raw: string
          edit_locale: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          singleton: number
          body_structure: Json
          paste_raw?: string
          edit_locale?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          singleton?: number
          body_structure?: Json
          paste_raw?: string
          edit_locale?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      },
      company_employee_contract_draft: {
        Row: {
          singleton: number
          body_structure: Json
          paste_raw: string
          edit_locale: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          singleton: number
          body_structure: Json
          paste_raw?: string
          edit_locale?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          singleton?: number
          body_structure?: Json
          paste_raw?: string
          edit_locale?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      },
      sop_signatures: {
        Row: {
          id: string
          version_id: string
          user_id: string
          signer_email: string
          signer_name: string
          pdf_storage_path: string
          signed_at: string
        }
        Insert: {
          id?: string
          version_id: string
          user_id: string
          signer_email: string
          signer_name: string
          pdf_storage_path: string
          signed_at?: string
        }
        Update: {
          id?: string
          version_id?: string
          user_id?: string
          signer_email?: string
          signer_name?: string
          pdf_storage_path?: string
          signed_at?: string
        }
        Relationships: []
      },
      employee_contract_signatures: {
        Row: {
          id: string
          version_id: string
          user_id: string
          signer_email: string
          signer_name: string
          pdf_storage_path: string
          signed_at: string
        }
        Insert: {
          id?: string
          version_id: string
          user_id: string
          signer_email: string
          signer_name: string
          pdf_storage_path: string
          signed_at?: string
        }
        Update: {
          id?: string
          version_id?: string
          user_id?: string
          signer_email?: string
          signer_name?: string
          pdf_storage_path?: string
          signed_at?: string
        }
        Relationships: []
      },
      staff_push_subscriptions: {
        Row: {
          id: string
          user_id: string
          user_email: string
          endpoint: string
          p256dh_key: string
          auth_key: string
          language: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          user_email: string
          endpoint: string
          p256dh_key: string
          auth_key: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          user_email?: string
          endpoint?: string
          p256dh_key?: string
          auth_key?: string
          language?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      audit_logs_view: {
        Row: {
          action: string | null
          changed_fields: string[] | null
          created_at: string | null
          id: string | null
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          record_id: string | null
          record_name: string | null
          table_name: string | null
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string | null
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_name?: never
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          changed_fields?: string[] | null
          created_at?: string | null
          id?: string | null
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          record_id?: string | null
          record_name?: never
          table_name?: string | null
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      cash_balance: {
        Row: {
          balance: number | null
        }
        Relationships: []
      }
      channels_with_sub_channels: {
        Row: {
          base_price: number | null
          category: string | null
          commission: number | null
          created_at: string | null
          description: string | null
          id: string | null
          markup: number | null
          name: string | null
          status: string | null
          sub_channel_count: number | null
          sub_channels: string[] | null
          type: string | null
          website: string | null
        }
        Insert: {
          base_price?: number | null
          category?: string | null
          commission?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          markup?: number | null
          name?: string | null
          status?: string | null
          sub_channel_count?: never
          sub_channels?: string[] | null
          type?: string | null
          website?: string | null
        }
        Update: {
          base_price?: number | null
          category?: string | null
          commission?: number | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          markup?: number | null
          name?: string | null
          status?: string | null
          sub_channel_count?: never
          sub_channels?: string[] | null
          type?: string | null
          website?: string | null
        }
        Relationships: []
      }
      choice_templates: {
        Row: {
          adult_price: number | null
          category: string | null
          child_price: number | null
          choice_type: string | null
          created_at: string | null
          description: string | null
          id: string | null
          infant_price: number | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string | null
          name_ko: string | null
          price_type: string | null
          sort_order: number | null
          status: string | null
          tags: string[] | null
          template_group: string | null
          template_group_ko: string | null
        }
        Insert: {
          adult_price?: number | null
          category?: string | null
          child_price?: number | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          infant_price?: number | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string | null
          name_ko?: string | null
          price_type?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_ko?: string | null
        }
        Update: {
          adult_price?: number | null
          category?: string | null
          child_price?: number | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          infant_price?: number | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string | null
          name_ko?: string | null
          price_type?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_ko?: string | null
        }
        Relationships: []
      }
      current_guide_costs: {
        Row: {
          assistant_fee: number | null
          created_at: string | null
          driver_fee: number | null
          effective_from: string | null
          effective_to: string | null
          guide_fee: number | null
          product_id: string | null
          product_name: string | null
          sub_category: string | null
          team_type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      current_reservation_status: {
        Row: {
          has_options: number | null
          no_options: number | null
          product_id: string | null
          total_reservations: number | null
        }
        Relationships: []
      }
      dynamic_pricing_choices_view: {
        Row: {
          adult_price: number | null
          channel_id: string | null
          child_price: number | null
          choice_id: string | null
          choice_name: string | null
          choices_pricing: Json | null
          commission_percent: number | null
          date: string | null
          infant_price: number | null
          option_adult_price: number | null
          option_child_price: number | null
          option_id: string | null
          option_infant_price: number | null
          option_name: string | null
          option_name_ko: string | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dynamic_pricing_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_pricing_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels_with_sub_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dynamic_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "dynamic_pricing_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invalid_product_id_report: {
        Row: {
          old_product_id: string | null
          reservation_count: number | null
          suggested_new_product_id: string | null
          suggested_product_name: string | null
          suggestion_status: string | null
        }
        Relationships: []
      }
      migration_results: {
        Row: {
          count: number | null
          product_id: string | null
          status: string | null
        }
        Relationships: []
      }
      option_migration_results: {
        Row: {
          assigned_option: string | null
          id: string | null
          product_id: string | null
          selected_options: Json | null
        }
        Relationships: []
      }
      options_with_images: {
        Row: {
          adult_price: number | null
          category: string | null
          child_price: number | null
          choice_type: string | null
          created_at: string | null
          description: string | null
          id: string | null
          image_alt: string | null
          image_order: number | null
          image_url: string | null
          infant_price: number | null
          is_choice_template: boolean | null
          is_required: boolean | null
          max_selections: number | null
          min_selections: number | null
          name: string | null
          name_ko: string | null
          price_type: string | null
          sort_order: number | null
          status: string | null
          tags: string[] | null
          template_group: string | null
          template_group_ko: string | null
          thumbnail_url: string | null
        }
        Insert: {
          adult_price?: number | null
          category?: string | null
          child_price?: number | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_alt?: string | null
          image_order?: number | null
          image_url?: string | null
          infant_price?: number | null
          is_choice_template?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string | null
          name_ko?: string | null
          price_type?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_ko?: string | null
          thumbnail_url?: string | null
        }
        Update: {
          adult_price?: number | null
          category?: string | null
          child_price?: number | null
          choice_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string | null
          image_alt?: string | null
          image_order?: number | null
          image_url?: string | null
          infant_price?: number | null
          is_choice_template?: boolean | null
          is_required?: boolean | null
          max_selections?: number | null
          min_selections?: number | null
          name?: string | null
          name_ko?: string | null
          price_type?: string | null
          sort_order?: number | null
          status?: string | null
          tags?: string[] | null
          template_group?: string | null
          template_group_ko?: string | null
          thumbnail_url?: string | null
        }
        Relationships: []
      }
      product_id_analysis: {
        Row: {
          channels: string[] | null
          product_id: string | null
          reservation_count: number | null
          statuses: string[] | null
        }
        Relationships: []
      }
      product_options_check: {
        Row: {
          id: string | null
          is_multiple: boolean | null
          is_required: boolean | null
          name: string | null
          product_id: string | null
          product_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_options_new_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "current_guide_costs"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_options_new_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_choices_view: {
        Row: {
          adult_price: number | null
          capacity: number | null
          child_price: number | null
          choice_group: string | null
          choice_group_ko: string | null
          choice_type: string | null
          id: string | null
          infant_price: number | null
          is_required: boolean | null
          option_key: string | null
          option_name: string | null
          option_name_ko: string | null
          quantity: number | null
          reservation_id: string | null
          total_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservation_choices_with_names: {
        Row: {
          adult_price: number | null
          child_price: number | null
          choice_group: string | null
          choice_group_en: string | null
          choice_group_ko: string | null
          choice_id: string | null
          infant_price: number | null
          option_id: string | null
          option_key: string | null
          option_name: string | null
          option_name_ko: string | null
          quantity: number | null
          reservation_id: string | null
          total_price: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservation_choices_choice_id_fkey"
            columns: ["choice_id"]
            isOneToOne: false
            referencedRelation: "product_choices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "choice_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "option_migration_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reservation_choices_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations_with_invalid_products"
            referencedColumns: ["id"]
          },
        ]
      }
      reservations_with_invalid_products: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string | null
          product_id: string | null
          product_status: string | null
          status: string | null
          tour_date: string | null
        }
        Relationships: []
      }
      tags_with_translations: {
        Row: {
          id: string | null
          is_system: boolean | null
          key: string | null
          label: string | null
          locale: string | null
          notes: string | null
          pronunciation: string | null
          tag_created_at: string | null
          translation_updated_at: string | null
        }
        Relationships: []
      }
      translations_with_values: {
        Row: {
          id: string | null
          is_system: boolean | null
          key_path: string | null
          locale: string | null
          namespace: string | null
          notes: string | null
          translation_created_at: string | null
          value: string | null
          value_updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_default_announcements_to_existing_rooms: {
        Args: never
        Returns: undefined
      }
      add_required_option_to_selected_options: {
        Args: {
          option_name: string
          product_id: string
          reservation_id: string
        }
        Returns: boolean
      }
      batch_update_invalid_product_ids: {
        Args: never
        Returns: {
          new_product_id: string
          old_product_id: string
          updated_count: number
        }[]
      }
      build_choices_pricing_key: {
        Args: { p_choice_group_key: string; p_option_key: string }
        Returns: string
      }
      calculate_accommodation_total: {
        Args: {
          adults: number
          children: number
          infants: number
          selections: Json
        }
        Returns: number
      }
      calculate_dynamic_price: {
        Args: {
          p_adults?: number
          p_channel_id: string
          p_children?: number
          p_date: string
          p_infants?: number
          p_product_id: string
          p_selected_additional_options?: Json
          p_selected_choices?: Json
        }
        Returns: {
          additional_options_price: number
          base_price: number
          calculation_method: string
          choices_price: number
          total_price: number
        }[]
      }
      calculate_expiry_date: {
        Args: { issue_date: string; validity_period_months?: number }
        Returns: string
      }
      calculate_monthly_attendance_stats: {
        Args: { p_employee_email: string; p_month: string }
        Returns: undefined
      }
      calculate_reservation_choices_total: {
        Args: { reservation_id_param: string }
        Returns: number
      }
      can_manage_data: { Args: { p_email: string }; Returns: boolean }
      cleanup_unused_images: { Args: never; Returns: number }
      complete_workflow_step:
        | {
            Args: {
              p_execution_id: string
              p_output_data?: Json
              p_result: string
              p_step_id: string
            }
            Returns: string
          }
        | {
            Args: {
              p_condition_data?: Json
              p_execution_id: string
              p_output_data?: Json
              p_result: string
              p_step_id: string
            }
            Returns: string
          }
      copy_template_to_product: {
        Args: {
          p_is_required?: boolean
          p_product_id: string
          p_template_group: string
        }
        Returns: number
      }
      create_tour_folder: { Args: { tour_id_param: string }; Returns: boolean }
      create_tour_photo_bucket: {
        Args: { tour_id_param: string }
        Returns: boolean
      }
      create_tour_photos_bucket: { Args: never; Returns: boolean }
      current_email: { Args: never; Returns: string }
      evaluate_workflow_condition: {
        Args: { p_condition_data?: Json; p_step_id: string }
        Returns: boolean
      }
      generate_monthly_stats:
        | {
            Args: { p_employee_email: string; p_month: string }
            Returns: undefined
          }
        | {
            Args: { p_employee_email: string; p_month: string }
            Returns: undefined
          }
      generate_thumbnail_url: {
        Args: { original_url: string }
        Returns: string
      }
      generate_unique_vehicle_number: { Args: never; Returns: string }
      get_all_tables: {
        Args: never
        Returns: {
          table_name: string
          table_type: string
        }[]
      }
      get_current_guide_costs: {
        Args: { p_date?: string; p_product_id: string; p_team_type: string }
        Returns: {
          assistant_fee: number
          driver_fee: number
          effective_from: string
          effective_to: string
          guide_fee: number
        }[]
      }
      get_image_stats: {
        Args: never
        Returns: {
          category_stats: Json
          options_with_images: number
          options_without_images: number
          total_options: number
        }[]
      }
      get_product_option_id: {
        Args: { option_name: string; product_id: string }
        Returns: string
      }
      get_reservation_choices_json: {
        Args: { reservation_id_param: string }
        Returns: Json
      }
      get_storage_stats: {
        Args: never
        Returns: {
          files_by_folder: Json
          total_files: number
          total_size: number
        }[]
      }
      get_team_member_info: {
        Args: { p_email: string }
        Returns: {
          email: string
          is_active: boolean
          name_en: string
          name_ko: string
        }[]
      }
      get_team_members_info: {
        Args: { p_emails: string[] }
        Returns: {
          email: string
          is_active: boolean
          name_en: string
          name_ko: string
        }[]
      }
      get_tour_folders: {
        Args: never
        Returns: {
          file_count: number
          folder_path: string
          last_modified: string
          total_size: number
        }[]
      }
      get_user_role_by_email: {
        Args: { user_email: string }
        Returns: {
          permissions: string[]
          role_name: string
        }[]
      }
      has_user_permission: {
        Args: { permission_name: string; user_email: string }
        Returns: boolean
      }
      increment_template_usage: {
        Args: { template_id: string }
        Returns: undefined
      }
      is_admin_user: { Args: { p_email: string }; Returns: boolean }
      is_current_user_team_member: { Args: never; Returns: boolean }
      is_staff:
        | { Args: never; Returns: boolean }
        | { Args: { p_email: string }; Returns: boolean }
      is_super_admin: { Args: { p_email?: string }; Returns: boolean }
      is_team_member: { Args: { p_email: string }; Returns: boolean }
      manual_reset_todos: { Args: { category_name: string }; Returns: string }
      map_product_id: { Args: { old_product_id: string }; Returns: string }
      migrate_choices_pricing_keys: {
        Args: never
        Returns: {
          channel_id: string
          date: string
          migrated: boolean
          new_keys_count: number
          old_keys_count: number
          product_id: string
        }[]
      }
      migrate_dynamic_pricing_to_choices: {
        Args: never
        Returns: {
          channel_id: string
          date: string
          new_choices_pricing: Json
          old_options_pricing: Json
          product_id: string
          updated: boolean
        }[]
      }
      migrate_existing_choices_to_simple: {
        Args: never
        Returns: Record<string, unknown>[]
      }
      migrate_existing_reservation_choices_to_simple: {
        Args: never
        Returns: Record<string, unknown>[]
      }
      migrate_product_ids: {
        Args: never
        Returns: {
          new_product_id: string
          old_product_id: string
          option_name: string
          updated_count: number
        }[]
      }
      repair_reservation_choices: {
        Args: never
        Returns: {
          error_count: number
          repaired_count: number
          reservation_id: string
        }[]
      }
      reset_all_todos: { Args: never; Returns: undefined }
      reset_daily_todos: { Args: never; Returns: undefined }
      reset_daily_usage: { Args: never; Returns: undefined }
      reset_monthly_todos: { Args: never; Returns: undefined }
      reset_monthly_usage: { Args: never; Returns: undefined }
      reset_weekly_todos: { Args: never; Returns: undefined }
      reset_yearly_todos: { Args: never; Returns: undefined }
      set_product_guide_costs: {
        Args: {
          p_assistant_fee: number
          p_driver_fee: number
          p_effective_from: string
          p_effective_to?: string
          p_guide_fee: number
          p_product_id: string
          p_team_type: string
        }
        Returns: string
      }
      start_workflow_execution: {
        Args: { p_consultation_log_id: string; p_workflow_id: string }
        Returns: string
      }
      update_payment_method_usage: {
        Args: { p_amount: number; p_method_id: string }
        Returns: undefined
      }
      update_product_id_mapping: {
        Args: { new_id: string; old_id: string }
        Returns: number
      }
      validate_accommodation_capacity: {
        Args: { selections: Json; total_people: number }
        Returns: boolean
      }
      validate_image_url: { Args: { url: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
