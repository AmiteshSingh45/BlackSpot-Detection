import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.config import settings
from app.models import Blackspot
from app.services.alert_service import generate_alerts
from app.services.recommendation_service import generate_recommendations

def run_triggers():
    engine = create_engine(settings.DATABASE_URL)
    Session = sessionmaker(bind=engine)
    db = Session()

    # Find distinct upload_ids from Blackspots
    upload_ids = [r[0] for r in db.query(Blackspot.upload_id).distinct().all()]
    print(f"Found upload_ids: {upload_ids}")

    for idx in upload_ids:
        if idx is not None:
            print(f"Generating for upload {idx}...")
            alerts = generate_alerts(db, idx)
            recs = generate_recommendations(db, idx)
            print(f"Upload {idx}: created {len(alerts)} alerts and {len(recs)} recommendations.")
            
    print("Done triggers.")

if __name__ == '__main__':
    run_triggers()
