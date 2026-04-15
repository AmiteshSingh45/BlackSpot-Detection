import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from app.config import settings

def patch_db():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        print("Checking tables...")
        # Check if latitude and longitude exist in blackspots table
        try:
            conn.execute(text("SELECT latitude, longitude FROM blackspots LIMIT 1"))
            print("Columns latitude and longitude already exist in blackspots.")
        except Exception as e:
            print(f"Adding columns to blackspots table: {e}")
            conn.execute(text("ALTER TABLE blackspots ADD COLUMN latitude FLOAT"))
            conn.execute(text("ALTER TABLE blackspots ADD COLUMN longitude FLOAT"))
            conn.commit()
            print("Added latitude and longitude to blackspots.")
        
        # We also need to check if alerts table exists. It may exist if create_all was executed after models were updated.
        try:
            conn.execute(text("SELECT 1 FROM alerts LIMIT 1"))
            print("Alerts table exists.")
        except Exception as e:
            print("Alerts table does not exist. Please run create_all().")

if __name__ == "__main__":
    patch_db()
