-- Push subscriptions received from browsers
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint    TEXT    NOT NULL UNIQUE,
  p256dh      TEXT    NOT NULL,
  auth        TEXT    NOT NULL,
  user_agent  TEXT,
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Reminders that the backend must push at a scheduled time
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  label           TEXT    NOT NULL,
  type            TEXT    NOT NULL CHECK(type IN ('glucose_check','injection','meal','custom')),
  time            TEXT    NOT NULL,   -- "HH:MM" in user's timezone
  days            TEXT    NOT NULL,   -- JSON array, e.g. "[1,2,3,4,5]"  (1=Mon … 7=Sun)
  timezone        TEXT    NOT NULL DEFAULT 'Europe/Paris',
  enabled         INTEGER NOT NULL DEFAULT 1,
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reminders_subscription
  ON scheduled_reminders(subscription_id);

CREATE INDEX IF NOT EXISTS idx_reminders_enabled_time
  ON scheduled_reminders(enabled, time);
