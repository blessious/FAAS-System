import os
import sys
import json
import argparse
import tempfile
from reportlab.lib.units import cm, inch
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from openpyxl import load_workbook
from pypdf import PdfReader, PdfWriter

# 🎯 MASTER TEMPLATE - Default coordinates (CM from Bottom-Left)
TEMPLATE_MAPPING = {
    'Sheet1!J3':  {'x': 16.0, 'y': 26.5, 'label': 'PIN'},
    'Sheet1!A7':  {'x': 2.5,  'y': 24.5, 'label': 'Memoranda'},
    'Sheet1!B11': {'x': 4.0,  'y': 23.3, 'label': 'Owner'},
    'Sheet1!B13': {'x': 4.3,  'y': 22.75, 'label': 'Admin'},
    'Sheet1!H11': {'x': 12.0, 'y': 23.3, 'label': 'Owner Addr'},
    'Sheet1!H13': {'x': 12.0, 'y': 22.65, 'label': 'Admin Addr'},
    'Sheet1!C17': {'x': 7.0,  'y': 21.5, 'label': 'Street'},
    'Sheet1!G17': {'x': 10.5, 'y': 21.5, 'label': 'Barangay'},
    'Sheet1!I17': {'x': 16.0, 'y': 21.5, 'label': 'Municipality'},
    'Sheet1!C19': {'x': 5.5,  'y': 20.7, 'label': 'Title'},
    'Sheet1!H19': {'x': 11.8, 'y': 20.6, 'label': 'Lot No'},
    'Sheet1!K19': {'x': 18.0, 'y': 20.65, 'label': 'K19'},
    'Sheet1!K20': {'x': 18.0, 'y': 20.2, 'label': 'K20'},
    'Sheet1!B21': {'x': 4.0,  'y': 20.5, 'label': 'North'},
    'Sheet1!B22': {'x': 4.0,  'y': 19.4, 'label': 'East'},
    'Sheet1!I21': {'x': 12.3, 'y': 19.75, 'label': 'South'},
    'Sheet1!I22': {'x': 12.3, 'y': 19.4, 'label': 'West'},
    'Sheet1!E28': {'x': 9.6,  'y': 16.8,  'label': 'Land 1: Kind'},
    'Sheet1!G28': {'x': 11.6, 'y': 16.8,  'label': 'Land 1: Area'},
    'Sheet1!H28': {'x': 14.0, 'y': 16.8,  'label': 'Land 1: Class'},
    'Sheet1!I28': {'x': 15.5, 'y': 16.8,  'label': 'Land 1: UV'},
    'Sheet1!J28': {'x': 17.6, 'y': 16.8,  'label': 'Land 1: MV'},
    'Sheet1!E33': {'x': 8.2,  'y': 15.95, 'label': 'Land 3: Kind'},
    'Sheet1!G33': {'x': 11.0, 'y': 15.45, 'label': 'Land 3: Area'},
    'Sheet1!H33': {'x': 13.0, 'y': 14.95, 'label': 'Land 3: Class'},
    'Sheet1!I33': {'x': 15.1, 'y': 14.35, 'label': 'Land 3: UV'},
    'Sheet1!J33': {'x': 17.5, 'y': 13.85, 'label': 'Land 3: MV'},
    'Sheet1!E35': {'x': 8.5,  'y': 13.35, 'label': 'Land 4: Kind'},
    'Sheet1!G35': {'x': 11.0, 'y': 12.85, 'label': 'Land 4: Area'},
    'Sheet1!H35': {'x': 13.0, 'y': 12.35, 'label': 'Land 4: Class'},
    'Sheet1!I35': {'x': 15.0, 'y': 11.85, 'label': 'Land 4: UV'},
    'Sheet1!J35': {'x': 17.5, 'y': 11.35, 'label': 'Land 4: MV'},
    'Sheet1!J36': {'x': 17.8, 'y': 13.75, 'label': 'Total MV Land'},
    'Sheet1!H42': {'x': 12.7, 'y': 11.8,  'label': 'Plant: Kind'},
    'Sheet1!I42': {'x': 15.0, 'y': 11.8,  'label': 'Plant: Area'},
    'Sheet1!J42': {'x': 17.0, 'y': 11.8,  'label': 'Plant: UV'},
    'Sheet1!K42': {'x': 18.2, 'y': 11.8,  'label': 'Plant: MV'},
    'Sheet1!K53': {'x': 18.4, 'y': 7.8,   'label': 'Total MV Plants'},
    'Sheet1!G44': {'x': 11.0, 'y': 11.4,  'label': 'Plant Adj 1 %'},
    'Sheet1!G47': {'x': 11.0, 'y': 10.6,  'label': 'Plant Adj 2 %'},
    'Sheet1!G49': {'x': 11.0, 'y': 9.7,   'label': 'Plant Adj 3 %'},
    'Sheet1!G52': {'x': 11.0, 'y': 9.3,   'label': 'Plant Adj 4 %'},
    'Sheet1!E58': {'x': 8.7,  'y': 5.2,   'label': 'Land II: Kind'},
    'Sheet1!G58': {'x': 11.3, 'y': 5.2,   'label': 'Land II: Area'},
    'Sheet1!H58': {'x': 13.7, 'y': 5.2,   'label': 'Land II: Class'},
    'Sheet1!H59': {'x': 13.7, 'y': 4.5,   'label': 'Land II: UV'},
    'Sheet1!J58': {'x': 17.6, 'y': 5.1,   'label': 'Land II: MV'},
    # Additional table rows from mapping if present
    'Sheet1!E29': {'x': 8.8, 'y': 16.35, 'label': 'Land 2: Kind'},
    'Sheet1!G29': {'x': 11.5,'y': 16.35, 'label': 'Land 2: Area'},
    'Sheet1!H29': {'x': 13.5,'y': 16.3,  'label': 'Land 2: Class'},
    'Sheet1!I29': {'x': 15.5,'y': 16.3,  'label': 'Land 2: UV'},
    'Sheet1!J29': {'x': 17.6,'y': 16.3,  'label': 'Land 2: MV'},
    'Sheet1!E30': {'x': 8.8, 'y': 15.95, 'label': 'Land 3 alternative'}, 
    'Sheet1!G30': {'x': 11.5,'y': 15.95, 'label': 'Land 3 alternative Area'},
}

