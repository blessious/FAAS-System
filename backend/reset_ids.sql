-- =============================================================
-- FAAS Records ID Reset Migration
-- Re-sequences faas_records.id to start from 1
-- Also updates: faas_records.parent_id, activity_log.record_id
-- =============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET @rownum = 0;

-- Step 1: Create a permanent mapping table: old_id -> new_id (sequential from 1)
DROP TABLE IF EXISTS _id_map;
CREATE TABLE _id_map AS
SELECT
  id AS old_id,
  (@rownum := @rownum + 1) AS new_id
FROM faas_records
ORDER BY id ASC;

-- Step 2: Update activity_log.record_id using the mapping
UPDATE activity_log al
INNER JOIN _id_map m ON al.record_id = m.old_id
SET al.record_id = m.new_id;

-- Step 3: Update faas_records.parent_id references FIRST (before changing IDs)
-- Use a negative offset to avoid conflicts while updating
UPDATE faas_records fr
INNER JOIN _id_map m ON fr.parent_id = m.old_id
SET fr.parent_id = -(m.new_id);

-- Step 4: Update parent_id from negative back to positive (final values)
UPDATE faas_records SET parent_id = -parent_id WHERE parent_id < 0;

-- Step 5: Update faas_records.id itself
-- Use negative offset first to avoid PK clashes
UPDATE faas_records fr
INNER JOIN _id_map m ON fr.id = m.old_id
SET fr.id = -(m.new_id);

-- Step 6: Flip back to positive
UPDATE faas_records SET id = -id WHERE id < 0;

-- Step 7: Reset AUTO_INCREMENT to next value after max id
SET @max_id = (SELECT MAX(id) FROM faas_records);
SET @sql = CONCAT('ALTER TABLE faas_records AUTO_INCREMENT = ', @max_id + 1);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 8: Clean up the mapping table
DROP TABLE IF EXISTS _id_map;

SET FOREIGN_KEY_CHECKS = 1;

-- Verify result
SELECT 'Done!' AS status, MIN(id) AS min_id, MAX(id) AS max_id, COUNT(*) AS total FROM faas_records;
