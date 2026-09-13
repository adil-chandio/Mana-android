-- Local test schema only until authenticated, free-only deployment is approved.
CREATE TABLE IF NOT EXISTS chat_budget (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  utc_day TEXT NOT NULL,
  day_count INTEGER NOT NULL CHECK (day_count > 0),
  minute_id INTEGER NOT NULL,
  minute_count INTEGER NOT NULL CHECK (minute_count > 0)
);
