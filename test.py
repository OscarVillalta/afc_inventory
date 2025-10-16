from database import SessionLocal
from database.models import Supplier, Filter, Quantity



db = SessionLocal()
supplier = db.query(Supplier).filter_by(id=2).first()

for f in supplier.filters:
    print(f.to_dict(include_relationships=True))
