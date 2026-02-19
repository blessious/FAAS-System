import os
import sys
import mysql.connector
from datetime import datetime
from openpyxl import load_workbook
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

class FAASExcelGenerator:
    def __init__(self):
        self.db_config = {
            'host': os.getenv('DB_HOST'),
            'user': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD'),
            'database': os.getenv('DB_NAME'),
            'port': os.getenv('DB_PORT', 3306)
        }

        # Paths
        self.template_dir = os.path.join(os.path.dirname(__file__), 'templates')
        self.output_dir = os.path.join(os.path.dirname(__file__), 'generated')
        self.faas_dir = os.path.join(self.output_dir, 'FAAS')
        self.unirrig_dir = os.path.join(self.output_dir, 'UNIRRIG')
        
        # Ensure directories exist
        os.makedirs(self.faas_dir, exist_ok=True)
        os.makedirs(self.unirrig_dir, exist_ok=True)
    
    def get_db_connection(self):
        """Create database connection"""
        try:
            return mysql.connector.connect(**self.db_config)
        except Exception as e:
            print(f"ERROR: Database connection failed. Please check your DB configuration. {e}")
            raise

    def safe_float(self, value, default=0.0):
        """Safely convert value to float"""
        if value is None or value == '':
            return default
        try:
            # Remove commas if present in string
            if isinstance(value, str):
                value = value.replace(',', '')
            return float(value)
        except (ValueError, TypeError):
            return default

    def safe_int(self, value, default=0):
        """Safely convert value to int"""
        if value is None or value == '':
            return default
        try:
            return int(float(value)) # float first handles cases like "123.0"
        except (ValueError, TypeError):
            return default

    def clean_filename(self, filename):
        """Remove characters that are illegal in Windows filenames and replace spaces/dots"""
        if not filename:
            return "Unknown"
        
        # First handle spaces and dots specifically
        filename = filename.replace(' ', '_').replace('.', '_')
        
        # Forbidden characters and those that cause shell/script issues
        # \ / : * ? " < > | (Windows illegal)
        # ( ) [ ] { } , ; ' ` @ # $ % ^ & + = (Shell/Path issue candidates)
        to_replace = ['\\', '/', ':', '*', '?', '"', '<', '>', '|', '(', ')', '[', ']', '{', '}', ',', ';', "'", '`', '@', '#', '$', '%', '^', '&', '+', '=', '!', '~']
        
        for char in to_replace:
            filename = filename.replace(char, '_')
            
        # Remove multiple underscores
        while '__' in filename:
            filename = filename.replace('__', '_')
            
        return filename.strip('_')
    
    def get_faas_record(self, record_id):
        """Retrieve FAAS record from database"""
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)

            query = """
            SELECT 
                f.*,
                ue.full_name as encoder_name,
                ua.full_name as approver_name,
                -- NEW FIELDS for previous assessment information
                f.previous_td_no,
                f.previous_owner,
                f.effectivity_year,  -- Changed from f.effectivity to f.effectivity_year
                f.taxability,
                f.previous_av_land,
                f.previous_av_improvements,
                f.previous_total_av,
                -- MEMORANDA fields
                f.memoranda_code,
                f.memoranda_paragraph
            FROM faas_records f
            LEFT JOIN users ue ON f.encoder_id = ue.id
            LEFT JOIN users ua ON f.approver_id = ua.id
            WHERE f.id = %s
            """

            cursor.execute(query, (record_id,))
            record = cursor.fetchone()

            cursor.close()
            conn.close()

            return record
        except Exception as e:
            print(f"Error fetching FAAS record: {e}")
            return None

    def get_unirrig_record(self, record_id):
        """Retrieve UNIRRIG record from database (for now, use faas_records for demo)"""
        # You can change this to a different table if needed
        try:
            conn = self.get_db_connection()
            cursor = conn.cursor(dictionary=True)
            query = """
            SELECT f.* FROM faas_records f WHERE f.id = %s
            """
            cursor.execute(query, (record_id,))
            record = cursor.fetchone()
            cursor.close()
            conn.close()
            return record
        except Exception as e:
            print(f"Error fetching UNIRRIG record: {e}")
            return None
    
    def safe_write_cell(self, sheet, cell_address, value):
        """Safely write to a cell, handling merged cells"""
        try:
            cell = sheet[cell_address]
            
            # Check if cell is part of a merged range
            for merged_range in sheet.merged_cells.ranges:
                if cell.coordinate in merged_range:
                    # Get the top-left cell of the merged range
                    top_left_cell = sheet[merged_range.min_row][merged_range.min_col - 1]
                    top_left_cell.value = value
                    return
            
            # If not merged, write normally
            cell.value = value
            
        except Exception as e:
            print(f"Warning: Could not write to cell {cell_address}: {e}")
    
    def generate_faas_excel(self, record_id, timestamp=None, save_path=None):
        """Generate FAAS Excel file from template"""
        try:
            # Get FAAS record
            record = self.get_faas_record(record_id)
            if not record:
                return None, "FAAS record not found"

            # Load template
            template_path = os.path.join(self.template_dir, 'FAAS_Template.xlsx')
            if not os.path.exists(template_path):
                return None, f"Template not found at {template_path}"

            workbook = load_workbook(template_path)
            sheet = workbook.active

            print(f"Processing FAAS record for: {record.get('owner_name', 'Unknown')}")

            land_appraisals = json.loads(record.get('land_appraisals_json', '[]')) if record.get('land_appraisals_json') else []
            improvements = json.loads(record.get('improvements_json', '[]')) if record.get('improvements_json') else []
            market_values = json.loads(record.get('market_values_json', '[]')) if record.get('market_values_json') else []
            assessments = json.loads(record.get('assessments_json', '[]')) if record.get('assessments_json') else []

            # Map data to Excel cells
            cell_mapping = {
                # Basic Information
                'B6': record.get('arf_no', ''),
                'F6': record.get('pin', ''),
                'B7': record.get('oct_tct_no', ''),
                'F7': record.get('cln', ''),
                'B8': record.get('owner_name', ''),
                'F8': record.get('owner_address', ''),
                'B14': record.get('owner_barangay', ''),
                'F13': record.get('owner_municipality', ''),
                'F14': record.get('owner_province', ''),
                'B10': record.get('administrator_name', ''),
                'F10': record.get('administrator_address', ''),
                'B13': record.get('property_location', ''),
                'F13': record.get('property_municipality', ''),
                'B14': record.get('property_barangay', ''),
                'F14': record.get('property_province', ''),
                'B16': record.get('north_boundary', ''),
                'B19': record.get('south_boundary', ''),
                'B17': record.get('east_boundary', ''),
                'B18': record.get('west_boundary', ''),
                
                # NEW FIELDS: Previous Assessment Information
                'B65': record.get('previous_td_no', ''),           # Previous T.D. No.
                'B66': record.get('previous_owner', ''),           # Previous Owner
                'E65': record.get('effectivity_year', ''),         # Effectivity - changed from effectivity
                'E66': str(record.get('taxability', '')).upper() if record.get('taxability') else '',  # Taxability (ALL CAPS)
                'H65': record.get('previous_av_land', ''),         # Previous AV - Land
                'H66': record.get('previous_av_improvements', ''), # Previous AV - Improvements
                'H67': record.get('previous_total_av', ''),        # Previous Total AV
                
                # Owner/Administrator field
                'A51': record.get('administrator_name', ''),  # Administrator name
                
                # MEMORANDA fields
                'B59': str(record.get('memoranda_code', '')).upper() if record.get('memoranda_code') else '',  # 2-character code (ALL CAPS)
                'A60': record.get('memoranda_paragraph', ''),      # Paragraph for A60 rectangle
            }
            
            # Add Land Appraisal values (4 rows) - Rows 22-25
            for i in range(min(4, len(land_appraisals))):
                item = land_appraisals[i]
                row = 22 + i
                if item.get('classification'):
                    cell_mapping[f'A{row}'] = item.get('classification')
                if item.get('sub_class'):
                    cell_mapping[f'C{row}'] = item.get('sub_class')
                if item.get('area'):
                    cell_mapping[f'D{row}'] = f"{self.safe_float(item.get('area')):,.4f}"


            # Add Other Improvements values (4 rows) - Rows 29-32
            for i in range(min(4, len(improvements))):
                item = improvements[i]
                row = 29 + i
                if item.get('product_class'):
                    cell_mapping[f'A{row}'] = item.get('product_class')
                if item.get('improvement_qty'):
                    cell_mapping[f'C{row}'] = str(self.safe_int(item.get('improvement_qty')))
                if item.get('unit_value_improvement'):
                    cell_mapping[f'E{row}'] = f"{self.safe_float(item.get('unit_value_improvement')):,.2f}"

            # Add Market Value values (4 rows) - Rows 36-39
            for i in range(min(4, len(market_values))):
                item = market_values[i]
                row = 36 + i
                if item.get('adj_factor'):
                    cell_mapping[f'C{row}'] = f"{self.safe_float(item.get('adj_factor')):,.2f}"
                if item.get('percent_adjustment'):
                    cell_mapping[f'D{row}'] = f"{self.safe_float(item.get('percent_adjustment')):,.2f}%"
                if item.get('value_adjustment'):
                    cell_mapping[f'E{row}'] = f"{self.safe_float(item.get('value_adjustment')):,.2f}"

            # Add Property Assessment values (4 rows) - Rows 43-46
            for i in range(min(4, len(assessments))):
                item = assessments[i]
                row = 43 + i
                if item.get('kind'):
                    cell_mapping[f'A{row}'] = item.get('kind')
                if item.get('actual_use'):
                    cell_mapping[f'B{row}'] = item.get('actual_use')
                if item.get('assessment_level'):
                    cell_mapping[f'E{row}'] = f"{self.safe_float(item.get('assessment_level')):,.2f}%"
            


            # Write data to cells using safe method
            # Skip writing if value is None, empty string, or 'None' to preserve formulas
            for cell, value in cell_mapping.items():
                if value is not None and value != '' and value != 'None':
                    self.safe_write_cell(sheet, cell, str(value))

            # Generate filename
            owner_raw = record.get('owner_name', 'Unknown')
            owner_name = self.clean_filename(owner_raw)
            arf_raw = record.get('arf_no', 'Unknown')
            arf_no_safe = self.clean_filename(arf_raw)
            
            if not timestamp:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"FAAS_{arf_no_safe}_{owner_name}_{timestamp}.xlsx"

            if save_path:
                output_path = save_path
            else:
                output_path = os.path.join(self.faas_dir, filename)

            # Save the workbook
            workbook.save(output_path)

            print(f"[OK] Excel file generated: {output_path}")
            print(f"[INFO] Record details: ARF={record.get('arf_no', 'N/A')}, Owner={record.get('owner_name', 'N/A')}")

            return {
                'success': True,
                'file_path': output_path,
                'file_name': filename,
                'owner_name': owner_name,
                'arf_no': record.get('arf_no', '')
            }, None

        except Exception as e:
            import traceback
            error_msg = f"Error generating Excel: {str(e)}\n{traceback.format_exc()}"
            print(f" {error_msg}")
            return None, error_msg

    def generate_unirrig_excel(self, record_id, timestamp=None, save_path=None):
        """Generate UNIRRIG Excel file from template with mapped fields from FAAS"""
        try:
            record = self.get_unirrig_record(record_id)
            if not record:
                return None, "UNIRRIG record not found"

            template_path = os.path.join(self.template_dir, 'UNIRRIG_Template.xlsx')
            if not os.path.exists(template_path):
                return None, f"Template not found at {template_path}"

            workbook = load_workbook(template_path)
            sheet = workbook.active

            print(f"Processing UNIRRIG record for: {record.get('owner_name', 'Unknown')}")

            # Map FAAS fields to UNIRRIG template cells
            unirrig_mapping = {
                'J3': record.get('pin', ''),
                'A7': record.get('memoranda_code', ''),
                'B11': record.get('owner_name', ''),
                'H11': record.get('owner_address', ''),
                'B13': record.get('administrator_name', ''),
                'H13': record.get('administrator_address', ''),
                'C17': record.get('property_location', ''),
                'I17': record.get('property_municipality', ''),
                'G17': record.get('property_province', ''),
                'C19': record.get('oct_tct_no', ''),
                'H19': record.get('cln', ''),
                'B21': record.get('north_boundary', ''),
                'I21': record.get('south_boundary', ''),
                'B22': record.get('east_boundary', ''),
                'I22': record.get('west_boundary', ''),
            }

            # Parse PIN (F6 in FAAS) → K19 and K20 in UNIRRIG
            # Format: 030-01-008-10-03067
            # K20 = 4th segment (10), K19 = 5th segment (03067)
            pin = record.get('pin', '')
            pin_parts = pin.split('-')
            if len(pin_parts) >= 5:
                self.safe_write_cell(sheet, 'K20', pin_parts[3])
                self.safe_write_cell(sheet, 'K19', pin_parts[4])

            for cell, value in unirrig_mapping.items():
                self.safe_write_cell(sheet, cell, value)

            # Land Appraisals: map FAAS rows 22-25 → UNIRRIG rows 28-31
            # FAAS col A (classification) → UNIRRIG col E
            # FAAS col C (sub_class)      → UNIRRIG col H
            # FAAS col D (area)           → UNIRRIG col G
            # FAAS col E (unit_value_land)→ UNIRRIG col I  (computed via IFS formula logic, not from DB)
            land_appraisals = json.loads(record.get('land_appraisals_json', '[]')) if record.get('land_appraisals_json') else []

            for i in range(min(4, len(land_appraisals))):
                item = land_appraisals[i]
                unirrig_row = 28 + i  # UNIRRIG rows 28, 29, 30, 31

                if item.get('classification'):
                    self.safe_write_cell(sheet, f'E{unirrig_row}', item.get('classification'))
                if item.get('sub_class'):
                    self.safe_write_cell(sheet, f'H{unirrig_row}', item.get('sub_class'))
                if item.get('area'):
                    self.safe_write_cell(sheet, f'G{unirrig_row}', f"{self.safe_float(item.get('area')):,.4f}")


            # Improvements: map FAAS rows 29-32 → UNIRRIG rows 42-45
            # FAAS col A (product_class)       → UNIRRIG col H
            # FAAS col C (improvement_qty)     → UNIRRIG col I
            # J42:J45 and K42:K45 use Excel formulas (no Python mapping needed)
            improvements = json.loads(record.get('improvements_json', '[]')) if record.get('improvements_json') else []

            for i in range(min(4, len(improvements))):
                item = improvements[i]
                unirrig_row = 42 + i  # UNIRRIG rows 42, 43, 44, 45

                if item.get('product_class'):
                    self.safe_write_cell(sheet, f'H{unirrig_row}', item.get('product_class'))
                if item.get('improvement_qty'):
                    self.safe_write_cell(sheet, f'I{unirrig_row}', str(self.safe_int(item.get('improvement_qty'))))

            # Generate filename
            owner_raw = record.get('owner_name', 'Unknown')
            owner_name_safe = self.clean_filename(owner_raw)
            arf_raw = record.get('arf_no', 'Unknown')
            arf_no_safe = self.clean_filename(arf_raw)
            
            if not timestamp:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"UNIRRIG_{arf_no_safe}_{owner_name_safe}_{timestamp}.xlsx"

            if save_path:
                output_path = save_path
            else:
                output_path = os.path.join(self.unirrig_dir, filename)

            workbook.save(output_path)

            print(f"[OK] UNIRRIG Excel file generated: {output_path}")
            return {
                'success': True,
                'file_path': output_path,
                'file_name': filename,
                'owner_name': owner_name_safe,
            }, None

        except Exception as e:
            import traceback
            error_msg = f"Error generating UNIRRIG Excel: {str(e)}\n{traceback.format_exc()}"
            print(f" {error_msg}")
            return None, error_msg

    def inspect_template(self):
        """Inspect the template to see cell values and merged cells"""
        try:
            template_path = os.path.join(self.template_dir, 'FAAS_Template.xlsx')
            if not os.path.exists(template_path):
                print(f"Template not found at {template_path}")
                return
            
            workbook = load_workbook(template_path)
            sheet = workbook.active
            
            print("=== TEMPLATE INSPECTION ===")
            print(f"Template: {template_path}")
            print(f"Sheet name: {sheet.title}")
            print(f"Max row: {sheet.max_row}, Max column: {sheet.max_column}")
            
            print("\n=== MERGED CELLS ===")
            merged_cells = list(sheet.merged_cells.ranges)
            print(f"Number of merged cell ranges: {len(merged_cells)}")
            
            for i, merged_range in enumerate(merged_cells[:10]):  # Show first 10
                print(f"{i+1}. {merged_range}")
            
            print("\n=== IMPORTANT CELL LOCATIONS ===")
            # Check important cells from FAASForm mapping
            important_cells = [
                'B6', 'F6', 'B7', 'F7',           # ARF Info
                'B8', 'F8',                     # Owner Info
                'B13', 'B14', 'F13', 'F14',       # Property Location
                'B16', 'B17', 'B18', 'B19',       # Boundaries
                'A22',                            # Classification
                'B21', 'G22',                     # Valuation
                'F21', 'B22', 'F22',              # Assessment
                'B25', 'F25', 'B26', 'F26'        # System Info
            ]
             
            for cell in important_cells:
                try:
                    cell_obj = sheet[cell]
                    value = cell_obj.value
                    print(f"{cell}: '{value}' (Type: {type(value).__name__})")
                except:
                    print(f"{cell}: ERROR - Cell might not exist")
            
            workbook.close()
            
        except Exception as e:
            print(f"Error inspecting template: {e}")