class PrecisionPDFGenerator:
    def __init__(self, mapping_file=None):
        self.font_name = "Helvetica-Bold"
        self._register_font()
        self.mapping = TEMPLATE_MAPPING.copy()
        
        if mapping_file:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            fpath = mapping_file if os.path.isabs(mapping_file) else os.path.join(script_dir, mapping_file)
            if os.path.exists(fpath):
                try:
                    with open(fpath, 'r') as f:
                        self.mapping.update(json.load(f))
                except: pass

        self.paper_size = (8 * inch, 11 * inch)

    def _register_font(self):
        font_path = r"C:\Windows\Fonts\bahnschrift.ttf"
        if os.path.exists(font_path):
            try:
                name = "Bahnschrift-Bold"
                pdfmetrics.registerFont(TTFont(name, font_path))
                self.font_name = name
            except: pass

    def generate(self, excel_path, output_path=None, template_pdf=None):
        if not os.path.exists(excel_path):
            return {"success": False, "error": "Excel missing"}
        
        if not output_path:
            out_dir = os.path.join(os.path.dirname(__file__), "generated", "PRECISION")
            os.makedirs(out_dir, exist_ok=True)
            output_path = os.path.join(out_dir, f"Precision_{os.path.basename(excel_path).replace('.xlsx', '.pdf')}")

        # If template is used, generate text into a temporary file first
        target_file = output_path
        if template_pdf and os.path.exists(template_pdf):
            temp_handle, temp_pdf_path = tempfile.mkstemp(suffix=".pdf")
            os.close(temp_handle)
            target_file = temp_pdf_path

        try:
            wb = load_workbook(excel_path, data_only=True)
            c = canvas.Canvas(target_file, pagesize=self.paper_size)
            
            fields_processed = 0
            for key, coord in self.mapping.items():
                try:
                    sn, addr = None, None
                    if '!' in key:
                        sn, addr = key.split('!')
                        # Strip _line suffix for Excel reading
                        if '_line' in addr:
                            addr = addr.split('_line')[0]

                    text = coord.get('text')
                    if text is None:
                        if not sn: continue
                        
                        if sn not in wb.sheetnames:
                            sn_lower = sn.lower()
                            real_sn = next((s for s in wb.sheetnames if s.lower() == sn_lower), None)
                            if real_sn: sn = real_sn
                            else: continue
                        
                        val = wb[sn][addr].value
                        if val is None or str(val).strip() == "": continue
                        
                        text = str(val)
                        if addr in ['G44', 'G47', 'G49', 'G52']:
                            try:
                                num_val = float(val)
                                text = f"{num_val * 100:.0f}%" if num_val <= 1.0 else f"{num_val:.0f}%"
                            except: pass
                        elif addr == 'I42':
                            try: text = f"{int(float(val))}"
                            except: pass
                        elif addr and any(col in addr for col in ['I', 'J', 'K']):
                            try: text = f"{float(val):,.2f}"
                            except: pass
                    
                    if not text or str(text).strip() == "": continue
                    
                    x, y = coord['x'] * cm, coord['y'] * cm
                    c.saveState()
                    c.translate(x, y)
                    c.scale(0.75, 1.0)
                    
                    fs = coord.get('fontSize', 10.5)
                    t = c.beginText(0, 0)
                    t.setFont(self.font_name, fs)
                    t.setFillColorRGB(0, 0, 0)
                    t.setTextRenderMode(2) 
                    c.setLineWidth(0.35)
                    c.setStrokeColorRGB(0, 0, 0)
                    
                    if "Total" in str(coord.get('label','')):
                        c.setFont(self.font_name, fs)
                        c.drawCentredString(0, 0, text)
                    else:
                        t.textOut(text)
                        c.drawText(t)
                        
                    c.restoreState()
                    fields_processed += 1
                except Exception as e:
                    sys.stderr.write(f"DEBUG: Error drawing {key}: {e}\n")
                    continue

            c.save()

            # Merge with template if requested
            if template_pdf and os.path.exists(template_pdf):
                try:
                    reader_template = PdfReader(template_pdf)
                    reader_text = PdfReader(target_file)
                    writer = PdfWriter()

                    # Merge first page
                    page = reader_template.pages[0]
                    if len(reader_text.pages) > 0:
                        page.merge_page(reader_text.pages[0])
                    
                    writer.add_page(page)
                    with open(output_path, "wb") as f:
                        writer.write(f)
                    
                    # Cleanup temp file
                    if target_file != output_path:
                        try: os.remove(target_file)
                        except: pass
                except Exception as merge_ex:
                    sys.stderr.write(f"ERROR merging PDF: {merge_ex}\n")
                    # If merge fails, at least we have the text-only output_path was target_file
                    if target_file != output_path:
                        os.rename(target_file, output_path)

            return {
                "success": True, 
                "fields_count": fields_processed,
                "file_path": output_path, 
                "file_name": os.path.basename(output_path)
            }
        except Exception as ex:
            return {"success": False, "error": str(ex)}

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument('--excel-path', required=True)
    p.add_argument('--mapping-file')
    p.add_argument('--template-pdf')
    p.add_argument('--output')
    a = p.parse_args()
    gen = PrecisionPDFGenerator(a.mapping_file)
    print(json.dumps(gen.generate(a.excel_path, output_path=a.output, template_pdf=a.template_pdf)))
