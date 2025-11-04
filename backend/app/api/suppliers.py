from flask import g, jsonify, request
from flask import Blueprint
from sqlalchemy import select
from database.models import Supplier

supplier_bp = Blueprint('suppliers', __name__)

@supplier_bp.route('/suppliers', methods=['GET'])
def get_suppliers():
    db = g.db
    try:
        query = select(Supplier)
        results = db.execute(query).scalars().all()
        return jsonify([supplier.to_dict() for supplier in results]), 200
    finally:
        db.close()

@supplier_bp.route('/suppliers/<int:id>', methods=['GET'])
def get_supplier(id):
    db = g.db
    try:
        query = db.query(Supplier).filter(Supplier.id == id)
        return jsonify([supplier.to_dict() for supplier in query]), 200
    finally:
        db.close()
    

@supplier_bp.route('/suppliers', methods=['POST'])
def create_supplier():
    db = g.db
    try:
        print(request.get_json)
        
        return 200
    finally:
        db.close()


@supplier_bp.route('/suppliers/<int:id>', methods=['PUT'])
def update_supplier(id):
    pass