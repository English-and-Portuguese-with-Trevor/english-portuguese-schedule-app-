export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      availability_rules: {
        Row: {
          created_at: string
          created_by: string
          day_of_week: number
          end_time: string
          id: string
          is_active: boolean
          slot_duration_minutes: number
          start_time: string
          timezone: string
        }
        Insert: {
          created_at?: string
          created_by: string
          day_of_week: number
          end_time: string
          id?: string
          is_active?: boolean
          slot_duration_minutes?: number
          start_time: string
          timezone?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          day_of_week?: number
          end_time?: string
          id?: string
          is_active?: boolean
          slot_duration_minutes?: number
          start_time?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          google_event_id: string | null
          id: string
          is_admin_override: boolean
          late_cancellation: boolean
          lesson_language: string | null
          meet_link: string | null
          notes: string | null
          reminder_sent_at: string | null
          reschedule_of: string | null
          session_slot_id: string
          status: string
          student_id: string
          student_timezone: string | null
          whatsapp: string | null
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          is_admin_override?: boolean
          late_cancellation?: boolean
          lesson_language?: string | null
          meet_link?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          reschedule_of?: string | null
          session_slot_id: string
          status?: string
          student_id: string
          student_timezone?: string | null
          whatsapp?: string | null
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          google_event_id?: string | null
          id?: string
          is_admin_override?: boolean
          late_cancellation?: boolean
          lesson_language?: string | null
          meet_link?: string | null
          notes?: string | null
          reminder_sent_at?: string | null
          reschedule_of?: string | null
          session_slot_id?: string
          status?: string
          student_id?: string
          student_timezone?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_reschedule_of_fkey"
            columns: ["reschedule_of"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_session_slot_id_fkey"
            columns: ["session_slot_id"]
            isOneToOne: false
            referencedRelation: "session_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      card_progress: {
        Row: {
          card_id: string
          deck_id: string
          known: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          deck_id: string
          known?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          deck_id?: string
          known?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "card_progress_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      combos: {
        Row: {
          deck_ids: string[]
          id: string
          is_public: boolean
          labels: Json
          name: string
          owner_id: string | null
        }
        Insert: {
          deck_ids?: string[]
          id?: string
          is_public?: boolean
          labels?: Json
          name: string
          owner_id?: string | null
        }
        Update: {
          deck_ids?: string[]
          id?: string
          is_public?: boolean
          labels?: Json
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      decks: {
        Row: {
          cards: Json
          id: string
          is_public: boolean
          language: string
          name: string
          owner_id: string | null
        }
        Insert: {
          cards?: Json
          id?: string
          is_public?: boolean
          language: string
          name: string
          owner_id?: string | null
        }
        Update: {
          cards?: Json
          id?: string
          is_public?: boolean
          language?: string
          name?: string
          owner_id?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          deck_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_status: {
        Row: { checked_at: string; message: string | null; ok: boolean; service: string }
        Insert: { checked_at?: string; message?: string | null; ok: boolean; service: string }
        Update: { checked_at?: string; message?: string | null; ok?: boolean; service?: string }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          lesson_access: string
          phone: string | null
          role: string
          timezone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          lesson_access?: string
          phone?: string | null
          role?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          lesson_access?: string
          phone?: string | null
          role?: string
          timezone?: string
        }
        Relationships: []
      }
      session_slots: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_slots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_agenda: {
        Args: { p_secret: string }
        Returns: {
          booking_id: string
          status: string
          start_time: string
          end_time: string
          student_name: string | null
          student_email: string | null
          student_timezone: string | null
          meet_link: string | null
          lesson_language: string | null
          whatsapp: string | null
          reschedule_from: string | null
        }[]
      }
      admin_timezone: { Args: never; Returns: string }
      cancel_my_booking: { Args: { p_booking_id: string }; Returns: undefined }
      claim_student_reminders: {
        Args: { p_secret: string }
        Returns: {
          booking_id: string
          start_time: string
          end_time: string
          student_name: string | null
          student_email: string | null
          student_timezone: string | null
          meet_link: string | null
        }[]
      }
      record_integration_status: {
        Args: { p_message: string; p_ok: boolean; p_secret: string; p_service: string }
        Returns: undefined
      }
      request_reschedule: {
        Args: { p_booking_id: string; p_end: string; p_start: string; p_timezone?: string }
        Returns: string
      }
      set_my_timezone: { Args: { p_timezone: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      request_individual_booking: {
        Args: { p_end: string; p_language?: string; p_start: string; p_timezone?: string; p_whatsapp?: string }
        Returns: string
      }
      set_booking_meeting: {
        Args: { p_booking_id: string; p_event_id: string; p_meet_link: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database["public"]

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"]
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"]
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"]
