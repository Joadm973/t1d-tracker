-- Abonnements push (une entrée par appareil)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint   TEXT    UNIQUE NOT NULL,
  p256dh     TEXT    NOT NULL,
  auth       TEXT    NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Rappels planifiés (liés à un abonnement)
CREATE TABLE IF NOT EXISTS scheduled_reminders (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  subscription_id INTEGER NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  label           TEXT    NOT NULL,
  time            TEXT    NOT NULL,          -- "HH:MM"
  days            TEXT    NOT NULL,          -- JSON: [1,2,3] (1=Lun … 7=Dim)
  type            TEXT    NOT NULL CHECK(type IN ('glucose_check','injection','meal','custom')),
  enabled         INTEGER NOT NULL DEFAULT 1,
  timezone        TEXT    NOT NULL DEFAULT 'Europe/Paris',
  created_at      INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_reminders_sub     ON scheduled_reminders(subscription_id);
CREATE INDEX IF NOT EXISTS idx_reminders_enabled ON scheduled_reminders(enabled);
