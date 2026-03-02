import os
import sys
from datetime import datetime
from openpyxl import load_workbook
import json

# Add backend/python to sys.path so we can import FAASExcelGenerator
sys.path.append(os.path.join(os.getcwd(), 'backend', 'python'))
from excel_generator import FAASExcelGenerator

def verify_mappings():
    generator = FAASExcelGenerator()
    
    # Mock record
    mock_data = {
        'id': 999,
        'arf_no': 'TEST-APPROVAL-DATE',
        'owner_name': 'TEST OWNER',
        'approval_date': '2026-03-03', # Should result in 3rd, March, 26 (based on code using %B)
        'ctc_no': 'CTC-12345',
        'ctc_issued_on': '2026-02-02', # Should result in February 2,, 26
        'classification': 'UNIRRIGATED RICELAND',
        'property_barangay': 'Test Brgy',
        'property_municipality': 'Test Mun',
        'property_province': 'Test Prov',
        'land_appraisals_json': '[]',
        'improvements_json': '[]',
        'market_values_json': '[]',
        'assessments_json': '[]'
    }
    
    # Monkey patch get_unirrig_record
    generator.get_unirrig_record = lambda rid: mock_data
    
    try:
        print("Generating test UNIRRIG Excel with mocked data...")
        # Call with dummy ID
        result, error = generator.generate_unirrig_excel(999)
        
        if error:
            print(f"❌ Error reported by generator: {error}")
            return
            
        output_path = result['file_path']
        print(f"Generated: {output_path}")
        
        # Load the generated workbook
        wb = load_workbook(output_path)
        sheet2 = wb['Sheet2']
        
        # Verify Sworn to info
        e42 = sheet2['E42'].value
        g42 = sheet2['G42'].value
        h42 = sheet2['H42'].value
        
        print("\n--- Sworn to Info (E42, G42, H42) ---")
        print(f"E42 (Expected: 3rd): {e42}")
        print(f"G42 (Expected: March): {g42}")
        print(f"H42 (Expected: 26): {h42}")
        
        # Verify CTC info
        g43 = sheet2['G43'].value
        i43 = sheet2['I43'].value
        b44 = sheet2['B44'].value
        
        print("\n--- CTC Info (G43, I43, B44) ---")
        print(f"G43 (Expected: CTC-12345): {g43}")
        print(f"I43 (Expected: February 2,): {i43}")
        print(f"B44 (Expected: 26): {b44}")
        
        # Overall check
        success = True
        if e42 != '3rd': 
            print(f"Mismatch E42: expected '3rd', got '{e42}'")
            success = False
        if g42 != 'March': 
            print(f"Mismatch G42: expected 'March', got '{g42}'")
            success = False
        if h42 != '26': 
            print(f"Mismatch H42: expected '26', got '{h42}'")
            success = False
        if g43 != 'CTC-12345': 
            print(f"Mismatch G43: expected 'CTC-12345', got '{g43}'")
            success = False
        if i43 != 'February 2,': 
            print(f"Mismatch I43: expected 'February 2,', got '{i43}'")
            success = False
        if b44 != '26': 
            print(f"Mismatch B44: expected '26', got '{b44}'")
            success = False
        
        if success:
            print("\n✅ ALL MAPPINGS VERIFIED SUCCESSFULLY!")
        else:
            print("\n❌ SOME MAPPINGS FAILED VERIFICATION.")
            
    except Exception as e:
        import traceback
        print(f"❌ Error during verification: {e}")
        traceback.print_exc()

if __name__ == "__main__":
    verify_mappings()
