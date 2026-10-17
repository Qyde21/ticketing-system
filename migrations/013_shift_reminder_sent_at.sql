-- Track when a shift reminder email was sent to each assignee so the
-- shift-reminders cron can run on a daily schedule (Vercel Hobby plan)
-- without ever emailing the same person twice for the same shift.
ALTER TABLE event_shift_assignments
  ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
