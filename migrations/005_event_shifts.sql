-- Phase 1: door staff shift windows + assignments
CREATE TABLE IF NOT EXISTS event_shifts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ NOT NULL,
  gate          TEXT,
  slots_needed  INTEGER NOT NULL DEFAULT 1 CHECK (slots_needed >= 1),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT event_shifts_time_check CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_event_shifts_event_id ON event_shifts(event_id);

CREATE TABLE IF NOT EXISTS event_shift_assignments (
  shift_id  UUID NOT NULL REFERENCES event_shifts(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'assigned'
            CHECK (status IN ('assigned', 'confirmed', 'no_show')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (shift_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_shift_assignments_user ON event_shift_assignments(user_id);
