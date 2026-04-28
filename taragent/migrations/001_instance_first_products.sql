-- Migration: Instance-first product architecture
-- Creates instance rows for existing products that don't have them.
-- Run this against the instances DB (with access to states DB for the SELECT).
-- If both tables are in the same DB, run as-is. If separate, extract the SELECT
-- from the states DB and INSERT into the instances DB manually.

-- Add index for instance-first queries
CREATE INDEX IF NOT EXISTS idx_instance_scope_type ON instance(scope, type);

-- Backfill instances for existing products
INSERT INTO instance (id, stateid, type, scope, qty, value, currency, available, ts)
SELECT
  lower(hex(randomblob(16))),
  s.ucode,
  'inventory',
  s.scope,
  NULL,
  json_extract(s.payload, '$.price'),
  COALESCE(json_extract(s.payload, '$.currency'), 'INR'),
  1,
  datetime('now')
FROM state s
WHERE s.type = 'product'
AND NOT EXISTS (
  SELECT 1 FROM instance i WHERE i.stateid = s.ucode AND i.scope = s.scope
);
