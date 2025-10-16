from flask import Flask
from database import SessionLocal

def create_app():
    app = Flask(__name__)

    from app.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')

    return app

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

from app import routes

