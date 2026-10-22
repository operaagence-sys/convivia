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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          failed_logins: number
          full_name: string
          is_active: boolean
          last_login_at: string | null
          locked_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          failed_logins?: number
          full_name: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          failed_logins?: number
          full_name?: string
          is_active?: boolean
          last_login_at?: string | null
          locked_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          city: string | null
          country_code: string | null
          event_ref: string | null
          event_type: Database["public"]["Enums"]["event_type"] | null
          id: number
          invitation_ref: string | null
          name: string
          occurred_at: string
          organizer_ref: string | null
          properties: Json
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          event_ref?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: never
          invitation_ref?: string | null
          name: string
          occurred_at?: string
          organizer_ref?: string | null
          properties?: Json
        }
        Update: {
          city?: string | null
          country_code?: string | null
          event_ref?: string | null
          event_type?: Database["public"]["Enums"]["event_type"] | null
          id?: never
          invitation_ref?: string | null
          name?: string
          occurred_at?: string
          organizer_ref?: string | null
          properties?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_kind: string
          details: Json
          id: number
          ip_hash: string | null
          occurred_at: string
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_kind: string
          details?: Json
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_kind?: string
          details?: Json
          id?: never
          ip_hash?: string | null
          occurred_at?: string
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          code: string
          created_at: string
          dial_code: string
          is_active: boolean
          name: string
          timezone: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          dial_code: string
          is_active?: boolean
          name: string
          timezone: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          dial_code?: string
          is_active?: boolean
          name?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      fx_rates: {
        Row: {
          created_at: string
          created_by: string | null
          month: string
          usd_xof: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          month: string
          usd_xof: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          month?: string
          usd_xof?: number
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          code_expires_at: string | null
          code_hmac: string | null
          created_at: string
          failed_count: number
          identifier_hash: string
          locked_until: string | null
          send_times: string[]
          updated_at: string
        }
        Insert: {
          code_expires_at?: string | null
          code_hmac?: string | null
          created_at?: string
          failed_count?: number
          identifier_hash: string
          locked_until?: string | null
          send_times?: string[]
          updated_at?: string
        }
        Update: {
          code_expires_at?: string | null
          code_hmac?: string | null
          created_at?: string
          failed_count?: number
          identifier_hash?: string
          locked_until?: string | null
          send_times?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      login_code_global_counter: {
        Row: {
          cap_alerted_at: string | null
          created_at: string
          id: boolean
          issue_times: string[]
          updated_at: string
        }
        Insert: {
          cap_alerted_at?: string | null
          created_at?: string
          id?: boolean
          issue_times?: string[]
          updated_at?: string
        }
        Update: {
          cap_alerted_at?: string | null
          created_at?: string
          id?: boolean
          issue_times?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      login_ip_attempts: {
        Row: {
          action: string
          attempt_times: string[]
          created_at: string
          ip_hash: string
          ip_scope: string
          updated_at: string
        }
        Insert: {
          action: string
          attempt_times?: string[]
          created_at?: string
          ip_hash: string
          ip_scope: string
          updated_at?: string
        }
        Update: {
          action?: string
          attempt_times?: string[]
          created_at?: string
          ip_hash?: string
          ip_scope?: string
          updated_at?: string
        }
        Relationships: []
      }
      organizers: {
        Row: {
          city: string | null
          country_code: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["organizer_status"]
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["organizer_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          country_code?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["organizer_status"]
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organizers_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "organizers_suspended_by_fkey"
            columns: ["suspended_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["user_id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      pricing_tiers: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          seats: number
          total_price: number
          unit_price: number
          valid_from: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          seats: number
          total_price?: number
          unit_price: number
          valid_from?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          seats?: number
          total_price?: number
          unit_price?: number
          valid_from?: string
        }
        Relationships: []
      }
      whatsapp_rates: {
        Row: {
          category: Database["public"]["Enums"]["wa_category"]
          created_at: string
          created_by: string | null
          id: string
          price_usd_micros: number
          pricing_zone: string
          valid_from: string
        }
        Insert: {
          category: Database["public"]["Enums"]["wa_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          price_usd_micros: number
          pricing_zone: string
          valid_from: string
        }
        Update: {
          category?: Database["public"]["Enums"]["wa_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          price_usd_micros?: number
          pricing_zone?: string
          valid_from?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          category: Database["public"]["Enums"]["wa_category"]
          created_at: string
          meta_status: string
          name: string
          quality: string | null
          updated_at: string
        }
        Insert: {
          category: Database["public"]["Enums"]["wa_category"]
          created_at?: string
          meta_status: string
          name: string
          quality?: string | null
          updated_at?: string
        }
        Update: {
          category?: Database["public"]["Enums"]["wa_category"]
          created_at?: string
          meta_status?: string
          name?: string
          quality?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_email_is_admin: { Args: { p_email: string }; Returns: boolean }
      ensure_organizer: {
        Args: { p_user_id: string }
        Returns: {
          created: boolean
          organizer_status: Database["public"]["Enums"]["organizer_status"]
          profile_complete: boolean
        }[]
      }
      login_code_issue: {
        Args: {
          p_code_hmac: string
          p_email: string
          p_identifier_hash: string
          p_ip_hash: string
          p_ip48_hash: string
        }
        Returns: {
          allowed: boolean
          deliver: boolean
          reason: string
          retry_at: string
        }[]
      }
      login_code_verify: {
        Args: {
          p_code_hmac: string
          p_email: string
          p_identifier_hash: string
          p_ip_hash: string
          p_ip48_hash: string
        }
        Returns: {
          result: string
          retry_at: string
        }[]
      }
    }
    Enums: {
      admin_role:
        | "super_admin"
        | "marketing"
        | "finance"
        | "support"
        | "content"
      billing_status: "unpaid" | "trial" | "paid"
      check_in_result:
        | "admitted"
        | "partial"
        | "already_in"
        | "refused_main_absent"
        | "refused_strict"
        | "refused_other_event"
        | "invalid"
      check_in_who: "both" | "main" | "companion"
      event_type:
        | "wedding"
        | "dowry"
        | "baptism"
        | "birthday"
        | "baby_presentation"
        | "other"
      invitation_kind: "single" | "plus_one"
      optout_source: "button" | "stop_reply" | "blocked"
      organizer_status: "active" | "suspended"
      payment_kind: "initial" | "upgrade" | "extra_seats" | "quote"
      payment_status: "pending" | "approved" | "declined" | "canceled"
      promo_kind: "percent" | "fixed" | "tracking_only"
      quote_status: "pending" | "quoted" | "paid" | "canceled"
      refund_mode: "fedapay_dashboard" | "manual_transfer"
      refund_status: "recorded" | "executed"
      rsvp_source: "guest" | "check_in"
      rsvp_status: "pending" | "accepted" | "declined"
      schedule_kind: "bulk_send" | "reminder_auto" | "event_update"
      schedule_status: "pending" | "done" | "canceled"
      table_naming: "named" | "numbered"
      wa_category: "marketing" | "utility" | "authentication" | "service"
      wa_purpose:
        | "invitation"
        | "invitation_resend"
        | "ticket"
        | "reminder_auto"
        | "reminder_manual"
        | "event_update"
        | "thank_you"
        | "host_message"
        | "login_code"
        | "auto_reply"
      wa_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
        | "canceled"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      admin_role: ["super_admin", "marketing", "finance", "support", "content"],
      billing_status: ["unpaid", "trial", "paid"],
      check_in_result: [
        "admitted",
        "partial",
        "already_in",
        "refused_main_absent",
        "refused_strict",
        "refused_other_event",
        "invalid",
      ],
      check_in_who: ["both", "main", "companion"],
      event_type: [
        "wedding",
        "dowry",
        "baptism",
        "birthday",
        "baby_presentation",
        "other",
      ],
      invitation_kind: ["single", "plus_one"],
      optout_source: ["button", "stop_reply", "blocked"],
      organizer_status: ["active", "suspended"],
      payment_kind: ["initial", "upgrade", "extra_seats", "quote"],
      payment_status: ["pending", "approved", "declined", "canceled"],
      promo_kind: ["percent", "fixed", "tracking_only"],
      quote_status: ["pending", "quoted", "paid", "canceled"],
      refund_mode: ["fedapay_dashboard", "manual_transfer"],
      refund_status: ["recorded", "executed"],
      rsvp_source: ["guest", "check_in"],
      rsvp_status: ["pending", "accepted", "declined"],
      schedule_kind: ["bulk_send", "reminder_auto", "event_update"],
      schedule_status: ["pending", "done", "canceled"],
      table_naming: ["named", "numbered"],
      wa_category: ["marketing", "utility", "authentication", "service"],
      wa_purpose: [
        "invitation",
        "invitation_resend",
        "ticket",
        "reminder_auto",
        "reminder_manual",
        "event_update",
        "thank_you",
        "host_message",
        "login_code",
        "auto_reply",
      ],
      wa_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
        "canceled",
      ],
    },
  },
} as const
