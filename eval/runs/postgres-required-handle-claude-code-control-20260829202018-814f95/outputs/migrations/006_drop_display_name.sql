-- Drop obsolete display_name column after all application versions have migrated to account_handle
ALTER TABLE accounts DROP COLUMN display_name;
