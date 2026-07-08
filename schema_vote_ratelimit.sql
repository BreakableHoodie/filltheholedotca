-- schema_vote_ratelimit.sql
-- Extend the api_rate_limit_events scope check constraint to include 'vote_submit'.
-- The constraint was last defined in schema_fill_notify_ratelimit.sql.

ALTER TABLE api_rate_limit_events DROP CONSTRAINT IF EXISTS api_rate_limit_events_scope_check;
ALTER TABLE api_rate_limit_events
    ADD CONSTRAINT api_rate_limit_events_scope_check
    CHECK (scope IN (
        'report_submit',
        'photo_upload',
        'hit_submit',
        'push_subscribe',
        'push_unsubscribe',
        'fill_notify_subscribe',
        'vote_submit'
    ));
