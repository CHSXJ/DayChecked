export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      stores: {
        Row: {
          id: string;
          name: string;
          lat: number;
          lng: number;
          radius_meters: number;
          owner_id: string;
          created_at: string;
          allow_co_owners: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          lat: number;
          lng: number;
          radius_meters?: number;
          owner_id: string;
          created_at?: string;
          allow_co_owners?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          lat?: number;
          lng?: number;
          radius_meters?: number;
          owner_id?: string;
          created_at?: string;
          allow_co_owners?: boolean;
        };
        Relationships: [];
      };
      shifts: {
        Row: { id: string; store_id: string; name: string; start_time: string; end_time: string; created_at: string; };
        Insert: { id?: string; store_id: string; name: string; start_time: string; end_time: string; created_at?: string; };
        Update: { id?: string; store_id?: string; name?: string; start_time?: string; end_time?: string; };
        Relationships: [];
      };
      employees: {
        Row: {
          id: string;
          store_id: string;
          name: string;
          pin_hash: string;
          is_active: boolean;
          user_id: string | null;
          created_at: string;
          shift_id: string | null;
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          pin_hash: string;
          is_active?: boolean;
          user_id?: string | null;
          created_at?: string;
          shift_id?: string | null;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          pin_hash?: string;
          is_active?: boolean;
          user_id?: string | null;
          created_at?: string;
          shift_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "employees_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      store_owners: {
        Row: {
          store_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          store_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          store_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_owners_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
      owner_profiles: {
        Row: {
          user_id: string;
          max_stores: number;
          max_employees: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          user_id: string;
          max_stores?: number;
          max_employees?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          max_stores?: number;
          max_employees?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      attendance_logs: {
        Row: {
          id: string;
          employee_id: string;
          store_id: string;
          type: "in" | "out";
          checked_at: string;
          lat: number;
          lng: number;
          is_valid_location: boolean;
          reason: string | null;
        };
        Insert: {
          id?: string;
          employee_id: string;
          store_id: string;
          type: "in" | "out";
          checked_at?: string;
          lat: number;
          lng: number;
          is_valid_location: boolean;
          reason?: string | null;
        };
        Update: {
          id?: string;
          employee_id?: string;
          store_id?: string;
          type?: "in" | "out";
          checked_at?: string;
          lat?: number;
          lng?: number;
          is_valid_location?: boolean;
          reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_logs_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_logs_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
