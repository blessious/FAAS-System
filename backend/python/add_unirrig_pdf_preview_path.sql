-- Add unirrig_pdf_preview_path to faas_records for UNIRRIG PDF storage
ALTER TABLE faas_records
ADD COLUMN unirrig_pdf_preview_path VARCHAR(255) DEFAULT NULL AFTER pdf_preview_path;