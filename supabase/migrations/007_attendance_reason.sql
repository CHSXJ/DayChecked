-- Add reason column to attendance_logs for out-of-area check-ins
ALTER TABLE attendance_logs
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT NULL;
