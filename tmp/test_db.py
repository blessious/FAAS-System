import os
import sys
import mysql.connector
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

db_config = {
    'host': os.getenv('DB_HOST'),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME'),
    'port': os.getenv('DB_PORT', 3306)
}

def get_db_connection():
    return mysql.connector.connect(**db_config)

def test_record_fetching(record_id):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    query = "SELECT * FROM faas_records WHERE id = %s"
    cursor.execute(query, (record_id,))
    record = cursor.fetchone()
    cursor.close()
    conn.close()
    if record:
        print(f"Record found: ID={record['id']}")
        print(f"Status: {record['status']}")
        print(f"Approval Date: {record['approval_date']}")
        print(f"Approval Date Type: {type(record['approval_date'])}")
    else:
        print("Record not found")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        test_record_fetching(sys.argv[1])
    else:
        print("Please provide a record ID")
