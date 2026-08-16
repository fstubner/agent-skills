-- Backfill phase: derive stable, unique handles from existing usernames.
WITH ranked AS (
    SELECT
        id,
        lower(regexp_replace(coalesce(trim(username), ''), '[^a-zA-Z0-9_]+', '_', 'g')) AS base_handle,
        row_number() OVER (
            PARTITION BY lower(regexp_replace(coalesce(trim(username), ''), '[^a-zA-Z0-9_]+', '_', 'g'))
            ORDER BY id
        ) AS duplicate_number
    FROM users
    WHERE handle IS NULL
), handles AS (
    SELECT
        id,
        CASE
            WHEN base_handle = '' THEN 'user_' || id::text
            WHEN duplicate_number = 1 THEN base_handle
            ELSE base_handle || '_' || duplicate_number::text
        END AS account_handle
    FROM ranked
)
UPDATE users AS u
SET handle = h.account_handle
FROM handles AS h
WHERE u.id = h.id;
