-- schema_vote_ratelimit.sql
-- Extend the api_rate_limit_events scope check constraint to include 'vote_submit'.
--
-- NOTE: schema_ward_subscriptions.sql later redefined this same constraint with a
-- superset that also includes 'ward_notify_subscribe'. This file's scope list is
-- kept as that full UNION so applying it is a safe no-op regardless of order —
-- an earlier 7-scope version would have DROPPED 'ward_notify_subscribe' and broken
-- ward alert subscriptions. Any future scope addition must extend BOTH files.

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
        'vote_submit',
        'ward_notify_subscribe'
    ));
