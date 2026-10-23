-- Optimize indexes for app data queries.
-- Based on actual ORDER BY and WHERE patterns in server functions.

-- attendance: ORDER BY date DESC, time DESC
DROP INDEX IF EXISTS attendance_date_idx;
CREATE INDEX idx_attendance_date_time ON attendance (date DESC, time DESC);

-- tasks: ORDER BY created DESC
CREATE INDEX idx_tasks_created ON tasks (created DESC);

-- cash_vouchers: ORDER BY date DESC
CREATE INDEX idx_cash_date ON cash_vouchers (date DESC);

-- proposals: ORDER BY date DESC
CREATE INDEX idx_proposals_date ON proposals (date DESC);

-- notes: ORDER BY date DESC
CREATE INDEX idx_notes_date ON notes (date DESC);

-- messages: WHERE channel = ? ORDER BY at ASC
DROP INDEX IF EXISTS messages_channel_idx;
CREATE INDEX idx_messages_channel_at ON messages (channel, at ASC);

-- checkins: ORDER BY date DESC, time DESC
CREATE INDEX idx_checkins_date_time ON checkins (date DESC, time DESC);
