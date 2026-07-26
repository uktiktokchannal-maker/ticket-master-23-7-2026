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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agencies: {
        Row: {
          bank_account: string | null
          bus_image_url: string | null
          created_at: string
          currency: string
          id: string
          logo_url: string | null
          name: string
          owner_id: string | null
          updated_at: string
        }
        Insert: {
          bank_account?: string | null
          bus_image_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name: string
          owner_id?: string | null
          updated_at?: string
        }
        Update: {
          bank_account?: string | null
          bus_image_url?: string | null
          created_at?: string
          currency?: string
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          agency_id: string
          amount: number
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          passenger_name: string
          passenger_phone: string | null
          seat_number: number
          status: Database["public"]["Enums"]["booking_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount?: number
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          passenger_name: string
          passenger_phone?: string | null
          seat_number: number
          status?: Database["public"]["Enums"]["booking_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          passenger_name?: string
          passenger_phone?: string | null
          seat_number?: number
          status?: Database["public"]["Enums"]["booking_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          agency_id: string
          created_at: string
          id: string
          is_main: boolean
          name: string
          phone: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          agency_id: string
          created_at?: string
          id?: string
          is_main?: boolean
          name: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          agency_id?: string
          created_at?: string
          id?: string
          is_main?: boolean
          name?: string
          phone?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      buses: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          model: string | null
          plate_number: string
          seat_count: number
          status: Database["public"]["Enums"]["bus_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          model?: string | null
          plate_number: string
          seat_count?: number
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          model?: string | null
          plate_number?: string
          seat_count?: number
          status?: Database["public"]["Enums"]["bus_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_shifts: {
        Row: {
          actual_cash: number | null
          agency_id: string
          branch_id: string
          cashier_id: string
          closed_at: string | null
          created_at: string
          difference: number | null
          expected_cash: number
          id: string
          notes: string | null
          opened_at: string
          opening_balance: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_cash?: number | null
          agency_id: string
          branch_id: string
          cashier_id: string
          closed_at?: string | null
          created_at?: string
          difference?: number | null
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_cash?: number | null
          agency_id?: string
          branch_id?: string
          cashier_id?: string
          closed_at?: string | null
          created_at?: string
          difference?: number | null
          expected_cash?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_balance?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashier_shifts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashier_shifts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          agency_id: string
          created_at: string
          id: string
          license_number: string | null
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          id?: string
          license_number?: string | null
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          id?: string
          license_number?: string | null
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          agency_id: string
          amount: number
          branch_id: string
          bus_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          date: string
          description: string
          id: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          amount?: number
          branch_id: string
          bus_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          amount?: number
          branch_id?: string
          bus_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          date?: string
          description?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          agency_id: string
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          read: boolean
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          agency_id: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          agency_id?: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          read?: boolean
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_id: string | null
          branch_id: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          agency_id: string
          created_at: string
          default_price: number
          destination: string
          distance_km: number | null
          id: string
          origin: string
          updated_at: string
        }
        Insert: {
          agency_id: string
          created_at?: string
          default_price?: number
          destination: string
          distance_km?: number | null
          id?: string
          origin: string
          updated_at?: string
        }
        Update: {
          agency_id?: string
          created_at?: string
          default_price?: number
          destination?: string
          distance_km?: number | null
          id?: string
          origin?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "routes_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          agency_id: string
          bus_id: string
          created_at: string
          departure_at: string
          driver_id: string | null
          id: string
          price: number
          route_id: string
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
        }
        Insert: {
          agency_id: string
          bus_id: string
          created_at?: string
          departure_at: string
          driver_id?: string | null
          id?: string
          price?: number
          route_id: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Update: {
          agency_id?: string
          bus_id?: string
          created_at?: string
          departure_at?: string
          driver_id?: string | null
          id?: string
          price?: number
          route_id?: string
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          agency_id: string | null
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          agency_id?: string | null
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_agency_for_current_user: {
        Args: { _currency?: string; _name: string }
        Returns: string
      }
      current_agency_id: { Args: never; Returns: string }
      current_branch_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_can_access_branch: { Args: { _branch_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "owner"
        | "manager"
        | "cashier"
        | "accountant"
        | "supervisor"
        | "broker"
        | "inspector"
      booking_status: "confirmed" | "cancelled" | "pending" | "refunded"
      bus_status: "active" | "maintenance" | "inactive"
      driver_status: "active" | "inactive" | "on_trip"
      expense_category: "fuel" | "maintenance" | "office" | "salary" | "other"
      notification_type: "info" | "success" | "warning" | "alert"
      trip_status:
        | "scheduled"
        | "boarding"
        | "departed"
        | "completed"
        | "cancelled"
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
    Enums: {
      app_role: [
        "owner",
        "manager",
        "cashier",
        "accountant",
        "supervisor",
        "broker",
        "inspector",
      ],
      booking_status: ["confirmed", "cancelled", "pending", "refunded"],
      bus_status: ["active", "maintenance", "inactive"],
      driver_status: ["active", "inactive", "on_trip"],
      expense_category: ["fuel", "maintenance", "office", "salary", "other"],
      notification_type: ["info", "success", "warning", "alert"],
      trip_status: [
        "scheduled",
        "boarding",
        "departed",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
