export interface Store {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  owner_id: string;
  created_at: string;
}

export interface Employee {
  id: string;
  store_id: string;
  name: string;
  pin_hash: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

export interface EmployeePublic {
  id: string;
  store_id: string;
  name: string;
  is_active: boolean;
  user_id: string | null;
  created_at: string;
}

export type UserRole = "admin" | "owner" | "employee" | "unknown";

export interface OwnerProfile {
  user_id: string;
  max_stores: number;
  max_employees: number;
  is_active: boolean;
  created_at: string;
}

export interface AttendanceLog {
  id: string;
  employee_id: string;
  store_id: string;
  type: "in" | "out";
  checked_at: string;
  lat: number;
  lng: number;
  is_valid_location: boolean;
}

export interface AttendanceLogWithEmployee extends AttendanceLog {
  employees: {
    name: string;
  };
}

export interface EmployeeSummary {
  employee_id: string;
  employee_name: string;
  total_days: number;
  total_hours: number;
  logs: AttendanceLog[];
}

export interface MonthlySummary {
  month: string;
  store_id: string;
  employees: EmployeeSummary[];
}

// API request/response types
export interface CheckInRequest {
  employee_id: string;
  store_id: string;
  type: "in" | "out";
  lat: number;
  lng: number;
  pin: string;
}

export interface CheckInResponse {
  success: boolean;
  log?: AttendanceLog;
  error?: string;
}

export interface AttendanceQueryParams {
  store_id: string;
  month: string; // format: YYYY-MM
}
