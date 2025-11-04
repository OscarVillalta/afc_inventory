from flask import Flask, g
from database import SessionLocal
from app.api.suppliers import supplier_bp

def create_app():
    app = Flask(__name__)

    app.register_blueprint(supplier_bp, url_prefix='/api')

    @app.before_request
    def start_db_session():
        g.db = SessionLocal()

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db = getattr(g, "db", None)
        if db is not None:
            db.close()

    return app
