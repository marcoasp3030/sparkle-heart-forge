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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          type?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_branding: {
        Row: {
          company_id: string
          created_at: string
          favicon_url: string | null
          id: string
          login_bg_url: string | null
          login_subtitle: string | null
          login_title: string | null
          logo_url: string | null
          platform_name: string | null
          sidebar_logo_url: string | null
          theme_colors: Json | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          login_bg_url?: string | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          platform_name?: string | null
          sidebar_logo_url?: string | null
          theme_colors?: Json | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          favicon_url?: string | null
          id?: string
          login_bg_url?: string | null
          login_subtitle?: string | null
          login_title?: string | null
          logo_url?: string | null
          platform_name?: string | null
          sidebar_logo_url?: string | null
          theme_colors?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_branding_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_notification_templates: {
        Row: {
          active: boolean
          channel: string
          company_id: string
          created_at: string
          footer: string | null
          id: string
          template_text: string
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel?: string
          company_id: string
          created_at?: string
          footer?: string | null
          id?: string
          template_text?: string
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: string
          company_id?: string
          created_at?: string
          footer?: string | null
          id?: string
          template_text?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_notification_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_permissions: {
        Row: {
          company_id: string
          created_at: string
          enabled: boolean
          id: string
          permission: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          permission: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          permission?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_permissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_whatsapp: {
        Row: {
          company_id: string
          created_at: string
          id: string
          instance_name: string
          instance_token: string | null
          phone_number: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          phone_number?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          instance_name?: string
          instance_token?: string | null
          phone_number?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_whatsapp_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      departamentos: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departamentos_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      funcionarios_clientes: {
        Row: {
          ativo: boolean
          cargo: string | null
          company_id: string
          created_at: string
          departamento_id: string | null
          email: string | null
          id: string
          matricula: string | null
          nome: string
          setor_id: string | null
          telefone: string | null
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          ativo?: boolean
          cargo?: string | null
          company_id: string
          created_at?: string
          departamento_id?: string | null
          email?: string | null
          id?: string
          matricula?: string | null
          nome: string
          setor_id?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          ativo?: boolean
          cargo?: string | null
          company_id?: string
          created_at?: string
          departamento_id?: string | null
          email?: string | null
          id?: string
          matricula?: string | null
          nome?: string
          setor_id?: string | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcionarios_clientes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_clientes_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funcionarios_clientes_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_doors: {
        Row: {
          created_at: string
          door_number: number
          expires_at: string | null
          id: string
          label: string | null
          locker_id: string
          occupied_at: string | null
          occupied_by: string | null
          occupied_by_person: string | null
          scheduled_reservation_id: string | null
          size: string
          status: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          created_at?: string
          door_number: number
          expires_at?: string | null
          id?: string
          label?: string | null
          locker_id: string
          occupied_at?: string | null
          occupied_by?: string | null
          occupied_by_person?: string | null
          scheduled_reservation_id?: string | null
          size?: string
          status?: string
          updated_at?: string
          usage_type?: string
        }
        Update: {
          created_at?: string
          door_number?: number
          expires_at?: string | null
          id?: string
          label?: string | null
          locker_id?: string
          occupied_at?: string | null
          occupied_by?: string | null
          occupied_by_person?: string | null
          scheduled_reservation_id?: string | null
          size?: string
          status?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_doors_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_doors_occupied_by_fkey"
            columns: ["occupied_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "locker_doors_occupied_by_person_fkey"
            columns: ["occupied_by_person"]
            isOneToOne: false
            referencedRelation: "funcionarios_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_doors_scheduled_reservation_id_fkey"
            columns: ["scheduled_reservation_id"]
            isOneToOne: false
            referencedRelation: "locker_reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_reservations: {
        Row: {
          created_at: string
          door_id: string
          expires_at: string | null
          expiry_notified: boolean
          id: string
          locker_id: string
          notes: string | null
          person_id: string | null
          released_at: string | null
          renewed_count: number
          reserved_by: string | null
          starts_at: string
          status: string
          updated_at: string
          usage_type: string
        }
        Insert: {
          created_at?: string
          door_id: string
          expires_at?: string | null
          expiry_notified?: boolean
          id?: string
          locker_id: string
          notes?: string | null
          person_id?: string | null
          released_at?: string | null
          renewed_count?: number
          reserved_by?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          usage_type?: string
        }
        Update: {
          created_at?: string
          door_id?: string
          expires_at?: string | null
          expiry_notified?: boolean
          id?: string
          locker_id?: string
          notes?: string | null
          person_id?: string | null
          released_at?: string | null
          renewed_count?: number
          reserved_by?: string | null
          starts_at?: string
          status?: string
          updated_at?: string
          usage_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_reservations_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "locker_doors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_reservations_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_reservations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      locker_waitlist: {
        Row: {
          company_id: string
          created_at: string
          id: string
          locker_id: string
          notified_at: string | null
          person_id: string
          preferred_size: string | null
          requested_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          locker_id: string
          notified_at?: string | null
          person_id: string
          preferred_size?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          locker_id?: string
          notified_at?: string | null
          person_id?: string
          preferred_size?: string | null
          requested_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_waitlist_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_waitlist_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_waitlist_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      lockers: {
        Row: {
          columns: number
          company_id: string | null
          created_at: string
          id: string
          location: string
          name: string
          orientation: string
          rows: number
          updated_at: string
        }
        Insert: {
          columns?: number
          company_id?: string | null
          created_at?: string
          id?: string
          location?: string
          name: string
          orientation?: string
          rows?: number
          updated_at?: string
        }
        Update: {
          columns?: number
          company_id?: string | null
          created_at?: string
          id?: string
          location?: string
          name?: string
          orientation?: string
          rows?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lockers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      platform_settings_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          setting_key: string
          value: Json
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          setting_key: string
          value?: Json
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          setting_key?: string
          value?: Json
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          full_name: string | null
          id: string
          password_changed: boolean
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          password_changed?: boolean
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          password_changed?: boolean
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_requests: {
        Row: {
          admin_notes: string | null
          company_id: string
          created_at: string
          door_id: string
          id: string
          person_id: string
          requested_hours: number
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          company_id: string
          created_at?: string
          door_id: string
          id?: string
          person_id: string
          requested_hours?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          company_id?: string
          created_at?: string
          door_id?: string
          id?: string
          person_id?: string
          requested_hours?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "renewal_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_requests_door_id_fkey"
            columns: ["door_id"]
            isOneToOne: false
            referencedRelation: "locker_doors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renewal_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "funcionarios_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      setores: {
        Row: {
          ativo: boolean
          company_id: string
          created_at: string
          departamento_id: string | null
          descricao: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          company_id: string
          created_at?: string
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          company_id?: string
          created_at?: string
          departamento_id?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "setores_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_departamento_id_fkey"
            columns: ["departamento_id"]
            isOneToOne: false
            referencedRelation: "departamentos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_login_lockout_status: {
        Args: { _email: string }
        Returns: {
          bloqueado: boolean
          mensagem: string
          minutos_restantes: number
          nivel: string
          segundos_restantes: number
          tentativas_restantes: number
          total_falhas: number
        }[]
      }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      register_login_attempt: {
        Args: { _email: string; _success: boolean }
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
