import os
import sys
import json
import argparse
import subprocess
import time

def find_libreoffice():
    """Find LibreOffice executable on Windows"""
    # Common installation paths for LibreOffice on Windows
    paths = [
        # LibreOffice 7.x
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        # Portable versions
        r"C:\LibreOffice\program\soffice.exe",
        # If added to PATH
        "soffice",
        "libreoffice",
    ]
    
    for path in paths:
        if os.path.exists(path):
            return path
    
    # Try to find via command line
    try:
        subprocess.run(["where", "soffice"], capture_output=True, check=True, shell=True)
        return "soffice"
    except:
        try:
            subprocess.run(["where", "libreoffice"], capture_output=True, check=True, shell=True)
            return "libreoffice"
        except:
            return None

def convert_excel_to_pdf_libreoffice(excel_path, pdf_path):
    """Convert Excel to PDF using LibreOffice (exact conversion)"""
    try:
        print(f"Converting Excel to PDF using LibreOffice...")
        print(f"   Input: {excel_path}")
        print(f"   Output: {pdf_path}")
        
        # Find LibreOffice
        libreoffice_exe = find_libreoffice()
        if not libreoffice_exe:
            return False, "LibreOffice not found. Please ensure LibreOffice is installed."
        
        print(f"   Found LibreOffice at: {libreoffice_exe}")
        
        # Ensure output directory exists (for final PDF)
        output_dir = os.path.dirname(pdf_path)
        os.makedirs(output_dir, exist_ok=True)
        
        # Prepare command
        # On Windows, using a list with shell=False is most reliable for paths with spaces
        # because it avoids the cmd.exe quote-stripping behavior.
        command = [
            libreoffice_exe,
            '--headless',
            '--convert-to', 'pdf',
            '--outdir', output_dir,
            excel_path
        ]
        
        print(f"   Command: {' '.join(command)}")
        
        # Run conversion
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120, # 2 minute timeout
            shell=False  # Safer on Windows when using list directly
        )
        
        if result.returncode != 0:
            print(f"   Error Code: {result.returncode}")
            print(f"   Error Output: {result.stderr}")
            return False, f"LibreOffice conversion failed (code {result.returncode}): {result.stderr}"
        
        # LibreOffice saves the file with .pdf extension in the same directory
        # It takes the input filename.xlsx and makes it filename.pdf
        excel_filename = os.path.basename(excel_path)
        expected_pdf_filename = excel_filename.replace('.xlsx', '.pdf')
        expected_pdf_path = os.path.join(output_dir, expected_pdf_filename)
        
        # Wait and check for the file (retry for up to 10 seconds)
        print("   Waiting for PDF to be generated...")
        found = False
        for i in range(10):
            if os.path.exists(expected_pdf_path):
                found = True
                break
            # Also check if it was created with a slightly different name
            pdf_files = [f for f in os.listdir(output_dir) if f.endswith('.pdf')]
            if pdf_files:
                # Look for the most recently created PDF in this directory
                latest_pdf = max(pdf_files, key=lambda f: os.path.getctime(os.path.join(output_dir, f)))
                latest_pdf_path = os.path.join(output_dir, latest_pdf)
                # Check if it was created in the last 20 seconds
                if time.time() - os.path.getctime(latest_pdf_path) < 20:
                    expected_pdf_path = latest_pdf_path
                    found = True
                    break
            time.sleep(1)
            
        if found:
            # If the found PDF name doesn't match our desired name, replace it
            # Normalizing paths for comparison
            if os.path.normpath(expected_pdf_path) != os.path.normpath(pdf_path):
                if os.path.exists(pdf_path):
                    try:
                        os.remove(pdf_path)
                    except:
                        pass
                try:
                    os.replace(expected_pdf_path, pdf_path)
                    print(f"   Moved {expected_pdf_path} to {pdf_path}")
                except Exception as e:
                    print(f"   Rename failed: {e}. PDF might still be at {expected_pdf_path}")
                    # If rename fails, we can still return success if the file exists
                    pdf_path = expected_pdf_path
            
            print(f"PDF generated successfully: {pdf_path}")
            return True, None
        else:
            return False, "PDF file was not created by LibreOffice (timed out waiting)"
            
    except subprocess.TimeoutExpired:
        return False, "PDF conversion timeout (120 seconds)"
    except Exception as e:
        error_msg = f"PDF conversion error: {str(e)}"
        print(f"   Error: {error_msg}")
        return False, error_msg

def main():
    parser = argparse.ArgumentParser(description='Convert Excel to PDF using LibreOffice')
    parser.add_argument('--excel-path', required=True, help='Path to Excel file to convert')
    parser.add_argument('--pdf-path', required=True, help='Desired output PDF path')
    
    args = parser.parse_args()
    
    # Validate input
    if not os.path.exists(args.excel_path):
        error_msg = f"Excel file not found: {args.excel_path}"
        print(json.dumps({"success": False, "error": error_msg}))
        sys.exit(1)
    
    if not args.excel_path.lower().endswith('.xlsx'):
        error_msg = f"Input file must be .xlsx, got: {args.excel_path}"
        print(json.dumps({"success": False, "error": error_msg}))
        sys.exit(1)
    
    print("=" * 60)
    print("EXCEL TO PDF CONVERTER")
    print("=" * 60)
    
    # Convert using LibreOffice
    success, error = convert_excel_to_pdf_libreoffice(args.excel_path, args.pdf_path)
    
    if success:
        result = {
            "success": True,
            "message": "PDF generated successfully from Excel",
            "excel_path": args.excel_path,
            "pdf_path": args.pdf_path,
            "pdf_name": os.path.basename(args.pdf_path),
            "method": "libreoffice"
        }
    else:
        result = {
            "success": False,
            "error": error or "Unknown conversion error",
            "excel_path": args.excel_path,
            "method": "libreoffice"
        }
    
    print("=" * 60)
    print("RESULT:", "SUCCESS" if success else "FAILED")
    print("=" * 60)
    
    print(json.dumps(result))
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()