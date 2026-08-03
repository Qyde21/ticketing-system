-- Safe to run on existing databases. Adds column used by check-in API.
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS checked_in_by UUID REFERENCES users(id);
