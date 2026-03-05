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
        if x_mm % 10 == 0: # 1cm (Solid)
            c.setDash([], 0) # Reset to solid
            val = int(x)
            if val % 5 == 0:
                c.setStrokeColorRGB(1, 0, 0)  # Red for every 5cm
                c.setLineWidth(1.0)
            else:
                c.setStrokeColorRGB(1, 0.4, 0.4)  # Lighter red for every 1cm
                c.setLineWidth(0.5)
            c.line(x * cm, 0, x * cm, height)
            
            # CM labels
            if val > 0:
                c.setFont("Helvetica-Bold", 7)
                c.setFillColorRGB(0.8, 0, 0)
                c.drawString(x * cm + 2, 5, f"{x}")
                c.drawString(x * cm + 2, height / 2, f"{x}")
        else: # 1mm (Broken Lines)
            c.setDash(1, 2) # 1pt dash, 2pt gap
            c.setStrokeColorRGB(0.8, 0.8, 0.8) # Light gray
            c.setLineWidth(0.2)
            c.line(x * cm, 0, x * cm, height)

    # Draw horizontal lines
    for y_mm in range(0, int(height / (0.1 * cm)) + 1):
        y = y_mm * 0.1
        if y_mm % 10 == 0: # 1cm (Solid)
            c.setDash([], 0)
            val = int(y)
            if val % 5 == 0:
                c.setStrokeColorRGB(1, 0, 0)
                c.setLineWidth(1.0)
            else:
                c.setStrokeColorRGB(1, 0.4, 0.4)
                c.setLineWidth(0.5)
            c.line(0, y * cm, width, y * cm)
            
            # CM labels
            if val > 0:
                c.setFont("Helvetica-Bold", 7)
                c.setFillColorRGB(0.8, 0, 0)
                c.drawString(5, y * cm + 2, f"{y}")
                c.drawString(width / 2, y * cm + 2, f"{y}")
        else: # 1mm (Broken Lines)
            c.setDash(1, 2)
            c.setStrokeColorRGB(0.8, 0.8, 0.8)
            c.setLineWidth(0.2)
            c.line(0, y * cm, width, y * cm)

    # Reset dash for final elements
    c.setDash([], 0)
    
    # Draw coordinate labels at intersections (every 2cm)
    c.setFont("Helvetica-Bold", 5)
    c.setFillColorRGB(1, 0, 0)
    for x in range(2, int(width / cm), 2):
        for y in range(2, int(height / cm), 2):
            c.drawString(x * cm + 5, y * cm + 5, f"({x},{y})")

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