def main():
    """Main function for Node.js integration. Now supports --type (faas/unirrig)"""
    import argparse
    import sys

    parser = argparse.ArgumentParser(description='Generate Excel files (FAAS/UNIRRIG/BOTH)')
    parser.add_argument('--record-id', type=int, required=True, help='Record ID to generate')
    parser.add_argument('--type', type=str, choices=['faas', 'unirrig', 'both'], default='faas', help='Type of Excel to generate')

    args = parser.parse_args()

    generator = FAASExcelGenerator()

    if args.type == 'faas':
        result, error = generator.generate_faas_excel(args.record_id)
        if result:
            print(json.dumps(result))
            sys.exit(0)
        else:
            print(json.dumps({"success": False, "error": error}))
            sys.exit(1)
    elif args.type == 'unirrig':
        result, error = generator.generate_unirrig_excel(args.record_id)
        if result:
            print(json.dumps(result))
            sys.exit(0)
        else:
            print(json.dumps({"success": False, "error": error}))
            sys.exit(1)
    elif args.type == 'both':
        # Use same timestamp for both files
        shared_timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        faas_result, faas_error = generator.generate_faas_excel(args.record_id, timestamp=shared_timestamp)
        unirrig_result, unirrig_error = generator.generate_unirrig_excel(args.record_id, timestamp=shared_timestamp)
        
        # Consider it a success if at least FAAS succeeded (primary record)
        is_faas_success = bool(faas_result)
        both_success = is_faas_success and bool(unirrig_result)
        
        output = {
            "success": is_faas_success, # Use faas success as the main indicator
            "both_success": both_success,
            "faas": faas_result,
            "unirrig": unirrig_result,
            "faas_error": faas_error if not faas_result else None,
            "unirrig_error": unirrig_error if not unirrig_result else None
        }
        print(json.dumps(output))
        # Exit with 0 if FAAS was successfully generated
        sys.exit(0 if is_faas_success else 1)
    else:
        print(json.dumps({"success": False, "error": 'Invalid type specified.'}))
        sys.exit(1)

if __name__ == "__main__":
    main()