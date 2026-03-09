import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import cm, inch

def generate_ruler_pdf(output_path):
    """
    Generates a calibration ruler PDF with a 1cm grid and coordinates.
    """
    # Custom paper size: 8 inches x 11 inches
    paper_size = (8 * inch, 11 * inch)
    c = canvas.Canvas(output_path, pagesize=paper_size)
    width, height = paper_size
    
    # Draw vertical lines
    for x_mm in range(0, int(width / (0.1 * cm)) + 1):
        x = x_mm * 0.1
        c.setDash([], 0) # All solid
        
        if x_mm % 10 == 0: # 1cm
            c.setStrokeColorRGB(1, 0, 0) # Primary Red
            c.setLineWidth(0.8)
            c.line(x * cm, 0, x * cm, height)
            
            # CM labels
            if int(x) > 0:
                c.setFont("Helvetica-Bold", 8)
                c.setFillColorRGB(1, 0, 0)
                c.drawString(x * cm + 1, 10, f"{int(x)}")
                c.drawString(x * cm + 1, height - 15, f"{int(x)}")
        else: # 1mm (Sub-centimeter)
            c.setStrokeColorRGB(1, 0.7, 0.7) # Lighter Red for sub-grid
            c.setLineWidth(0.2)
            c.line(x * cm, 0, x * cm, height)
            
            # Sub-indicators (.1 to .9)
            if x < 2: # Only label first few cm to avoid clutter
                val = x_mm % 10
                c.setFont("Helvetica", 5)
                c.setFillColorRGB(1, 0.5, 0.5)
                c.drawString(x * cm + 0.5, 2, f".{val}")
                c.drawString(x * cm + 0.5, height - 8, f".{val}")

    # Draw horizontal lines
    for y_mm in range(0, int(height / (0.1 * cm)) + 1):
        y = y_mm * 0.1
        c.setDash([], 0)
        
        if y_mm % 10 == 0: # 1cm
            c.setStrokeColorRGB(1, 0, 0)
            c.setLineWidth(0.8)
            c.line(0, y * cm, width, y * cm)
            
            # CM labels
            if int(y) > 0:
                c.setFont("Helvetica-Bold", 8)
                c.setFillColorRGB(1, 0, 0)
                c.drawString(10, y * cm + 1, f"{int(y)}")
                c.drawString(width - 20, y * cm + 1, f"{int(y)}")
        else: # 1mm (Sub-centimeter)
            c.setStrokeColorRGB(1, 0.7, 0.7)
            c.setLineWidth(0.2)
            c.line(0, y * cm, width, y * cm)
            
            # Sub-indicators (.1 to .9)
            if y < 2: # Only label first few cm to avoid clutter
                val = y_mm % 10
                c.setFont("Helvetica", 5)
                c.setFillColorRGB(1, 0.5, 0.5)
                c.drawString(2, y * cm + 0.5, f".{val}")
                c.drawString(width - 15, y * cm + 0.5, f".{val}")

    # Draw coordinate labels at intersections (every 5cm for clarity)
    c.setFont("Helvetica-Bold", 6)
    c.setFillColorRGB(1, 0, 0)
    for x in range(5, int(width / cm), 5):
        for y in range(5, int(height / cm), 5):
            c.drawString(x * cm + 2, y * cm + 2, f"({x},{y})")

    c.save()
    print(f"Ruler PDF generated at: {output_path}")

if __name__ == "__main__":
    # Save to the generated folder
    current_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(current_dir, "generated", "CALIBRATION")
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        
    output_file = os.path.join(output_dir, "Calibration_Ruler.pdf")
    generate_ruler_pdf(output_file)
