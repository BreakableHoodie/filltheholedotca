-- Add 'push_unsubscribe' scope to api_rate_limit_events constraint.
-- Required for rate-limiting DELETE /api/subscribe (push notification opt-out).

ALTER TABLE api_rate_limit_events
  DROP CONSTRAINT IF EXISTS api_rate_limit_events_scope_check;

ALTER TABLE api_rate_limit_events
  ADD CONSTRAINT api_rate_limit_events_scope_check
  CHECK (scope IN ('report_submit', 'photo_upload', 'hit_submit', 'push_subscribe', 'push_unsubscribe'));
