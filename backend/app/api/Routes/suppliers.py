from flask import g, jsonify, request
from flask import Blueprint
from sqlalchemy import select
from database.models import Supplier, Filter
from marshmallow import ValidationError
from app.api.Schemas.supplier_schema import SupplierSchema

supplier_bp = Blueprint('suppliers', __name__)
supplier_schema = SupplierSchema()

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
        query = select(Supplier).where(Supplier.id == id)
        result = db.execute(query).scalars().first()
        return jsonify(result.to_dict()), 200
    finally:
        db.close()
    

@supplier_bp.route('/suppliers', methods=['POST'])
def create_supplier():
    db = g.db

    #validation
    try:
        data = supplier_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    #DB Insert

    try:
        new_supplier = Supplier.from_dict(data)
        db.add(new_supplier)
        db.commit()

        return jsonify(supplier_schema.dump(new_supplier)), 201
    finally:
        db.close()

@supplier_bp.route('/suppliers/<int:id>', methods=['PATCH'])
def update_supplier(id):
    db = g.db

    query = select(Supplier).where(Supplier.id == id)
    supplier = db.execute(query).scalars().first()

    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    try:
        data = supplier_schema.load(request.get_json(), partial=True)
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(supplier, key, value)

    db.commit()

    return jsonify(supplier_schema.dump(supplier)), 200

@supplier_bp.route('/suppliers/<int:id>', methods=['PUT'])
def replace_supplier(id):
    db = g.db

    query = select(Supplier).where(Supplier.id == id)
    supplier = db.execute(query).scalars().first()

    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    try:
        data = supplier_schema.load(request.get_json())
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400
    
    for key, value in data.items():
        setattr(supplier, key, value)

    db.commit()

    return jsonify(supplier_schema.dump(supplier)), 200

@supplier_bp.route("/suppliers/<int:id>", methods=["DELETE"])
def delete_supplier(id):
    db = g.db

    query = select(Supplier).where(Supplier.id == id)
    supplier = db.execute(query).scalars().first()

    if not supplier:
        return jsonify({"error": "Supplier not found"}), 404

    # Block deletion if supplier has filters
    has_filters = db.execute(
        select(Filter).where(Filter.supplier_id == id)
    ).first()

    if has_filters:
        return jsonify({
            "error": "Cannot delete supplier with existing filters."
        }), 400

    db.delete(supplier)
    db.commit()
    return jsonify({"message": "Supplier deleted successfully."}), 200