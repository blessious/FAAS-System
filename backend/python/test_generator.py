from excel_generator import FAASExcelGenerator

if __name__ == "__main__":
    generator = FAASExcelGenerator()
    
    # Test with a specific record ID (change this to your actual record ID)
    test_record_id = 1  # Change this to an existing FAAS record ID
    
    print("Testing FAAS Excel Generation...")
    result, error = generator.generate_faas_excel(test_record_id)
    
    if result:
        print("✅ Success!")
        print(f"File: {result['file_name']}")
        print(f"Path: {result['file_path']}")
    else:
        print(f"❌ Error: {error}")