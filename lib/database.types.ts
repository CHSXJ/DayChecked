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
        };
        Insert: {
          id?: string;
          name: string;
          lat: number;
          lng: number;
          radius_meters?: number;
          owner_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          lat?: number;
          lng?: number;
          radius_meters?: number;
          owner_id?: string;
          created_at?: string;
        };
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
        };
        Insert: {
          id?: string;
          store_id: string;
          name: string;
          pin_hash: string;
          is_active?: boolean;
          user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          name?: string;
          pin_hash?: string;
          is_active?: boolean;
          user_id?: string | null;
          created_at?: string;
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
