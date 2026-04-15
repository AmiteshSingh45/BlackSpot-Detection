import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Alert, Blackspot

def check_data():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    session = Session()

    blackspots = session.query(Blackspot).all()
    print(f"Total Blackspots: {len(blackspots)}")

    alerts = session.query(Alert).all()
    print(f"Total Alerts: {len(alerts)}")

if __name__ == '__main__':
    check_data()
