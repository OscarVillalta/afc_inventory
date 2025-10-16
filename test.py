from database import SessionLocal
from database.models import Supplier, Filter, Quantity

# --- Test from_dict() ---
supplier = Supplier.from_dict({"name": "GlassFloss"})
filter = Filter.from_dict({"part_number": "HVP242412", "supplier_id": 1, "rating": 8, "height": 24, "width": 24, "depth": 12})
print(supplier.to_dict())
print(filter.to_dict())

db = SessionLocal()
db.add(supplier)
db.add(filter)
db.commit()
db.refresh(supplier)

print("After commit:", supplier.to_dict()) 