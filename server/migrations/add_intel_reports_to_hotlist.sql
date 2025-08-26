-- Migration: Add intel report support to hot list alerts
-- This allows hot list alerts to reference either posts or intel reports

-- Add intel_report_id column
ALTER TABLE hot_list_alerts 
ADD COLUMN intel_report_id INTEGER REFERENCES intel_reports(id) ON DELETE CASCADE;

-- Make post_id nullable since we now support intel reports too
ALTER TABLE hot_list_alerts 
ALTER COLUMN post_id DROP NOT NULL;

-- Drop the old unique constraint
ALTER TABLE hot_list_alerts 
DROP CONSTRAINT IF EXISTS hot_list_alerts_hot_list_id_post_id_key;

-- Add new check constraint to ensure either post_id or intel_report_id is set, but not both
ALTER TABLE hot_list_alerts 
ADD CONSTRAINT hot_list_alerts_content_check 
CHECK (
  (post_id IS NOT NULL AND intel_report_id IS NULL) OR 
  (post_id IS NULL AND intel_report_id IS NOT NULL)
);

-- Add unique constraints for both scenarios
ALTER TABLE hot_list_alerts 
ADD CONSTRAINT hot_list_alerts_post_unique 
UNIQUE (hot_list_id, post_id) DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE hot_list_alerts 
ADD CONSTRAINT hot_list_alerts_intel_unique 
UNIQUE (hot_list_id, intel_report_id) DEFERRABLE INITIALLY DEFERRED;