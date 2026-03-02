import os
import mysql.connector
from dotenv import load_dotenv

load_dotenv('backend/.env')

def check_paths():
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        database=os.getenv('DB_NAME')
    )
    cursor = conn.cursor()
    cursor.execute("SELECT id, arf_no, excel_file_path, unirrig_excel_file_path FROM faas_records WHERE status='approved' LIMIT 5")
    rows = cursor.fetchall()
    for row in rows:
        print(f"ID: {row[0]}, ARF: {row[1]}")
        print(f"  Excel: {row[2]}")
        print(f"  Unirrig: {row[3]}")
    conn.close()

if __name__ == "__main__":
    check_paths()
