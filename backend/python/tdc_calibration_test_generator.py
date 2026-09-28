"""Create a values-only TDC alignment test without using taxpayer data."""
import argparse
import json
import os
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch, cm

PAGE_SIZE = (8 * inch, 11 * inch)
MARKERS = {
    'Sheet1!B11': 'P1-A',
    'Sheet1!J35': 'P1-B',
    'Sheet1!K53': 'P1-C',
    'Sheet2!A54': 'P2-A',
    'Sheet2!M58': 'P2-B',
    'Sheet2!L72': 'P2-C',
}

def draw_marker(pdf, coord, label):
    pdf.saveState()
    pdf.translate(float(coord['x']) * cm, float(coord['y']) * cm)
    pdf.setFont('Helvetica-Bold', float(coord.get('fontSize', 10.5)))
    pdf.drawString(0, 0, '• ' + label)
    pdf.restoreState()

def main(mapping_path, output_path):
    with open(mapping_path, 'r', encoding='utf-8') as mapping_file:
        mapping = json.load(mapping_file)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    pdf = canvas.Canvas(output_path, pagesize=PAGE_SIZE)
    for prefix in ('Sheet1!', 'Sheet2!'):
        for key, label in MARKERS.items():
            if key.startswith(prefix) and key in mapping:
                draw_marker(pdf, mapping[key], label)
        if prefix == 'Sheet1!':
            pdf.showPage()
    pdf.save()
    print(json.dumps({'success': True, 'file_path': output_path, 'file_name': os.path.basename(output_path)}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mapping-file', required=True)
    parser.add_argument('--output-path', required=True)
    args = parser.parse_args()
    main(args.mapping_file, args.output_path)
