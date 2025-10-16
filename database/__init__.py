import os
from dotenv import load_dotenv
from sqlalchemy.orm import DeclarativeBase,sessionmaker
from sqlalchemy import create_engine

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL, future=True, echo=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

__all__ = ["Base", "engine", "SessionLocal"]
