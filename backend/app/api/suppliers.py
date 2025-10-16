from app.api import bp
from json import jsonify
from app import get_db
from database.models import Supplier

@bp.route('/suppliers', methods=['GET'])
def get_suppliers():
    db = get_db()

    try:
        query = db.query(Supplier).all()
        return jsonify([supplier.to_dict() for supplier in query]), 200
    finally:
        db.close()

@bp.route('/suppliers/<int:id>', methods=['GET'])
def get_supplier(id):
    pass

@bp.route('/suppliers', methods=['POST'])
def create_supplier():
    pass    

@bp.route('/suppliers/<int:id>', methods=['PUT'])
def update_supplier(id):
    pass