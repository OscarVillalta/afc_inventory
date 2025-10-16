from flask import Flask, g
from database import SessionLocal

def create_app():
    app = Flask(__name__)

    from app.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api/v1')

    @app.before_request
    def start_db_session():
        g.db = SessionLocal()

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db = getattr(g, "db", None)
        if db is not None:
            db.close()

    return app
