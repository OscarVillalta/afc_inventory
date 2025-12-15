from flask import Flask, g
from database import SessionLocal
from backend.app.api.Routes.suppliers import supplier_bp
from backend.app.api.Routes.quantity import quantity_bp
from backend.app.api.Routes.transactions import transaction_bp
from backend.app.api.Routes.air_filters import air_filter_bp
from backend.app.api.Routes.customers import customer_bp
from backend.app.api.Routes.products import product_bp
from backend.app.api.Routes.misc_items import misc_bp
from flask_cors import CORS


def create_app():
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    #BluePrints
    app.register_blueprint(supplier_bp, url_prefix='/api')
    app.register_blueprint(air_filter_bp, url_prefix='/api')
    app.register_blueprint(quantity_bp, url_prefix='/api')
    app.register_blueprint(transaction_bp, url_prefix='/api')
    app.register_blueprint(customer_bp, url_prefix="/api")
    app.register_blueprint(product_bp, url_prefix="/api")
    app.register_blueprint(misc_bp, url_prefix="/api")


    #Db_session wrappers
    @app.before_request
    def start_db_session():
        g.db = SessionLocal()

    @app.teardown_appcontext
    def shutdown_session(exception=None):
        db = getattr(g, "db", None)
        if db is not None:
            db.rollback() 
            db.close()

    return app
