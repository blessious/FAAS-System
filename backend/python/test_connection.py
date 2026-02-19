import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv()

def test_db_connection():
    try:
        connection = mysql.connector.connect(
            host=os.getenv('DB_HOST'),
            user=os.getenv('DB_USER'),
            password=os.getenv('DB_PASSWORD'),
            database=os.getenv('DB_NAME'),
            port=os.getenv('DB_PORT', 3306)
        )
        
        if connection.is_connected():
            print("✅ Python connected to MySQL database successfully!")
            
            cursor = connection.cursor()
            cursor.execute("SELECT DATABASE()")
            db_name = cursor.fetchone()
            print(f"📊 Database: {db_name[0]}")
            
            cursor.close()
            connection.close()
            
        return True
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return False

if __name__ == "__main__":
    test_db_connection()