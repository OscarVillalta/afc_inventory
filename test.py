from database import engine
from sqlalchemy import text

with engine.connect() as conn:
    print(conn.execute(text("SELECT 1")).scalar())