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
          id: string
          is_admin_override: boolean
          late_cancellation: boolean
          notes: string | null
          session_slot_id: string
          status: string
          student_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          is_admin_override?: boolean
          late_cancellation?: boolean
          notes?: string | null
          session_slot_id: string
          status?: string
          student_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          id?: string
          is_admin_override?: boolean
          late_cancellation?: boolean
          notes?: string | null
          session_slot_id?: string
          status?: string
          student_id?: string
        }
        Relationships: [
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
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          timezone: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          role?: string
          timezone?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
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
      cancel_my_booking: { Args: { p_booking_id: string }; Returns: undefined }
      is_admin: { Args: never; Returns: boolean }
      request_individual_booking: { Args: { p_end: string; p_start: string }; Returns: string }
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
